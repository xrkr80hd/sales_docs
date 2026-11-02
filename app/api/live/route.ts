import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { messengerAccess } from "@/lib/db/messenger-access";
import { exec, sql } from "@/lib/db/pool";
import { toDbTime, toIso } from "@/lib/db/query";
import { bearer, noStore } from "@/lib/auth/http";

/*
 * One light request that replaces Supabase Realtime: returns new or changed
 * Messenger messages the caller may see, board-update counters, and who is
 * online. The browser calls it every few seconds while the page is visible.
 */
const accessCache = new Map<string, { at: number; conversations: string[] }>();
async function allowedConversations(userId: string) {
  const cached = accessCache.get(userId);
  if (cached && Date.now() - cached.at < 20000) return cached.conversations;
  const { conversations } = await messengerAccess(userId);
  accessCache.set(userId, { at: Date.now(), conversations });
  if (accessCache.size > 2000) accessCache.delete(accessCache.keys().next().value!);
  return conversations;
}

const validKey = (key: unknown): key is string => typeof key === "string" && key.length <= 191 && /^[\w:.-]+$/.test(key);

export async function POST(request: Request) {
  const db = getSupabaseServiceClient();
  const { data: { user } } = await db.auth.getUser(bearer(request));
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => ({})) as { conversations?: unknown; since?: unknown; broadcasts?: unknown; presence?: unknown; broadcast?: unknown };

  try {
    // A save elsewhere bumps a counter; other open screens see the new number and reload.
    if (validKey(body.broadcast)) {
      await exec("INSERT INTO app_live_events (channel, version) VALUES (?, 1) ON DUPLICATE KEY UPDATE version = version + 1, updated_at = UTC_TIMESTAMP(6)", [body.broadcast]);
      return Response.json({ ok: true }, { headers: noStore });
    }

    const [{ now }] = await sql<{ now: string }>("SELECT UTC_TIMESTAMP(6) AS now");
    const result: { now: string | null; messages: Record<string, unknown>[]; broadcasts: Record<string, number>; online?: string[] } = { now: toIso(now), messages: [], broadcasts: {} };

    const requested = Array.isArray(body.conversations) ? body.conversations.filter((c): c is string => typeof c === "string").slice(0, 200) : [];
    const since = typeof body.since === "string" ? toDbTime(body.since) : null;
    if (requested.length && since) {
      const allowed = await allowedConversations(user.id);
      const ids = requested.includes("*") ? allowed : requested.filter(id => allowed.includes(id));
      if (ids.length) {
        // A two-second overlap guards against clock edges; the browser ignores repeats.
        const rows = await sql<Record<string, unknown>>(
          `SELECT id, conversation_id, sender_id, body, created_at, edited_at, deleted_at,
                  created_at > (? - INTERVAL 2 SECOND) AS is_new
             FROM messenger_messages
            WHERE conversation_id IN (${ids.map(() => "?").join(",")})
              AND (created_at > (? - INTERVAL 2 SECOND) OR edited_at > (? - INTERVAL 2 SECOND) OR deleted_at > (? - INTERVAL 2 SECOND))
            ORDER BY id LIMIT 200`, [since, ...ids, since, since, since]);
        result.messages = rows.map(r => ({ id: Number(r.id), conversation_id: r.conversation_id, sender_id: r.sender_id, body: r.body, created_at: toIso(r.created_at), edited_at: toIso(r.edited_at), deleted_at: toIso(r.deleted_at), __insert: Number(r.is_new) === 1 }));
      }
    }

    const keys = Array.isArray(body.broadcasts) ? body.broadcasts.filter(validKey).slice(0, 50) : [];
    if (keys.length) {
      const rows = await sql<{ channel: string; version: number }>(`SELECT channel, version FROM app_live_events WHERE channel IN (${keys.map(() => "?").join(",")})`, keys);
      for (const key of keys) result.broadcasts[key] = Number(rows.find(r => r.channel === key)?.version || 0);
    }

    if (body.presence === true) {
      await exec("INSERT INTO messenger_presence (user_id, last_seen_at) VALUES (?, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE last_seen_at = UTC_TIMESTAMP(6)", [user.id]);
      const online = await sql<{ user_id: string }>("SELECT user_id FROM messenger_presence WHERE last_seen_at > UTC_TIMESTAMP(6) - INTERVAL 45 SECOND");
      result.online = online.map(r => r.user_id);
    }
    return Response.json(result, { headers: noStore });
  } catch {
    return Response.json({ error: "Live updates are temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
