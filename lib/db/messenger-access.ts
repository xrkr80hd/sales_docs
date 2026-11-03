import "server-only";
import { createHash } from "node:crypto";
import { sql, transaction } from "./pool";
import { toDbTime } from "./query";

/*
 * Messenger privacy rules, moved out of Postgres (messenger_private.* functions
 * and row-level security) into code. Same rules, same order:
 *  - organization channel: caller can see the organization, and is admin or can_org_chat;
 *    the management channel additionally needs admin, sales_manager or the bdm workspace role.
 *  - direct message: caller is a participant and is admin or has chat + DM enabled.
 *  - accounts that must change their password see nothing.
 */
const OWNER_EMAIL = "xrkr80hd@gmail.com";

type Caller = {
  id: string; role: string; workspaceRole: string; mustChangePassword: boolean;
  membership: { organization_id: string; chat_enabled: number; can_dm: number; can_org_chat: number } | null;
};

async function loadCaller(userId: string): Promise<Caller | null> {
  const rows = await sql<{ id: string; role: string; app_metadata: string | null; organization_id: string | null; chat_enabled: number | null; can_dm: number | null; can_org_chat: number | null }>(
    `SELECT p.id, p.role, u.app_metadata, m.organization_id, m.chat_enabled, m.can_dm, m.can_org_chat
       FROM profiles p JOIN app_users u ON u.id = p.id LEFT JOIN organization_memberships m ON m.user_id = p.id
      WHERE p.id = ?`, [userId]);
  const row = rows[0];
  if (!row) return null;
  let meta: Record<string, unknown> = {};
  try { meta = row.app_metadata ? JSON.parse(row.app_metadata) : {}; } catch { meta = {}; }
  return {
    id: row.id, role: row.role,
    workspaceRole: typeof meta.workspace_role === "string" ? meta.workspace_role : "",
    mustChangePassword: meta.must_change_password === true,
    membership: row.organization_id ? { organization_id: row.organization_id, chat_enabled: Number(row.chat_enabled), can_dm: Number(row.can_dm), can_org_chat: Number(row.can_org_chat) } : null,
  };
}

async function deletedOrganizations(): Promise<Set<string>> {
  const rows = await sql<{ branding: string | null }>(
    `SELECT JSON_EXTRACT(s.dealer_info, '$.organizationBranding') AS branding
       FROM user_settings s JOIN app_users u ON u.id = s.user_id WHERE LOWER(u.email) = ?`, [OWNER_EMAIL]);
  const deleted = new Set<string>();
  try {
    const branding = rows[0]?.branding ? JSON.parse(rows[0].branding) as Record<string, { deletedAt?: string }> : {};
    for (const [id, value] of Object.entries(branding)) if (value?.deletedAt) deleted.add(id);
  } catch { /* unreadable branding means nothing is marked deleted */ }
  return deleted;
}

function organizationAccess(caller: Caller, org: string, management: boolean, existing: Set<string>, deleted: Set<string>) {
  if (caller.mustChangePassword || !existing.has(org) || deleted.has(org)) return false;
  const m = caller.membership;
  const member = caller.role === "admin" || Boolean(m?.chat_enabled && (m.organization_id === org || (caller.role === "sales_manager" && caller.workspaceRole === "district_manager")));
  if (!member) return false;
  return !management || caller.role === "admin" || caller.role === "sales_manager" || caller.workspaceRole === "bdm";
}

export type MessengerAccess = { organizations: string[]; conversations: string[]; caller: Caller | null };

