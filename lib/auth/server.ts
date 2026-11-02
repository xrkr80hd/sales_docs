import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PoolConnection } from "mysql2/promise";
import { exec, sql, transaction } from "@/lib/db/pool";
import { toIso } from "@/lib/db/query";
import { sendMail } from "@/lib/mail";

/*
 * Accounts and sessions on MySQL, replacing Supabase Auth.
 * - Passwords: bcrypt. Supabase stored bcrypt too, so migrated passwords keep working.
 * - Sessions: a random token given to the browser; only its SHA-256 is stored.
 *   Lookups are one indexed query on the local database, with no network hop.
 * The method names and return shapes mirror what the app already called.
 */
export const OWNER_EMAIL = "xrkr80hd@gmail.com";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string; email: string; aud: "authenticated"; role: "authenticated";
  app_metadata: Record<string, any>; user_metadata: Record<string, any>;
  email_confirmed_at: string | null; created_at: string; updated_at: string; last_sign_in_at: string | null;
};
export type AuthError = { message: string; status: number; code?: string; name: "AuthError" };
export type Session = { access_token: string; refresh_token: string; token_type: "bearer"; expires_in: number; expires_at: number; user: AuthUser };

export const authError = (message: string, status: number, code?: string): AuthError => ({ message, status, code, name: "AuthError" });
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const parse = (value: unknown) => { if (!value) return {}; if (typeof value !== "string") return value as Record<string, any>; try { return JSON.parse(value) || {}; } catch { return {}; } };

type UserRow = { id: string; email: string; encrypted_password: string | null; email_confirmed_at: string | null; app_metadata: string | null; user_metadata: string | null; created_at: string; updated_at: string; last_sign_in_at: string | null };
export function toUser(row: UserRow): AuthUser {
  return {
    id: row.id, email: row.email, aud: "authenticated", role: "authenticated",
    app_metadata: parse(row.app_metadata), user_metadata: parse(row.user_metadata),
    email_confirmed_at: toIso(row.email_confirmed_at), created_at: toIso(row.created_at)!, updated_at: toIso(row.updated_at)!, last_sign_in_at: toIso(row.last_sign_in_at),
  };
}

async function findUser(where: string, value: unknown) {
  const rows = await sql<UserRow>(`SELECT * FROM app_users WHERE ${where} LIMIT 1`, [value]);
  return rows[0] || null;
}

// ── sessions ────────────────────────────────────────────────────────────────
export async function createSession(user: AuthUser): Promise<Session> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await exec("INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), user.id, expires.toISOString().replace("T", " ").replace("Z", "")]);
  await exec("UPDATE app_users SET last_sign_in_at = UTC_TIMESTAMP(6) WHERE id = ?", [user.id]);
  return { access_token: token, refresh_token: token, token_type: "bearer", expires_in: SESSION_DAYS * 86400, expires_at: Math.floor(expires.getTime() / 1000), user };
}

/** Resolves a session token to its user. Extends the session at most once an hour. */
export async function getUser(token?: string | null): Promise<{ data: { user: AuthUser | null }; error: AuthError | null }> {
  if (!token) return { data: { user: null }, error: authError("Auth session missing!", 401, "session_not_found") };
  try {
    const hash = hashToken(token);
    const rows = await sql<UserRow & { expires_at: string; last_seen_at: string }>(
      `SELECT u.*, s.expires_at, s.last_seen_at FROM app_sessions s JOIN app_users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(6) LIMIT 1`, [hash]);
    const row = rows[0];
    if (!row) return { data: { user: null }, error: authError("Invalid or expired session. Sign in again.", 401, "session_expired") };
    if (Date.now() - new Date(toIso(row.last_seen_at)!).getTime() > 3600e3) {
      void exec(`UPDATE app_sessions SET last_seen_at = UTC_TIMESTAMP(6), expires_at = UTC_TIMESTAMP(6) + INTERVAL ${SESSION_DAYS} DAY WHERE token_hash = ?`, [hash]).catch(() => undefined);
    }
    return { data: { user: toUser(row) }, error: null };
  } catch {
    return { data: { user: null }, error: authError("Account verification is temporarily unavailable.", 503) };
  }
}

export async function signOut(token: string) {
  await exec("DELETE FROM app_sessions WHERE token_hash = ?", [hashToken(token)]);
}

let dummy: string | undefined;
const dummyHash = () => (dummy ??= bcrypt.hashSync("not-a-real-password", 10));

export async function signInWithPassword(email: string, password: string): Promise<{ session: Session | null; error: AuthError | null }> {
  const row = await findUser("email = ?", email.trim().toLowerCase());
  // Same message either way, so the form never reveals which emails exist.
  const invalid = authError("Invalid login credentials", 400, "invalid_credentials");
  // Unknown emails still pay for one bcrypt check, so timing doesn't reveal which accounts exist.
  if (!row?.encrypted_password) { await bcrypt.compare(password, dummyHash()); return { session: null, error: invalid }; }
  if (!(await bcrypt.compare(password, row.encrypted_password))) return { session: null, error: invalid };
  if (!row.email_confirmed_at) return { session: null, error: authError("Email not confirmed", 400, "email_not_confirmed") };
  return { session: await createSession(toUser(row)), error: null };
}

