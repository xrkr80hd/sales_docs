import "server-only";
import { randomUUID } from "node:crypto";
import { exec, sql } from "@/lib/db/pool";

/*
 * Support tickets. Anyone signed in (any role, any organization) can submit one;
 * the master admin reads and resolves them. The table creates itself on first use
 * (same SQL as db/mysql/004_tickets.sql).
 */
export const TICKET_CATEGORIES = ["problem", "idea", "question", "account"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type TicketCategory = typeof TICKET_CATEGORIES[number];
export type TicketStatus = typeof TICKET_STATUSES[number];
export type Ticket = {
  id: string; userId: string; name: string; email: string; role: string; organization: string;
  category: TicketCategory; subject: string; details: string; page: string;
  status: TicketStatus; adminNote: string; createdAt: string; updatedAt: string;
};

let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= exec(`CREATE TABLE IF NOT EXISTS app_tickets (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      user_name VARCHAR(255) NULL,
      user_email VARCHAR(320) NULL,
      user_role VARCHAR(40) NULL,
      organization_name VARCHAR(255) NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'problem',
      subject VARCHAR(160) NOT NULL,
      details TEXT NOT NULL,
      page VARCHAR(300) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      admin_note TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY app_tickets_user (user_id, created_at),
      KEY app_tickets_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(() => undefined)
    .catch(error => { ready = null; throw error; });
  return ready;
}

type Row = { id: string; user_id: string; user_name: string | null; user_email: string | null; user_role: string | null; organization_name: string | null; category: string; subject: string; details: string; page: string | null; status: string; admin_note: string | null; created_at: string; updated_at: string };
const iso = (value: string) => new Date(String(value).replace(" ", "T") + (String(value).endsWith("Z") ? "" : "Z")).toISOString();
const toTicket = (r: Row): Ticket => ({
  id: r.id, userId: r.user_id, name: r.user_name || "", email: r.user_email || "", role: r.user_role || "user", organization: r.organization_name || "",
  category: (TICKET_CATEGORIES as readonly string[]).includes(r.category) ? r.category as TicketCategory : "problem",
  subject: r.subject, details: r.details, page: r.page || "",
  status: (TICKET_STATUSES as readonly string[]).includes(r.status) ? r.status as TicketStatus : "open",
  adminNote: r.admin_note || "", createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const COLUMNS = "id, user_id, user_name, user_email, user_role, organization_name, category, subject, details, page, status, admin_note, created_at, updated_at";

export async function listTickets(options: { userId?: string; limit?: number } = {}) {
  await ensureTable();
  const rows = options.userId
    ? await sql<Row>(`SELECT ${COLUMNS} FROM app_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [options.userId, options.limit ?? 50])
    : await sql<Row>(`SELECT ${COLUMNS} FROM app_tickets ORDER BY FIELD(status, 'open', 'in_progress', 'resolved'), created_at DESC LIMIT ?`, [options.limit ?? 300]);
  return rows.map(toTicket);
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";

export async function createTicket(userId: string, input: Record<string, unknown>) {
  const subject = text(input.subject, 160), details = text(input.details, 6000), page = text(input.page, 300);
  const category = (TICKET_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : "problem";
  if (!subject) return "Add a short subject.";
  if (!details) return "Tell us what happened or what you need.";
  await ensureTable();
  // Who sent it, captured on the server so it can't be faked.
  const [who] = await sql<{ email: string | null; display_name: string | null; role: string | null; organization: string | null }>(
    `SELECT u.email, p.display_name, p.role, o.name AS organization FROM app_users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN organization_memberships m ON m.user_id = u.id
       LEFT JOIN organizations o ON o.id = m.organization_id
      WHERE u.id = ? LIMIT 1`, [userId]);
  const id = randomUUID();
  await exec(`INSERT INTO app_tickets (id, user_id, user_name, user_email, user_role, organization_name, category, subject, details, page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, who?.display_name ?? null, who?.email ?? null, who?.role ?? null, who?.organization ?? null, category, subject, details, page || null]);
  const [row] = await sql<Row>(`SELECT ${COLUMNS} FROM app_tickets WHERE id = ?`, [id]);
  return toTicket(row);
}

export async function updateTicket(input: Record<string, unknown>) {
  const id = text(input.id, 36);
  const status = (TICKET_STATUSES as readonly string[]).includes(String(input.status)) ? String(input.status) : null;
  if (!id || !status) return "Missing ticket or status.";
  await ensureTable();
  await exec("UPDATE app_tickets SET status = ?, admin_note = ? WHERE id = ?", [status, text(input.adminNote, 4000) || null, id]);
  const [row] = await sql<Row>(`SELECT ${COLUMNS} FROM app_tickets WHERE id = ?`, [id]);
  return row ? toTicket(row) : "That ticket no longer exists.";
}
