import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const OWNER_EMAIL = "xrkr80hd@gmail.com";

function databaseError(message: string) {
  return Response.json(
    { error: `${message} Confirm Supabase migrations 013-015 have been applied.` },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const db = getSupabaseServiceClient();
    const [organizationsResult, membershipsResult, profilesResult, authUsers] = await Promise.all([
      db.from("organizations").select("id,name,slug").order("name"),
      db.from("organization_memberships").select("*"),
      db.from("profiles").select("id,display_name,role"),
      db.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const queryError = organizationsResult.error ?? membershipsResult.error ?? profilesResult.error ?? authUsers.error;
    if (queryError) return databaseError(queryError.message);

    const emails = new Map((authUsers.data.users ?? []).map((u) => [u.id, u.email]));
    return Response.json({
      organizations: organizationsResult.data ?? [],
      memberships: membershipsResult.data ?? [],
      users: (profilesResult.data ?? []).map((profile) => ({
        ...profile,
        email: emails.get(profile.id) ?? "",
      })),
    });
  } catch {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      return Response.json({
        organizations: [{ id: "org-walker", name: "Walker Automotive", slug: "walker-automotive" }],
        memberships: [
          { organization_id: "org-walker", user_id: "local-xrkr80hd", chat_enabled: true, can_dm: true, can_org_chat: true },
          { organization_id: "org-walker", user_id: "donald-goff", chat_enabled: true, can_dm: true, can_org_chat: true },
        ],
        users: [
          { id: "local-xrkr80hd", display_name: "Travis Wilkinson", role: "admin", email: "xrkr80hd@gmail.com" },
          { id: "donald-goff", display_name: "Donald Goff", role: "user", email: "donald.goff@walkerautomotive.com" },
        ],
      });
    }
    return Response.json({ error: "Failed to load messenger admin data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.userId || !body?.organizationId) {
    return Response.json({ error: "A user and organization are required." }, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
    return Response.json({ ok: true });
  }

  const db = getSupabaseServiceClient();
  const { data: targetUser, error: targetError } = await db.auth.admin.getUserById(body.userId);
  if (targetError) return Response.json({ error: targetError.message }, { status: 400 });

  const isOwner = targetUser.user.email?.toLowerCase() === OWNER_EMAIL;
  const row = {
    organization_id: body.organizationId,
    user_id: body.userId,
    chat_enabled: isOwner || body.chatEnabled === true,
    can_dm: isOwner || body.canDm === true,
    can_org_chat: isOwner || body.canOrgChat === true,
    assigned_by: auth.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("organization_memberships").upsert(row, { onConflict: "user_id" });
  if (error) return databaseError(error.message);
  return Response.json({ ok: true });
}
