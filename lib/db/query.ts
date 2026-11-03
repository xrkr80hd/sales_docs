import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { getPool, transaction, type Queryable } from "./pool";
import { RELATIONS, tableSpec, type ColumnType } from "./schema";

/*
 * A small MySQL query builder that accepts the same calls the app already made
 * against Supabase (`db.from("deals").select("id, status").eq("user_id", id)`),
 * so moving off Supabase does not mean rewriting every route. It returns the
 * same `{ data, error, count }` shape and converts values so callers see
 * booleans, parsed JSON and ISO timestamps exactly as before.
 */

export type DbError = { message: string; code: string; details?: string; hint?: string };
export type DbResult<T = any> = { data: T; error: DbError | null; count: number | null; status: number; statusText: string };

/** Extra row filter applied to every read and write on a table (replaces Postgres row-level security). */
export type ScopeFilter = (table: string) => Promise<{ column: string; values: unknown[] } | null>;

const q = (name: string) => "`" + name.replace(/`/g, "``") + "`";

// ── value conversion ────────────────────────────────────────────────────────
export function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  // MySQL gives "2026-10-25 19:45:41.123456"; Supabase gave "2026-10-25T19:45:41.123456+00:00".
  const match = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?$/);
  if (!match) return text;
  const fraction = (match[3] || "").replace(/0+$/, "");
  return `${match[1]}T${match[2]}${fraction === "." ? "" : fraction}+00:00`;
}

export function toDbTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().replace("T", " ").replace("Z", "");
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (match && (!match[4] || match[4] === "Z" || /^\+00:?00$/.test(match[4]))) return `${match[1]} ${match[2]}${(match[3] || "").slice(0, 7)}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString().replace("T", " ").replace("Z", "");
}

function toDb(type: ColumnType | undefined, value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  switch (type) {
    case "json": return typeof value === "string" ? value : JSON.stringify(value);
    case "bool": return value === true || value === "true" || value === 1 || value === "1" ? 1 : 0;
    case "datetime": return toDbTime(value);
    case "date": return String(value).slice(0, 10);
    default:
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "object" && !(value instanceof Date)) return JSON.stringify(value);
      return value;
  }
}

function fromDb(type: ColumnType | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "json": if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return value; }
    case "bool": return Number(value) === 1;
    case "datetime": return toIso(value);
    case "date": return String(value).slice(0, 10);
    case "int": return typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
    default: return value;
  }
}

// ── select parsing ──────────────────────────────────────────────────────────
type JsonStep = { key: string; text: boolean };
type ColumnItem = { kind: "column"; alias: string; column: string; path: JsonStep[] };
type EmbedItem = { kind: "embed"; alias: string; table: string; hint?: string; items: SelectItem[] };
type SelectItem = { kind: "star" } | ColumnItem | EmbedItem;

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, quoted = false, current = "";
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === ",") { parts.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map(p => p.trim()).filter(Boolean);
}

function parseColumnExpr(expr: string): { column: string; path: JsonStep[] } {
  const tokens = expr.split(/(->>|->)/);
  const column = tokens[0].trim();
  const path: JsonStep[] = [];
  for (let k = 1; k < tokens.length; k += 2) {
    const op = tokens[k], raw = (tokens[k + 1] || "").trim();
    path.push({ key: raw.replace(/^"(.*)"$/, "$1"), text: op === "->>" });
  }
  return { column, path };
}

export function parseSelect(text: string): SelectItem[] {
  return splitTopLevel(text.replace(/\s+/g, " ")).map((part): SelectItem => {
    if (part === "*") return { kind: "star" };
    const embed = part.match(/^(?:([A-Za-z_][\w]*):)?([A-Za-z_][\w]*)(?:!([\w]+))?\s*\(([\s\S]*)\)$/);
    if (embed) return { kind: "embed", alias: embed[1] || embed[2], table: embed[2], hint: embed[3], items: parseSelect(embed[4]) };
    const aliased = part.match(/^([A-Za-z_][\w]*):([\s\S]*)$/);
    const alias = aliased?.[1];
    const { column, path } = parseColumnExpr(aliased ? aliased[2] : part);
    const lastKey = path.length ? path[path.length - 1].key : column;
    return { kind: "column", alias: alias || lastKey, column, path };
  });
}

function jsonPathLiteral(path: JsonStep[]) {
  return "$" + path.map(step => /^\d+$/.test(step.key) ? `[${step.key}]` : `."${step.key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join("");
}

