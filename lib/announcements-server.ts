import "server-only";
import { randomUUID } from "node:crypto";
import { exec, sql } from "@/lib/db/pool";
import type { Announcement } from "@/lib/announcements";

/*
 * Announcements the master admin sends from the Notification Center. They show
 * under every user's bell next to the built-in ones in lib/announcements.ts.
 * The table creates itself on first use (same SQL as db/mysql/003_announcements.sql).
 */
let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= exec(`CREATE TABLE IF NOT EXISTS app_announcements (
      id CHAR(36) NOT NULL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      signoff VARCHAR(300) NULL,
      link_url VARCHAR(500) NULL,
      link_label VARCHAR(80) NULL,
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY app_announcements_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(() => undefined)
    .catch(error => { ready = null; throw error; });
  return ready;
}

type Row = { id: string; title: string; body: string; signoff: string | null; link_url: string | null; link_label: string | null; created_at: string | Date };

const centralDate = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const asDate = (value: string | Date) => value instanceof Date ? value : new Date(String(value).replace(" ", "T") + (String(value).endsWith("Z") ? "" : "Z"));

function toAnnouncement(row: Row): Announcement {
  const posted = asDate(row.created_at);
  return {
    id: `db-${row.id}`,
    date: centralDate(posted),
    postedAt: posted.toISOString(),
    title: row.title,
    paragraphs: row.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
    signoff: row.signoff ? row.signoff.split("\n").map(line => line.trim()).filter(Boolean) : undefined,
    link: row.link_url ? { url: row.link_url, label: row.link_label || "Open link" } : undefined,
  };
}

export async function listAnnouncements(limit = 50) {
  await ensureTable();
  const rows = await sql<Row>("SELECT id, title, body, signoff, link_url, link_label, created_at FROM app_announcements ORDER BY created_at DESC LIMIT ?", [limit]);
  return rows.map(toAnnouncement);
}

export type NewAnnouncement = { title: string; body: string; signoff?: string; linkUrl?: string; linkLabel?: string };

/** Validates and cleans what the admin typed. Returns an error message, or the clean values. */
export function cleanAnnouncement(input: Record<string, unknown>): NewAnnouncement | string {
  const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
  const title = text(input.title, 160), body = text(input.body, 6000), signoff = text(input.signoff, 300);
  const linkUrl = text(input.linkUrl, 500), linkLabel = text(input.linkLabel, 80);
  if (!title) return "Add a title.";
  if (!body) return "Write a message.";
  if (linkUrl) {
    try { const url = new URL(linkUrl); if (url.protocol !== "https:") return "Links must start with https://"; }
    catch { return "That link isn't a valid web address."; }
  }
  return { title, body, signoff: signoff || undefined, linkUrl: linkUrl || undefined, linkLabel: linkUrl ? (linkLabel || undefined) : undefined };
}

export async function createAnnouncement(value: NewAnnouncement, userId: string) {
  await ensureTable();
  const id = randomUUID();
  await exec("INSERT INTO app_announcements (id, title, body, signoff, link_url, link_label, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, value.title, value.body, value.signoff ?? null, value.linkUrl ?? null, value.linkLabel ?? null, userId]);
  const [row] = await sql<Row>("SELECT id, title, body, signoff, link_url, link_label, created_at FROM app_announcements WHERE id = ?", [id]);
  return toAnnouncement(row);
}

export async function deleteAnnouncement(id: string) {
  await ensureTable();
  const raw = id.replace(/^db-/, "");
  const result = await exec("DELETE FROM app_announcements WHERE id = ?", [raw]);
  return result.affectedRows > 0;
}
