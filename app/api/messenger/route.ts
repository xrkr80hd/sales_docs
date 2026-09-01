/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseServiceClient } from "@/lib/supabase-server";

async function currentUser(request: Request) {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
    return { id: "local-xrkr80hd", email: "xrkr80hd@gmail.com" };
  }
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase.auth.getUser(token);
    return data.user ?? null;
  } catch {
    return null;
  }
}

// Local in-memory store for fallback/dev environments
const localStore = {
  conversations: [
    {
      id: "org-chat-1",
      kind: "organization",
      title: "Walker Automotive Team Chat",
      updated_at: new Date().toISOString(),
      messenger_participants: [
        { user_id: "local-xrkr80hd", last_read_at: new Date().toISOString() },
        { user_id: "donald-goff", last_read_at: new Date(Date.now() - 60000).toISOString() },
      ],
    },
  ],
  messages: [
    {
      id: "msg-1",
      conversation_id: "org-chat-1",
      sender_id: "donald-goff",
      body: "Hey Travis, checking in on the RAM 2500 inventory for the week!",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      deleted_at: null,
      profiles: { display_name: "Donald Goff" },
    },
    {
      id: "msg-2",
      conversation_id: "org-chat-1",
      sender_id: "local-xrkr80hd",
      body: "Looks good Donald! The Laramie 4x4 is ready on the showcase.",
      created_at: new Date(Date.now() - 1800000).toISOString(),
      deleted_at: null,
      profiles: { display_name: "Travis Wilkinson (Owner)" },
    },
  ] as any[],
};

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const isOwner = user.email?.toLowerCase() === "xrkr80hd@gmail.com" || process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
  const isDonaldGoff = user.email?.toLowerCase().includes("goff") || user.id === "donald-goff";

  try {
    const db = getSupabaseServiceClient();
    let { data: membership } = await db.from("organization_memberships")
      .select("organization_id,chat_enabled,can_dm,can_org_chat,organizations(name)").eq("user_id", user.id).maybeSingle();

    if (isOwner || isDonaldGoff) {
      let orgId = membership?.organization_id;
      let orgName = (membership as any)?.organizations?.name || "Walker Automotive";

      if (!orgId) {
        const { data: defaultOrg } = await db.from("organizations").select("id, name").limit(1).maybeSingle();
        if (defaultOrg) {
          orgId = defaultOrg.id;
          orgName = defaultOrg.name;
        } else {
          const { data: createdOrg } = await db.from("organizations")
            .insert({ name: "Walker Automotive", slug: "walker-automotive" })
            .select("id, name").single();
          if (createdOrg) {
            orgId = createdOrg.id;
            orgName = createdOrg.name;
          }
        }
        if (orgId) {
          await db.from("organization_memberships").upsert({
            organization_id: orgId,
            user_id: user.id,
            chat_enabled: true,
            can_dm: true,
            can_org_chat: true,
          }, { onConflict: "user_id" });
        }
      }

      membership = {
        organization_id: orgId || "default-org-id",
        chat_enabled: true,
        can_dm: true,
        can_org_chat: true,
        organizations: { name: orgName } as any,
      };
    }

    if (!membership?.chat_enabled) return Response.json({ membership, conversations: [], people: [], messages: [] });

    const [{ data: memberRows, error: membersError }, { data: conversations }] = await Promise.all([
      db.from("organization_memberships").select("user_id").eq("organization_id", membership.organization_id).eq("chat_enabled", true),
      db.from("messenger_conversations").select("id,kind,title,updated_at,messenger_participants(user_id,last_read_at)").eq("organization_id", membership.organization_id).order("updated_at", { ascending: false }),
    ]);
    if (membersError) return Response.json({ error: membersError.message }, { status: 500 });

    const memberIds = (memberRows ?? []).map((member) => member.user_id);
    const { data: memberProfiles, error: profilesError } = memberIds.length
      ? await db.from("profiles").select("id,display_name").in("id", memberIds)
      : { data: [], error: null };
    if (profilesError) return Response.json({ error: profilesError.message }, { status: 500 });

    const profileNames = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const people = memberIds.map((userId) => ({
      user_id: userId,
      profiles: { display_name: profileNames.get(userId) || "Team Member" },
    }));

    const ids = (conversations ?? []).filter((c: any) => c.kind === "organization" || c.messenger_participants?.some((p: any) => p.user_id === user.id)).map((c: any) => c.id);
    const { data: messages } = ids.length ? await db.from("messenger_messages").select("id,conversation_id,sender_id,body,created_at,edited_at,profiles(display_name)").in("conversation_id", ids).is("deleted_at", null).order("created_at") : { data: [] };

    return Response.json({ membership, people: people ?? [], conversations: (conversations ?? []).filter((c: any) => ids.includes(c.id)), messages: messages ?? [], me: user.id });
  } catch {
    if (isOwner || isDonaldGoff) {
      // Local / offline fallback for Owner & Donald Goff
      return Response.json({
        membership: {
          organization_id: "local-org",
          chat_enabled: true,
          can_dm: true,
          can_org_chat: true,
          organizations: { name: "Walker Automotive" },
        },
        people: [
          { user_id: "local-xrkr80hd", profiles: { display_name: "Travis Wilkinson (Owner)" } },
          { user_id: "donald-goff", profiles: { display_name: "Donald Goff" } },
        ],
        conversations: localStore.conversations,
        messages: localStore.messages.filter((m) => !m.deleted_at),
        me: user.id,
      });
    }
    return Response.json({ error: "Failed to load messenger." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const isOwner = user.email?.toLowerCase() === "xrkr80hd@gmail.com" || process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
  const isDonaldGoff = user.email?.toLowerCase().includes("goff") || user.id === "donald-goff";

  const body = await request.json();

  try {
    const db = getSupabaseServiceClient();
    let { data: mine } = await db.from("organization_memberships").select("*").eq("user_id", user.id).maybeSingle();

    if (isOwner && (!mine || !mine.chat_enabled || !mine.can_dm || !mine.can_org_chat)) {
      let organizationId = mine?.organization_id;
      if (!organizationId) {
        const { data: organization, error: organizationError } = await db
          .from("organizations")
          .select("id")
          .order("name")
          .limit(1)
          .maybeSingle();
        if (organizationError || !organization) {
          return Response.json({ error: "Messenger organizations are not configured." }, { status: 500 });
        }
        organizationId = organization.id;
      }
      const ownerMembership = {
        organization_id: organizationId,
        user_id: user.id,
        chat_enabled: true,
        can_dm: true,
        can_org_chat: true,
      };
      const { error: ownerMembershipError } = await db
        .from("organization_memberships")
        .upsert(ownerMembership, { onConflict: "user_id" });
      if (ownerMembershipError) {
        return Response.json({ error: ownerMembershipError.message }, { status: 500 });
      }
      mine = ownerMembership;
    }

    if (!mine?.chat_enabled) return Response.json({ error: "Messenger access has not been enabled." }, { status: 403 });

    if (body.action === "start-dm") {
      if (!isOwner && !mine.can_dm) {
        return Response.json({ error: "Direct messaging has not been enabled." }, { status: 403 });
      }
      const { data: other } = await db.from("organization_memberships").select("*").eq("user_id", body.userId).eq("organization_id", mine.organization_id).maybeSingle();
      if (!isOwner && (!other?.chat_enabled || !other.can_dm)) return Response.json({ error: "That member cannot receive DMs." }, { status: 403 });
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
      const { data: convo } = await db
        .from("messenger_conversations")
        .select("id,kind,organization_id,messenger_participants(user_id)")
        .eq("id", body.conversationId)
        .maybeSingle();
      if (!convo) return Response.json({ error: "Conversation not found." }, { status: 404 });
      if (convo.organization_id !== mine.organization_id) {
        return Response.json({ error: "Conversation access denied." }, { status: 403 });
      }
      if (convo.kind === "organization" && !isOwner && !mine.can_org_chat) {
        return Response.json({ error: "Organization chat has not been enabled." }, { status: 403 });
      }
      const participants = convo.messenger_participants as { user_id: string }[] | null;
      if (convo.kind === "dm" && (!isOwner && !mine.can_dm || !participants?.some((item) => item.user_id === user.id))) {
        return Response.json({ error: "Direct-message access denied." }, { status: 403 });
      }
      if (convo) {
        const { data: createdMsg, error: messageError } = await db.from("messenger_messages").insert({ conversation_id: convo.id, sender_id: user.id, body: text }).select("id,created_at").single();
        if (messageError) return Response.json({ error: messageError.message }, { status: 500 });
        await db.from("messenger_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);
        return Response.json({ ok: true, message: createdMsg });
      }
      return Response.json({ ok: true });
    }

    if (body.action === "delete") {
      const msgId = body.messageId;
      if (!msgId) return Response.json({ error: "Message ID required." }, { status: 400 });
      // Verify message owner or organization admin
      const { data: existingMsg } = await db.from("messenger_messages").select("id,sender_id").eq("id", msgId).maybeSingle();
      if (existingMsg && existingMsg.sender_id !== user.id && !isOwner) {
        return Response.json({ error: "You can only delete your own messages." }, { status: 403 });
      }
      await db.from("messenger_messages").update({ deleted_at: new Date().toISOString() }).eq("id", msgId);
      return Response.json({ ok: true });
    }

    if (body.action === "mark-read") {
      const conversationId = body.conversationId;
      if (!conversationId) return Response.json({ error: "Conversation ID required." }, { status: 400 });
      await db.from("messenger_participants").upsert({
        conversation_id: conversationId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      }, { onConflict: "conversation_id,user_id" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    if (isOwner || isDonaldGoff) {
      if (body.action === "start-dm") {
        const users = [user.id, String(body.userId)].sort();
        const conversationId = `dm-${users.join("-")}`;
        if (!localStore.conversations.some((conversation) => conversation.id === conversationId)) {
          localStore.conversations.push({
            id: conversationId,
            kind: "dm",
            title: "Direct Message",
            updated_at: new Date().toISOString(),
            messenger_participants: users.map((userId) => ({ user_id: userId, last_read_at: new Date().toISOString() })),
          });
        }
        return Response.json({ conversationId });
      }

      if (body.action === "send") {
        const text = String(body.body ?? "").trim();
        if (text) {
          const newMsg = {
            id: `msg-${Date.now()}`,
            conversation_id: body.conversationId,
            sender_id: user.id,
            body: text,
            created_at: new Date().toISOString(),
            deleted_at: null,
            profiles: { display_name: isOwner ? "Travis Wilkinson (Owner)" : "Donald Goff" },
          };
          localStore.messages.push(newMsg);
        }
        return Response.json({ ok: true });
      }

      if (body.action === "delete") {
        const msg = localStore.messages.find((m) => String(m.id) === String(body.messageId));
        if (msg) msg.deleted_at = new Date().toISOString();
        return Response.json({ ok: true });
      }

      if (body.action === "mark-read") {
        const convo = localStore.conversations.find((c) => c.id === body.conversationId);
        if (convo) {
          const part = convo.messenger_participants.find((p: any) => p.user_id === user.id);
          if (part) part.last_read_at = new Date().toISOString();
        }
        return Response.json({ ok: true });
      }

      return Response.json({ ok: true });
    }
    return Response.json({ error: "Failed to process messenger action." }, { status: 500 });
  }
}