// ── password reset and invites ──────────────────────────────────────────────
export function appUrl() { return (process.env.APP_URL || "https://nextdox.app").replace(/\/$/, ""); }

/** Only links back into this app are allowed, so a reset email can never send someone elsewhere. */
function safeRedirect(redirectTo: string | undefined) {
  const base = appUrl();
  if (!redirectTo) return `${base}/auth/callback?type=recovery`;
  try { const url = new URL(redirectTo, base); return url.origin === new URL(base).origin ? url.toString() : `${base}/auth/callback?type=recovery`; }
  catch { return `${base}/auth/callback?type=recovery`; }
}

async function createResetLink(userId: string, redirectTo: string | undefined, hours: number) {
  const token = randomBytes(32).toString("base64url");
  await exec("INSERT INTO app_password_resets (token_hash, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP(6) + INTERVAL ? HOUR)", [hashToken(token), userId, hours]);
  const url = new URL(safeRedirect(redirectTo));
  url.searchParams.set("type", "recovery");
  url.hash = `recovery_token=${token}`;
  return url.toString();
}

export async function sendPasswordReset(email: string, redirectTo?: string) {
  const row = await findUser("email = ?", email.trim().toLowerCase());
  if (!row) return; // never reveal whether an email is registered
  const link = await createResetLink(row.id, redirectTo, 2);
  await sendMail({
    to: row.email, subject: "Reset your NXTDOX password",
    text: `Someone asked to reset the password for your NXTDOX account.\n\nSet a new password here (this link works for 2 hours):\n${link}\n\nIf this wasn't you, you can ignore this email.`,
  });
}

/** Trades a one-time reset link for a session that can set a new password. */
export async function exchangeRecoveryToken(token: string): Promise<{ session: Session | null; error: AuthError | null }> {
  const hash = hashToken(token);
  const rows = await sql<{ user_id: string }>("SELECT user_id FROM app_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(6)", [hash]);
  if (!rows[0]) return { session: null, error: authError("This link has expired or was already used. Request a new one.", 400, "otp_expired") };
  await exec("UPDATE app_password_resets SET used_at = UTC_TIMESTAMP(6) WHERE token_hash = ?", [hash]);
  // Opening the emailed link proves the address.
  await exec("UPDATE app_users SET email_confirmed_at = COALESCE(email_confirmed_at, UTC_TIMESTAMP(6)) WHERE id = ?", [rows[0].user_id]);
  const row = await findUser("id = ?", rows[0].user_id);
  if (!row) return { session: null, error: authError("Account not found.", 404) };
  return { session: await createSession(toUser(row)), error: null };
}

export async function setPassword(userId: string, password: string, appMetadataPatch?: Record<string, unknown>) {
  if (password.length < 6) throw authError("Password should be at least 6 characters.", 422, "weak_password");
  const hash = await bcrypt.hash(password, 10);
  if (appMetadataPatch) {
    const row = await findUser("id = ?", userId);
    await exec("UPDATE app_users SET encrypted_password = ?, app_metadata = ? WHERE id = ?", [hash, JSON.stringify({ ...parse(row?.app_metadata), ...appMetadataPatch }), userId]);
  } else {
    await exec("UPDATE app_users SET encrypted_password = ? WHERE id = ?", [hash, userId]);
  }
}

// ── new accounts (replaces the handle_new_user trigger) ─────────────────────
async function provisionNewUser(conn: PoolConnection, id: string, email: string, userMetadata: Record<string, any>) {
  const lower = email.toLowerCase();
  const special = lower === OWNER_EMAIL || lower.includes("goff");
  let role = "user";
  if (lower === OWNER_EMAIL) role = "admin";
  else {
    const [invite] = await conn.query("SELECT role FROM invites WHERE LOWER(email) = ? AND accepted_at IS NULL AND expires_at > UTC_TIMESTAMP(6) ORDER BY created_at DESC LIMIT 1", [lower]);
    role = (invite as { role: string }[])[0]?.role || "user";
  }
  const local = lower.split("@")[0];
  await conn.query("INSERT INTO profiles (id, role, display_name, username, card_enabled) VALUES (?, ?, ?, ?, ?)", [id, role, typeof userMetadata.display_name === "string" && userMetadata.display_name ? userMetadata.display_name : email.split("@")[0], local, special ? 1 : 0]);
  await conn.query("UPDATE invites SET accepted_at = UTC_TIMESTAMP(6) WHERE LOWER(email) = ? AND accepted_at IS NULL", [lower]);
  if (special) {
    await conn.query(`INSERT INTO organization_memberships (organization_id, user_id, chat_enabled, can_dm, can_org_chat)
      SELECT id, ?, 1, 1, 1 FROM organizations ORDER BY (slug = 'walker-automotive') DESC, name LIMIT 1
      ON DUPLICATE KEY UPDATE chat_enabled = 1, can_dm = 1, can_org_chat = 1, updated_at = UTC_TIMESTAMP(6)`, [id]);
  }
}

