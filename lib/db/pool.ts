import "server-only";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

// One pool per server process. The database runs on the same machine as the
// app (cPanel MariaDB on localhost), so connections are cheap and fast.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_USER || !DB_PASSWORD || !DB_NAME) throw new Error("Missing DB_USER, DB_PASSWORD or DB_NAME.");
    pool = mysql.createPool({
      host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      waitForConnections: true,
      // Times are stored in UTC and returned as strings; schema.ts turns them into ISO strings.
      timezone: "Z",
      dateStrings: true,
      charset: "utf8mb4",
      enableKeepAlive: true,
    });
  }
  return pool;
}

export type Queryable = Pool | PoolConnection;

export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = [], conn: Queryable = getPool()): Promise<T[]> {
  const [rows] = await conn.query(query, params);
  return rows as T[];
}

export async function exec(query: string, params: unknown[] = [], conn: Queryable = getPool()) {
  const [result] = await conn.query(query, params);
  return result as mysql.ResultSetHeader;
}

export async function transaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}
