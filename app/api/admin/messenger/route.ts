import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  try {
    const db = getSupabaseServiceClient();
    const [{ data: organizations }, { data: memberships }, { data: profiles }, authUsers] = await Promise.all([
      db.from("organizations").select("id,name,slug").order("name"),
      db.from("organization_memberships").select("*"),
      db.from("profiles").select("id,display_name,role"),
      db.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const emails = new Map((authUsers.data.users ?? []).map((u) => [u.id, u.email]));
    return Response.json({ organizations, memberships, users: (profiles ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? "" })) });
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
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  const body = await request.json(); const db = getSupabaseServiceClient();
  const row = { organization_id: body.organizationId, user_id: body.userId, chat_enabled: !!body.chatEnabled, can_dm: !!body.canDm, can_org_chat: !!body.canOrgChat, assigned_by: auth.userId, updated_at: new Date().toISOString() };
  const { error } = await db.from("organization_memberships").upsert(row, { onConflict: "user_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
