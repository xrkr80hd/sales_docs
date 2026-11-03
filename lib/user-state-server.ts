import "server-only";
import { exec, sql } from "@/lib/db/pool";

/*
 * Small per-account state that must follow a person across browsers and devices:
 * which version of the terms they agreed to, and which notifications they've read.
 * The table creates itself on first use (same SQL as db/mysql/005_user_state.sql).
 */
let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= exec(`CREATE TABLE IF NOT EXISTS app_user_state (
      user_id CHAR(36) NOT NULL PRIMARY KEY,
      disclosure_version VARCHAR(40) NULL,
      disclosure_accepted_at DATETIME(3) NULL,
      read_announcements TEXT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(() => undefined)
    .catch(error => { ready = null; throw error; });
  return ready;
}

type Row = { disclosure_version: string | null; disclosure_accepted_at: string | null; read_announcements: string | null };
const MAX_READ = 300;
const parseIds = (value: string | null) => { try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-MAX_READ) : []; } catch { return []; } };

export async function getUserState(userId: string) {
  await ensureTable();
  const [row] = await sql<Row>("SELECT disclosure_version, disclosure_accepted_at, read_announcements FROM app_user_state WHERE user_id = ?", [userId]);
  return { disclosureVersion: row?.disclosure_version || null, readAnnouncements: parseIds(row?.read_announcements ?? null) };
}

export async function acceptDisclosure(userId: string, version: string) {
  await ensureTable();
  await exec(`INSERT INTO app_user_state (user_id, disclosure_version, disclosure_accepted_at) VALUES (?, ?, CURRENT_TIMESTAMP(3))
              ON DUPLICATE KEY UPDATE disclosure_version = VALUES(disclosure_version), disclosure_accepted_at = VALUES(disclosure_accepted_at)`, [userId, version.slice(0, 40)]);
}

export async function markRead(userId: string, ids: string[]) {
  await ensureTable();
  const clean = ids.filter(id => typeof id === "string" && id.length > 0 && id.length <= 80).slice(0, 100);
  if (!clean.length) return getUserState(userId).then(s => s.readAnnouncements);
  const { readAnnouncements } = await getUserState(userId);
  const next = [...new Set([...readAnnouncements, ...clean])].slice(-MAX_READ);
  await exec(`INSERT INTO app_user_state (user_id, read_announcements) VALUES (?, ?)
              ON DUPLICATE KEY UPDATE read_announcements = VALUES(read_announcements)`, [userId, JSON.stringify(next)]);
  return next;
}