type CreateUserInput = { email: string; password?: string; email_confirm?: boolean; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> };
export async function createUser(input: CreateUserInput): Promise<{ data: { user: AuthUser | null }; error: AuthError | null }> {
  const email = input.email.trim().toLowerCase();
  if (await findUser("email = ?", email)) return { data: { user: null }, error: authError("A user with this email address has already been registered", 422, "email_exists") };
  const id = randomUUID();
  const hash = input.password ? await bcrypt.hash(input.password, 10) : null;
  try {
    await transaction(async conn => {
      await conn.query("INSERT INTO app_users (id, email, encrypted_password, email_confirmed_at, app_metadata, user_metadata) VALUES (?, ?, ?, ?, ?, ?)",
        [id, email, hash, input.email_confirm ? new Date().toISOString().replace("T", " ").replace("Z", "") : null, JSON.stringify({ provider: "email", providers: ["email"], ...(input.app_metadata || {}) }), JSON.stringify(input.user_metadata || {})]);
      await provisionNewUser(conn, id, email, input.user_metadata || {});
    });
  } catch (error) {
    console.error("auth_create_user_failed");
    return { data: { user: null }, error: authError("Could not create the account.", 500) };
  }
  return { data: { user: toUser((await findUser("id = ?", id))!) }, error: null };
}

export async function inviteUserByEmail(email: string, options: { data?: Record<string, any>; redirectTo?: string } = {}) {
  const lower = email.trim().toLowerCase();
  const existing = await findUser("email = ?", lower);
  const created = existing ? { data: { user: toUser(existing) }, error: null } : await createUser({ email: lower, user_metadata: options.data || {} });
  if (created.error || !created.data.user) return created;
  const link = await createResetLink(created.data.user.id, `${appUrl()}/auth/callback?type=recovery`, 24 * 7);
  try {
    await sendMail({
      to: lower, subject: "You're invited to NXTDOX",
      text: `You've been invited to NXTDOX.\n\nSet your password to get started (this link works for 7 days):\n${link}`,
    });
  } catch {
    return { data: { user: created.data.user }, error: authError("The account was created, but the invitation email could not be sent.", 500) };
  }
  return created;
}

// ── admin API (same names Supabase used) ────────────────────────────────────
export const admin = {
  async getUserById(id: string) {
    const row = await findUser("id = ?", id);
    return row ? { data: { user: toUser(row) }, error: null } : { data: { user: null }, error: authError("User not found", 404, "user_not_found") };
  },
  async listUsers(options: { page?: number; perPage?: number } = {}) {
    const perPage = Math.min(Math.max(options.perPage || 50, 1), 1000), page = Math.max(options.page || 1, 1);
    const rows = await sql<UserRow>("SELECT * FROM app_users ORDER BY created_at LIMIT ? OFFSET ?", [perPage, (page - 1) * perPage]);
    const [{ n }] = await sql<{ n: number }>("SELECT COUNT(*) AS n FROM app_users");
    return { data: { users: rows.map(toUser), aud: "authenticated", total: Number(n), nextPage: page * perPage < Number(n) ? page + 1 : null, lastPage: Math.ceil(Number(n) / perPage) }, error: null };
  },
  async updateUserById(id: string, attrs: { email?: string; password?: string; email_confirm?: boolean; app_metadata?: Record<string, any>; user_metadata?: Record<string, any>; ban_duration?: string }) {
    const row = await findUser("id = ?", id);
    if (!row) return { data: { user: null }, error: authError("User not found", 404, "user_not_found") };
    const sets: string[] = [], params: unknown[] = [];
    if (attrs.email) { sets.push("email = ?"); params.push(attrs.email.trim().toLowerCase()); }
    if (attrs.password) { if (attrs.password.length < 6) return { data: { user: null }, error: authError("Password should be at least 6 characters.", 422, "weak_password") }; sets.push("encrypted_password = ?"); params.push(await bcrypt.hash(attrs.password, 10)); }
    if (attrs.email_confirm) sets.push("email_confirmed_at = COALESCE(email_confirmed_at, UTC_TIMESTAMP(6))");
    // Supabase merges metadata on update; so do we.
    if (attrs.app_metadata) { sets.push("app_metadata = ?"); params.push(JSON.stringify({ ...parse(row.app_metadata), ...attrs.app_metadata })); }
    if (attrs.user_metadata) { sets.push("user_metadata = ?"); params.push(JSON.stringify({ ...parse(row.user_metadata), ...attrs.user_metadata })); }
    if (sets.length) await exec(`UPDATE app_users SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    return { data: { user: toUser((await findUser("id = ?", id))!) }, error: null };
  },
  async deleteUser(id: string) {
    const result = await exec("DELETE FROM app_users WHERE id = ?", [id]);
    return result.affectedRows ? { data: { user: null }, error: null } : { data: { user: null }, error: authError("User not found", 404, "user_not_found") };
  },
  createUser,
  inviteUserByEmail,
};