/** SQL expression (with params) for a column or JSON path, e.g. consultant_info->business_card->>slug. */
function columnExpr(table: string, expr: string, params: unknown[]): { sql: string; type: ColumnType | undefined; json: boolean } {
  const { column, path } = parseColumnExpr(expr);
  const spec = tableSpec(table);
  if (!(column in spec.columns)) throw dbError(`Column ${column} does not exist on ${table}.`, "42703");
  if (!path.length) return { sql: q(column), type: spec.columns[column], json: false };
  params.push(jsonPathLiteral(path));
  const extract = `JSON_EXTRACT(${q(column)}, ?)`;
  const asText = path[path.length - 1].text;
  return { sql: asText ? `JSON_UNQUOTE(${extract})` : extract, type: asText ? "text" : "json", json: !asText };
}

// ── errors ──────────────────────────────────────────────────────────────────
class DbFailure extends Error { constructor(public error: DbError) { super(error.message); } }
function dbError(message: string, code = "XX000", details?: string): DbFailure { return new DbFailure({ message, code, details }); }
function mapMysqlError(error: unknown): DbError {
  if (error instanceof DbFailure) return error.error;
  const e = error as { code?: string; errno?: number; sqlMessage?: string; message?: string };
  const message = e?.sqlMessage || e?.message || "Database request failed.";
  if (e?.code === "ER_DUP_ENTRY") return { message, code: "23505" };
  if (e?.code === "ER_NO_REFERENCED_ROW_2" || e?.code === "ER_ROW_IS_REFERENCED_2") return { message, code: "23503" };
  if (e?.code === "ER_CHECK_CONSTRAINT_VIOLATED" || e?.errno === 4025) return { message, code: "23514" };
  if (e?.code === "ER_BAD_NULL_ERROR") return { message, code: "23502" };
  return { message, code: e?.code || "XX000" };
}

// ── builder ─────────────────────────────────────────────────────────────────
type Filter = { sql: string; params: unknown[] };
type Order = { expr: string; ascending: boolean; nullsFirst?: boolean };
type Mode = "select" | "insert" | "upsert" | "update" | "delete";
type Hooks = { afterInsert?: (table: string, rows: Record<string, unknown>[], conn: Queryable) => Promise<void> };

export class QueryBuilder<T = any[]> implements PromiseLike<DbResult<T>> {
  private mode: Mode = "select";
  private selectText: string | null = null;
  private returning = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private singleMode: "single" | "maybe" | null = null;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private values: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private conflict: string[] = [];
  private ignoreDuplicates = false;
  private promise?: Promise<DbResult<T>>;

  constructor(private table: string, private scope?: ScopeFilter, private hooks: Hooks = {}) { tableSpec(table); }

  // reads
  select(columns = "*", options: { count?: "exact" | "planned" | "estimated"; head?: boolean } = {}) {
    if (this.mode === "select") { this.selectText = columns; this.countMode = options.count ? "exact" : null; this.headOnly = Boolean(options.head); }
    else { this.returning = true; this.selectText = columns; }
    return this;
  }
  // writes
  insert(values: Record<string, unknown> | Record<string, unknown>[]) { this.mode = "insert"; this.values = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.mode = "upsert"; this.values = Array.isArray(values) ? values : [values];
    this.conflict = (options.onConflict || tableSpec(this.table).pk.join(",")).split(",").map(c => c.trim()).filter(Boolean);
    this.ignoreDuplicates = Boolean(options.ignoreDuplicates);
    return this;
  }
  update(values: Record<string, unknown>) { this.mode = "update"; this.patch = values; return this; }
  delete() { this.mode = "delete"; return this; }

