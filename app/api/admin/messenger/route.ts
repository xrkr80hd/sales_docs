import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  const db = getSupabaseServiceClient();
  const [{ data: organizations }, { data: memberships }, { data: profiles }, authUsers] = await Promise.all([
    db.from("organizations").select("id,name,slug").order("name"),
    db.from("organization_memberships").select("*"),
    db.from("profiles").select("id,display_name,role"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emails = new Map((authUsers.data.users ?? []).map((u) => [u.id, u.email]));
  return Response.json({ organizations, memberships, users: (profiles ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? "" })) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  const body = await request.json(); const db = getSupabaseServiceClient();
  const row = { organization_id: body.organizationId, user_id: body.userId, chat_enabled: !!body.chatEnabled, can_dm: !!body.canDm, can_org_chat: !!body.canOrgChat, assigned_by: auth.userId, updated_at: new Date().toISOString() };
  const { error } = await db.from("organization_memberships").upsert(row, { onConflict: "user_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