/** Everything this user may read in Messenger, computed once per request. */
export async function messengerAccess(userId: string): Promise<MessengerAccess> {
  const caller = await loadCaller(userId);
  if (!caller) return { organizations: [], conversations: [], caller: null };
  const [orgRows, deleted] = await Promise.all([sql<{ id: string }>("SELECT id FROM organizations"), deletedOrganizations()]);
  const existing = new Set(orgRows.map(r => r.id));
  const organizations = orgRows.map(r => r.id).filter(id => organizationAccess(caller, id, false, existing, deleted));
  const conversations: string[] = [];
  const canOrgChat = caller.role === "admin" || Boolean(caller.membership?.can_org_chat);
  if (canOrgChat) {
    const rooms = await sql<{ id: string; organization_id: string; channel: string }>("SELECT id, organization_id, channel FROM messenger_conversations WHERE kind = 'organization'");
    for (const room of rooms) if (organizationAccess(caller, room.organization_id, room.channel === "management", existing, deleted)) conversations.push(room.id);
  }
  const canDm = !caller.mustChangePassword && (caller.role === "admin" || Boolean(caller.membership?.chat_enabled && caller.membership.can_dm));
  if (canDm) {
    const dms = await sql<{ id: string }>("SELECT c.id FROM messenger_conversations c JOIN messenger_participants mp ON mp.conversation_id = c.id WHERE c.kind = 'dm' AND mp.user_id = ?", [userId]);
    conversations.push(...dms.map(r => r.id));
  }
  return { organizations, conversations, caller };
}

class AccessDenied extends Error { code = "42501"; }

/** messenger_start_dm: returns the DM conversation id, creating it if needed. */
export async function startDirectMessage(userId: string, other: string): Promise<string> {
  if (!other || userId === other) throw new AccessDenied("Direct-message access denied");
  const caller = await loadCaller(userId);
  if (!caller || caller.mustChangePassword || !caller.membership) throw new AccessDenied("Direct-message access denied");
  if (!(caller.role === "admin" || (caller.membership.chat_enabled && caller.membership.can_dm))) throw new AccessDenied("Direct-message access denied");
  const [target] = await sql<{ organization_id: string }>(
    "SELECT m.organization_id FROM organization_memberships m JOIN profiles p ON p.id = m.user_id WHERE m.user_id = ? AND m.chat_enabled = 1 AND m.can_dm = 1", [other]);
  const access = await messengerAccess(userId);
  if (!target || !access.organizations.includes(target.organization_id)) throw new AccessDenied("Direct-message access denied");
  const key = `walker:${[userId, other].sort().join(":")}`;
  return transaction(async conn => {
    // Same key → same lock, so two people opening a DM at once get one conversation.
    const lockName = "dm:" + createHash("sha1").update(key).digest("hex");
    await conn.query("SELECT GET_LOCK(?, 5)", [lockName]);
    try {
      const [found] = await conn.query("SELECT id FROM messenger_conversations WHERE dm_key = ?", [key]);
      const existing = (found as { id: string }[])[0]?.id;
      if (existing) {
        if (!access.conversations.includes(existing)) throw new AccessDenied("Direct-message access denied");
        return existing;
      }
      const id = crypto.randomUUID();
      await conn.query("INSERT INTO messenger_conversations (id, organization_id, kind, dm_key, created_by) VALUES (?, ?, 'dm', ?, ?)", [id, caller.membership!.organization_id, key, userId]);
      await conn.query("INSERT INTO messenger_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)", [id, userId, id, other]);
      return id;
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [lockName]);
    }
  });
}

/** messenger_mark_read: read position only moves forward. */
export async function markRead(userId: string, conversationId: string, messageId: string | number) {
  const access = await messengerAccess(userId);
  if (!access.conversations.includes(conversationId)) throw new AccessDenied("Conversation access denied");
  const [message] = await sql<{ created_at: string }>("SELECT created_at FROM messenger_messages WHERE id = ? AND conversation_id = ?", [messageId, conversationId]);
  if (!message) throw new AccessDenied("Message access denied");
  const stamp = toDbTime(message.created_at);
  await sql(`INSERT INTO messenger_participants (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE last_read_at = GREATEST(last_read_at, VALUES(last_read_at))`, [conversationId, userId, stamp]);
}