  // filters
  private compare(column: string, op: string, value: unknown) {
    const params: unknown[] = [];
    const expr = columnExpr(this.table, column, params);
    params.push(expr.json ? JSON.stringify(value) : toDb(expr.type, value));
    // MariaDB has no CAST(... AS JSON); JSON_EXTRACT(?, '$') normalises the compared JSON value instead.
    this.filters.push({ sql: `${expr.sql} ${op} ${expr.json ? "JSON_EXTRACT(?, '$')" : "?"}`, params });
    return this;
  }
  eq(column: string, value: unknown) { return value === null ? this.is(column, null) : this.compare(column, "=", value); }
  neq(column: string, value: unknown) { return this.compare(column, "<>", value); }
  gt(column: string, value: unknown) { return this.compare(column, ">", value); }
  gte(column: string, value: unknown) { return this.compare(column, ">=", value); }
  lt(column: string, value: unknown) { return this.compare(column, "<", value); }
  lte(column: string, value: unknown) { return this.compare(column, "<=", value); }
  in(column: string, values: readonly unknown[]) {
    if (!values.length) { this.filters.push({ sql: "FALSE", params: [] }); return this; }
    const params: unknown[] = [];
    const expr = columnExpr(this.table, column, params);
    this.filters.push({ sql: `${expr.sql} IN (${values.map(() => "?").join(",")})`, params: [...params, ...values.map(v => toDb(expr.type, v))] });
    return this;
  }
  is(column: string, value: null | boolean) {
    const params: unknown[] = [];
    const expr = columnExpr(this.table, column, params);
    this.filters.push({ sql: value === null ? `${expr.sql} IS NULL` : `${expr.sql} = ${value ? 1 : 0}`, params });
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    const params: unknown[] = [];
    const expr = columnExpr(this.table, column, params);
    if (operator === "is") { this.filters.push({ sql: value === null || value === "null" ? `${expr.sql} IS NOT NULL` : `NOT (${expr.sql} <=> ${value === true || value === "true" ? 1 : 0})`, params }); return this; }
    if (operator === "eq") { params.push(toDb(expr.type, value)); this.filters.push({ sql: `NOT (${expr.sql} = ?)`, params }); return this; }
    if (operator === "in") {
      const list = Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, "").split(",").map(v => v.trim().replace(/^"(.*)"$/, "$1"));
      if (!list.length) return this;
      this.filters.push({ sql: `${expr.sql} NOT IN (${list.map(() => "?").join(",")})`, params: [...params, ...list.map(v => toDb(expr.type, v))] });
      return this;
    }
    throw new Error(`Unsupported not() operator ${operator}`);
  }
  match(query: Record<string, unknown>) { for (const [k, v] of Object.entries(query)) this.eq(k, v); return this; }
  filter(column: string, operator: string, value: unknown) {
    const ops: Record<string, (c: string, v: unknown) => this> = { eq: (c, v) => this.eq(c, v), neq: (c, v) => this.neq(c, v), gt: (c, v) => this.gt(c, v), gte: (c, v) => this.gte(c, v), lt: (c, v) => this.lt(c, v), lte: (c, v) => this.lte(c, v), is: (c, v) => this.is(c, v === "null" ? null : v === "true" || v === true) };
    if (!ops[operator]) throw new Error(`Unsupported filter operator ${operator}`);
    return ops[operator](column, value);
  }
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) { this.orders.push({ expr: column, ascending: options.ascending !== false, nullsFirst: options.nullsFirst }); return this; }
  limit(count: number) { this.limitCount = count; return this; }
  range(from: number, to: number) { this.offsetCount = from; this.limitCount = to - from + 1; return this; }
  single() { this.singleMode = "single"; return this as unknown as QueryBuilder<any>; }
  maybeSingle() { this.singleMode = "maybe"; return this as unknown as QueryBuilder<any>; }
  abortSignal(_signal?: AbortSignal) { return this; }
  returns<U>() { return this as unknown as QueryBuilder<U>; }
  throwOnError() { return this; }

  then<R1 = DbResult<T>, R2 = never>(onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null): Promise<R1 | R2> {
    if (!this.promise) this.promise = this.run();
    return this.promise.then(onfulfilled, onrejected);
  }

  // ── execution ─────────────────────────────────────────────────────────────
  private async whereClause(): Promise<Filter> {
    const parts = [...this.filters];
    const scoped = this.scope ? await this.scope(this.table) : null;
    if (scoped) parts.push(scoped.values.length ? { sql: `${q(scoped.column)} IN (${scoped.values.map(() => "?").join(",")})`, params: scoped.values } : { sql: "FALSE", params: [] });
    return { sql: parts.length ? " WHERE " + parts.map(p => `(${p.sql})`).join(" AND ") : "", params: parts.flatMap(p => p.params) };
  }

  private orderClause(params: unknown[]) {
    if (!this.orders.length) return "";
    return " ORDER BY " + this.orders.map(o => {
      const expr = columnExpr(this.table, o.expr, params).sql;
      // Postgres puts NULLs last ascending and first descending; MySQL does the opposite.
      const nullsFirst = o.nullsFirst ?? !o.ascending;
      return `(${expr} IS NULL) ${nullsFirst ? "DESC" : "ASC"}, ${expr} ${o.ascending ? "ASC" : "DESC"}`;
    }).join(", ");
  }

  private async run(): Promise<DbResult<T>> {
    try {
      let rows: Record<string, unknown>[] | null;
      let count: number | null = null;
      if (this.mode === "select") ({ rows, count } = await this.runSelect(getPool()));
      else rows = await transaction(conn => this.runWrite(conn));
      if (this.headOnly) return { data: null as T, error: null, count, status: 200, statusText: "OK" };
      if (this.singleMode) {
        const list = rows || [];
        if (list.length > 1) return failure({ message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: `The result contains ${list.length} rows` }, 406);
        if (!list.length && this.singleMode === "single") return failure({ message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: "The result contains 0 rows" }, 406);
        return { data: (list[0] ?? null) as T, error: null, count, status: 200, statusText: "OK" };
      }
      return { data: rows as T, error: null, count, status: rows === null ? 204 : 200, statusText: "OK" };
    } catch (error) {
      const mapped = mapMysqlError(error);
      if (!(error instanceof DbFailure)) console.error("db_query_failed", this.table, this.mode, mapped.code);
      return failure(mapped, 400);
    }
  }

  private async runSelect(conn: Queryable, extraWhere?: Filter): Promise<{ rows: Record<string, unknown>[]; count: number | null }> {
    const where = await this.whereClause();
    if (extraWhere) { where.sql = where.sql ? `${where.sql} AND (${extraWhere.sql})` : ` WHERE ${extraWhere.sql}`; where.params.push(...extraWhere.params); }
    let count: number | null = null;
    if (this.countMode) {
      const [result] = await conn.query(`SELECT COUNT(*) AS n FROM ${q(this.table)}${where.sql}`, where.params);
      count = Number((result as { n: number }[])[0]?.n || 0);
      if (this.headOnly) return { rows: [], count };
    }
    const rows = await selectRows(conn, this.table, parseSelect(this.selectText || "*"), where, this.orderClause.bind(this), this.limitCount, this.offsetCount);
    return { rows, count };
  }

  private prepareRow(row: Record<string, unknown>) {
    const spec = tableSpec(this.table);
    const out: Record<string, unknown> = { ...row };
    if (spec.uuidPk && spec.pk.length === 1 && (out[spec.pk[0]] === undefined || out[spec.pk[0]] === null)) out[spec.pk[0]] = randomUUID();
    for (const [col, fallback] of Object.entries(spec.jsonDefaults || {})) if (out[col] === undefined) out[col] = fallback;
    for (const [col, make] of Object.entries(spec.defaults || {})) if (out[col] === undefined) out[col] = make();
    for (const key of Object.keys(out)) if (!(key in spec.columns)) throw dbError(`Column ${key} does not exist on ${this.table}.`, "42703");
    return out;
  }

  private async runWrite(conn: PoolConnection): Promise<Record<string, unknown>[] | null> {
    const spec = tableSpec(this.table);
    const items = this.selectText ? parseSelect(this.selectText) : [{ kind: "star" } as SelectItem];
    const pkFilter = (keys: Record<string, unknown>[]): Filter => {
      if (!keys.length) return { sql: "FALSE", params: [] };
      if (spec.pk.length === 1) return { sql: `${q(spec.pk[0])} IN (${keys.map(() => "?").join(",")})`, params: keys.map(k => toDb(spec.columns[spec.pk[0]], k[spec.pk[0]])) };
      return { sql: keys.map(() => "(" + spec.pk.map(c => `${q(c)} = ?`).join(" AND ") + ")").join(" OR "), params: keys.flatMap(k => spec.pk.map(c => toDb(spec.columns[c], k[c]))) };
    };
    const returnRows = async (keys: Record<string, unknown>[]) => this.returning ? selectRows(conn, this.table, items, pkFilter(keys).sql ? { sql: " WHERE " + pkFilter(keys).sql, params: pkFilter(keys).params } : { sql: "", params: [] }, () => "") : null;

    if (this.mode === "insert" || this.mode === "upsert") {
      if (!this.values.length) return this.returning ? [] : null;
      const rows = this.values.map(r => this.prepareRow(r));
      const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
      const placeholders = rows.map(() => "(" + columns.map(() => "?").join(",") + ")").join(",");
      const params = rows.flatMap(r => columns.map(c => r[c] === undefined ? null : toDb(spec.columns[c], r[c])));
      // Columns a row did not supply keep their database default instead of NULL.
      const missing = rows.some(r => columns.some(c => r[c] === undefined));
      if (missing) {
        for (const row of rows) await this.insertOne(conn, row);
      } else {
        let statement = `${this.mode === "upsert" && this.ignoreDuplicates ? "INSERT IGNORE" : "INSERT"} INTO ${q(this.table)} (${columns.map(q).join(",")}) VALUES ${placeholders}`;
        if (this.mode === "upsert" && !this.ignoreDuplicates) {
          const updatable = this.updatableColumns(columns);
          statement += " ON DUPLICATE KEY UPDATE " + (updatable.length ? updatable.map(c => `${q(c)} = VALUES(${q(c)})`).join(", ") : `${q(columns[0])} = ${q(columns[0])}`);
        }
        const [result] = await conn.query(statement, params);
        const header = result as { insertId?: number };
        if (spec.pk[0] === "id" && spec.columns.id === "int" && header.insertId) rows.forEach((r, n) => { if (r.id === undefined) r.id = header.insertId! + n; });
      }
      await this.hooks.afterInsert?.(this.table, rows, conn);
      if (!this.returning) return null;
      if (this.mode === "upsert") {
        // Return the stored rows, matched on the conflict columns.
        const where = rows.map(() => "(" + this.conflict.map(c => `${q(c)} = ?`).join(" AND ") + ")").join(" OR ");
        return selectRows(conn, this.table, items, { sql: " WHERE " + where, params: rows.flatMap(r => this.conflict.map(c => toDb(spec.columns[c], r[c]))) }, () => "");
      }
      return returnRows(rows);
    }

    // update / delete: lock the matching rows first so the change and the returned rows agree.
    const where = await this.whereClause();
    const [locked] = await conn.query(`SELECT ${spec.pk.map(q).join(",")} FROM ${q(this.table)}${where.sql} FOR UPDATE`, where.params);
    const keys = (locked as Record<string, unknown>[]);
    if (!keys.length) return this.returning ? [] : null;
    const target = pkFilter(keys);
    if (this.mode === "delete") {
      const before = this.returning ? await selectRows(conn, this.table, items, { sql: " WHERE " + target.sql, params: target.params }, () => "") : null;
      await conn.query(`DELETE FROM ${q(this.table)} WHERE ${target.sql}`, target.params);
      return before;
    }
    const patch = Object.entries(this.patch).filter(([, v]) => v !== undefined);
    for (const [key] of patch) if (!(key in spec.columns)) throw dbError(`Column ${key} does not exist on ${this.table}.`, "42703");
    if (patch.length) await conn.query(`UPDATE ${q(this.table)} SET ${patch.map(([k]) => `${q(k)} = ?`).join(", ")} WHERE ${target.sql}`, [...patch.map(([k, v]) => toDb(spec.columns[k], v)), ...target.params]);
    return returnRows(keys);
  }

  /**
   * Columns an upsert may overwrite when the row already exists: only what the caller sent,
   * never the primary key, the conflict columns, or values this layer filled in itself
   * (a generated id or default timestamp). Overwriting the id gave an existing row a new id
   * on every save, which broke rows that reference it (e.g. card analytics → Business Card save).
   */
  private updatableColumns(columns: string[]) {
    const spec = tableSpec(this.table);
    const supplied = new Set(this.values.flatMap(v => Object.keys(v).filter(k => v[k] !== undefined)));
    return columns.filter(c => supplied.has(c) && !this.conflict.includes(c) && !spec.pk.includes(c));
  }

  private async insertOne(conn: PoolConnection, row: Record<string, unknown>) {
    const spec = tableSpec(this.table);
    const columns = Object.keys(row).filter(c => row[c] !== undefined);
    let statement = `${this.mode === "upsert" && this.ignoreDuplicates ? "INSERT IGNORE" : "INSERT"} INTO ${q(this.table)} (${columns.map(q).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
    if (this.mode === "upsert" && !this.ignoreDuplicates) {
      const updatable = this.updatableColumns(columns);
      statement += " ON DUPLICATE KEY UPDATE " + (updatable.length ? updatable.map(c => `${q(c)} = VALUES(${q(c)})`).join(", ") : `${q(columns[0])} = ${q(columns[0])}`);
    }
    const [result] = await conn.query(statement, columns.map(c => toDb(spec.columns[c], row[c])));
    const header = result as { insertId?: number };
    if (spec.pk[0] === "id" && spec.columns.id === "int" && row.id === undefined && header.insertId) row.id = header.insertId;
  }
}

function failure(error: DbError, status: number): DbResult<any> {
  return { data: null, error, count: null, status, statusText: error.message };
}

/** Runs a SELECT with column projection, JSON paths and embedded relations. */
async function selectRows(conn: Queryable, table: string, items: SelectItem[], where: Filter, orderClause: (params: unknown[]) => string, limit?: number, offset?: number): Promise<Record<string, unknown>[]> {
  const spec = tableSpec(table);
  const params: unknown[] = [];
  const fields: string[] = [];
  const outputs: { alias: string; type: ColumnType | undefined }[] = [];
  const embeds = items.filter((i): i is EmbedItem => i.kind === "embed");
  const hidden = new Set<string>();
  for (const item of items) {
    if (item.kind === "star") {
      for (const [col, type] of Object.entries(spec.columns)) { fields.push(`${q(col)} AS ${q(col)}`); outputs.push({ alias: col, type }); }
    } else if (item.kind === "column") {
      const expr = columnExpr(table, item.path.length ? `${item.column}${item.path.map(p => (p.text ? "->>" : "->") + p.key).join("")}` : item.column, params);
      fields.push(`${expr.sql} AS ${q(item.alias)}`);
      outputs.push({ alias: item.alias, type: expr.type });
    }
  }
  // Embedded relations need their join column even if the caller did not ask for it.
  const relationFor = (embed: EmbedItem) => {
    const candidates = RELATIONS.filter(r => r.from === table && r.to === embed.table);
    const chosen = embed.hint ? candidates.find(r => r.names.includes(embed.hint!) || r.fromCol === embed.hint) : candidates.length === 1 ? candidates[0] : candidates.find(r => r.fromCol === `${embed.table.replace(/s$/, "")}_id`) || candidates[0];
    if (!chosen) throw dbError(`No relationship between ${table} and ${embed.table}.`, "PGRST200");
    return chosen;
  };
  for (const embed of embeds) {
    const rel = relationFor(embed);
    if (!outputs.some(o => o.alias === rel.fromCol)) { fields.push(`${q(rel.fromCol)} AS ${q(rel.fromCol)}`); outputs.push({ alias: rel.fromCol, type: spec.columns[rel.fromCol] }); hidden.add(rel.fromCol); }
  }
  const allParams = [...params, ...where.params];
  let statement = `SELECT ${fields.join(", ") || "1"} FROM ${q(table)}${where.sql}`;
  statement += orderClause(allParams);
  if (limit !== undefined) statement += ` LIMIT ${Math.max(0, Math.floor(limit))}`;
  if (offset !== undefined) statement += `${limit === undefined ? " LIMIT 18446744073709551615" : ""} OFFSET ${Math.max(0, Math.floor(offset))}`;
  const [raw] = await conn.query(statement, allParams);
  const rows = (raw as Record<string, unknown>[]).map(row => Object.fromEntries(outputs.map(o => [o.alias, fromDb(o.type, row[o.alias])])));

  for (const embed of embeds) {
    const rel = relationFor(embed);
    const keys = [...new Set(rows.map(r => r[rel.fromCol]).filter(v => v !== null && v !== undefined))];
    const childItems = embed.items.some(i => i.kind === "star" || (i.kind === "column" && i.column === rel.toCol && !i.path.length)) ? embed.items : [...embed.items, { kind: "column", alias: `__join_${rel.toCol}`, column: rel.toCol, path: [] } as ColumnItem];
    const children = keys.length ? await selectRows(conn, rel.to, childItems, { sql: ` WHERE ${q(rel.toCol)} IN (${keys.map(() => "?").join(",")})`, params: keys }, () => "") : [];
    const joinKey = childItems.some(i => i.kind === "column" && i.alias === `__join_${rel.toCol}`) ? `__join_${rel.toCol}` : rel.toCol;
    for (const row of rows) {
      const matches = children.filter(c => c[joinKey] === row[rel.fromCol]).map(c => { const copy = { ...c }; delete copy[`__join_${rel.toCol}`]; return copy; });
      row[embed.alias] = rel.many ? matches : matches[0] ?? null;
    }
  }
  for (const row of rows) for (const col of hidden) delete row[col];
  return rows;
}
