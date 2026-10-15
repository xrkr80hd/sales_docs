import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { organizationBranding } from "@/lib/organization-branding";
import { moderateChatText } from "@/lib/chat-moderation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ApiError extends Error { constructor(message: string, public status = 500) { super(message); } }
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new ApiError("Messenger data is unavailable. Please retry.");
  return result.data;
}
async function context(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError("Sign in to use Messenger.", 401);
  const db = getSupabaseServiceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) throw new ApiError("Your session has expired. Sign in again.", 401);
  // Every conversation check runs as the caller, with database RLS enforced.
  const scoped = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const profile = checked(await db.from("profiles").select("role").eq("id", user.id).single());
  const membership = checked(await db.from("organization_memberships").select("*").eq("user_id", user.id).maybeSingle());
  const admin = profile?.role === "admin";
  if (!admin && !membership?.chat_enabled) throw new ApiError("Messenger access has not been enabled for your account.", 403);
  return { db, scoped, user, membership, admin };
}
type Context = Awaited<ReturnType<typeof context>>;
async function conversation(ctx: Context, id: unknown) {
  if (typeof id !== "string" || !uuid.test(id)) throw new ApiError("Choose a valid conversation.", 400);
  const room = checked(await ctx.scoped.from("messenger_conversations").select("id,kind,channel,organization_id").eq("id", id).maybeSingle());
  if (!room) throw new ApiError("Conversation access denied.", 403);
  return room;
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof ApiError ? error.message : "Messenger could not complete this request. Please retry." }, { status: error instanceof ApiError ? error.status : 500 });
}
export async function GET(request: Request) {
  try {
    const ctx = await context(request), { db, scoped, user, membership, admin } = ctx;
    const url = new URL(request.url), id = url.searchParams.get("conversationId");
    if (id) {
      await conversation(ctx, id);
      const before = url.searchParams.get("before");
      if (before && !/^\d+$/.test(before)) throw new ApiError("Invalid history cursor.", 400);
      let query = scoped.from("messenger_messages").select("id,conversation_id,sender_id,body,created_at,edited_at").eq("conversation_id", id).is("deleted_at", null).order("id", { ascending: false }).limit(51);
      if (before) query = query.lt("id", before);
      const rows = checked(await query) || [], more = rows.length > 50, page = rows.slice(0, 50);
      const senderIds = [...new Set(page.map(m => m.sender_id))];
      const senders = senderIds.length ? checked(await db.from("profiles").select("id,display_name").in("id", senderIds)) || [] : [];
      return Response.json({ messages: page.reverse().map(m => ({ ...m, body: moderateChatText(m.body), senderName: senders.find(p => p.id === m.sender_id)?.display_name || "Team member" })), hasMore: more }, { headers: { "Cache-Control": "no-store" } });
    }
    const allowedIds: string[] = checked(await scoped.rpc("messenger_accessible_organizations")) || [];
    const branding = await organizationBranding(db);
    const organizations = allowedIds.length ? checked(await db.from("organizations").select("id,name").in("id", allowedIds).order("name")) || [] : [];
    const members = allowedIds.length ? checked(await db.from("organization_memberships").select("user_id,organization_id,can_dm,chat_nickname").in("organization_id", allowedIds).eq("chat_enabled", true)) || [] : [];
    const conversations = checked(await scoped.from("messenger_conversations").select("id,kind,channel,title,organization_id,updated_at,messenger_participants(user_id,last_read_at)").order("updated_at", { ascending: false })) || [];
    const personIds = [...new Set([...members.map(m => m.user_id), ...conversations.flatMap(c => c.messenger_participants.map(p => p.user_id)), user.id])];
    const profiles = personIds.length ? checked(await db.from("profiles").select("id,display_name,role").in("id", personIds)) || [] : [];
    const people = profiles.map(p => {
      const member = members.find(m => m.user_id === p.id);
      return { user_id: p.id, organization_id: member?.organization_id, name: member?.chat_nickname || p.display_name || "Team member", role: p.role, can_dm: member?.can_dm === true };
    });
    const counts = await Promise.all(conversations.map(async c => {
      const since = c.messenger_participants.find(p => p.user_id === user.id)?.last_read_at || "1970-01-01T00:00:00Z";
      const result = await scoped.from("messenger_messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).neq("sender_id", user.id).is("deleted_at", null).gt("created_at", since);
      if (result.error) throw new ApiError("Unread counts could not be loaded.");
      return { ...c, title: c.kind === "organization" ? c.channel === "management" ? "Management Chat" : "Consultant Chat" : c.title, unread: result.count || 0 };
    }));
    return Response.json({ me: user.id, canCreateOrganization: admin, canDm: admin || membership?.can_dm === true, organizations: organizations.filter(o => !branding[o.id]?.deletedAt).map(o => ({ ...o, iconUrl: branding[o.id]?.iconUrl || "", hideIcon: branding[o.id]?.hideIcon === true })), people, conversations: counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await context(request), { db, scoped, user } = ctx;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.action !== "string") throw new ApiError("Invalid request.", 400);
    if (body.action === "start-dm") {
      if (typeof body.userId !== "string" || !uuid.test(body.userId)) throw new ApiError("Choose a team member.", 400);
      const { data, error } = await scoped.rpc("messenger_start_dm", { other: body.userId });
      if (error) throw new ApiError("You cannot start a direct message with this member.", 403);
      return Response.json({ conversationId: data });
    }
    if (!["send", "mark-read", "edit", "delete", "clear-mine"].includes(body.action)) throw new ApiError("Unknown action.", 400);
    let target;
    if (body.action === "edit" || body.action === "delete") {
      if (!/^\d+$/.test(String(body.messageId))) throw new ApiError("Invalid message.", 400);
      target = checked(await scoped.from("messenger_messages").select("id,sender_id,conversation_id").eq("id", body.messageId).is("deleted_at", null).maybeSingle());
      if (!target || target.sender_id !== user.id) throw new ApiError("You can only change your own accessible messages.", 403);
    }
    const room = await conversation(ctx, target?.conversation_id || body.conversationId);
    if (body.action === "send" || body.action === "edit") {
      if (typeof body.body !== "string" || !body.body.trim() || body.body.trim().length > 4000) throw new ApiError("Use between 1 and 4,000 characters.", 400);
      const text = moderateChatText(body.body.trim());
      if (text.length > 4000) throw new ApiError("Please shorten your message; the language filter expanded it beyond 4,000 characters.", 400);
      if (body.action === "edit") {
        checked(await db.from("messenger_messages").update({ body: text, edited_at: new Date().toISOString() }).eq("id", target!.id).eq("sender_id", user.id));
      } else {
        const message = checked(await db.from("messenger_messages").insert({ conversation_id: room.id, sender_id: user.id, body: text }).select("id,created_at").single());
        // Ordering failure must not turn a successful send into a duplicate on retry.
        await db.from("messenger_conversations").update({ updated_at: message!.created_at }).eq("id", room.id);
        return Response.json({ ok: true, message });
      }
    } else if (body.action === "mark-read") {
      // Mark only through the last message actually displayed, never unseen arrivals.
      if (!/^\d+$/.test(String(body.messageId))) throw new ApiError("A displayed message is required.", 400);
      const last = checked(await scoped.from("messenger_messages").select("created_at").eq("id", body.messageId).eq("conversation_id", room.id).maybeSingle());
      if (!last) throw new ApiError("Message access denied.", 403);
      const { error: readError } = await scoped.rpc("messenger_mark_read", { cid: room.id, mid: body.messageId });
      if (readError) throw new ApiError("Read status could not be saved. Please retry.");
    } else {
      let query = db.from("messenger_messages").update({ deleted_at: new Date().toISOString() }).eq("conversation_id", room.id).eq("sender_id", user.id).is("deleted_at", null);
      if (target) query = query.eq("id", target.id);
      checked(await query);
    }
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
