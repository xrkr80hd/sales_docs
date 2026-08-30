import { getSupabaseServiceClient } from "@/lib/supabase-server";

async function currentUser(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseServiceClient();
  const { data: membership, error } = await db.from("organization_memberships")
    .select("organization_id,chat_enabled,can_dm,can_org_chat,organizations(name)").eq("user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!membership?.chat_enabled) return Response.json({ membership, conversations: [], people: [], messages: [] });
  const [{ data: people }, { data: conversations }] = await Promise.all([
    db.from("organization_memberships").select("user_id,profiles(display_name)").eq("organization_id", membership.organization_id).eq("chat_enabled", true),
    db.from("messenger_conversations").select("id,kind,title,updated_at,messenger_participants(user_id,last_read_at)").eq("organization_id", membership.organization_id).order("updated_at", { ascending: false }),
  ]);
  const ids = (conversations ?? []).filter((c: any) => c.kind === "organization" || c.messenger_participants?.some((p: any) => p.user_id === user.id)).map((c: any) => c.id);
  const { data: messages } = ids.length ? await db.from("messenger_messages").select("id,conversation_id,sender_id,body,created_at,edited_at,profiles(display_name)").in("conversation_id", ids).is("deleted_at", null).order("created_at") : { data: [] };
  return Response.json({ membership, people: people ?? [], conversations: (conversations ?? []).filter((c: any) => ids.includes(c.id)), messages: messages ?? [], me: user.id });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const db = getSupabaseServiceClient();
  const { data: mine } = await db.from("organization_memberships").select("*").eq("user_id", user.id).maybeSingle();
  if (!mine?.chat_enabled) return Response.json({ error: "Messenger access has not been enabled." }, { status: 403 });
  if (body.action === "start-dm") {
    if (!mine.can_dm) return Response.json({ error: "DM permission is not enabled." }, { status: 403 });
    const { data: other } = await db.from("organization_memberships").select("*").eq("user_id", body.userId).eq("organization_id", mine.organization_id).maybeSingle();
    if (!other?.chat_enabled || !other.can_dm) return Response.json({ error: "That member cannot receive DMs." }, { status: 403 });
    const users = [user.id, body.userId].sort(); const dmKey = `${mine.organization_id}:${users.join(":")}`;
    let { data: convo } = await db.from("messenger_conversations").select("id").eq("dm_key", dmKey).maybeSingle();
    if (!convo) {
      const created = await db.from("messenger_conversations").insert({ organization_id: mine.organization_id, kind: "dm", dm_key: dmKey, created_by: user.id }).select("id").single();
      if (created.error) return Response.json({ error: created.error.message }, { status: 500 });
      convo = created.data;
      await db.from("messenger_participants").insert(users.map((id) => ({ conversation_id: convo!.id, user_id: id })));
    }
    return Response.json({ conversationId: convo.id });
  }
  if (body.action === "send") {
    const text = String(body.body ?? "").trim(); if (!text) return Response.json({ error: "Message is empty." }, { status: 400 });
    const { data: convo } = await db.from("messenger_conversations").select("*").eq("id", body.conversationId).eq("organization_id", mine.organization_id).single();
    if (!convo || (convo.kind === "organization" && !mine.can_org_chat)) return Response.json({ error: "You cannot post here." }, { status: 403 });
    if (convo.kind === "dm") { const { data: p } = await db.from("messenger_participants").select("user_id").eq("conversation_id", convo.id).eq("user_id", user.id).maybeSingle(); if (!p) return Response.json({ error: "Forbidden" }, { status: 403 }); }
    const { error } = await db.from("messenger_messages").insert({ conversation_id: convo.id, sender_id: user.id, body: text });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await db.from("messenger_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
