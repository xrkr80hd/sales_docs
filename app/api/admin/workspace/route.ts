import { organizationBranding } from "@/lib/organization-branding";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { profileRole, validWorkspaceRole } from "@/lib/workspace-roles";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") return Response.json({ error: "User creation is unavailable in local verification. No live data was changed." }, { status: 503 });
  const db = getSupabaseServiceClient();
  if (body.action === "create-organization") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0,120) : "";
    if (!name) return Response.json({ error: "Enter an organization name." }, { status: 400 });
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${crypto.randomUUID().slice(0,8)}`;
    const { data, error } = await db.from("organizations").insert({ name, slug }).select("id,name,slug").single();
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ organization: data });
  }
  if (body.action !== "create-user" || !validWorkspaceRole(body.role)) return Response.json({ error: "Choose a valid user role." }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body.organizationId) return Response.json({ error: "Name, email, and organization are required." }, { status: 400 });
  const { data: organization, error: orgError } = await db.from("organizations").select("id").eq("id",body.organizationId).single();
  if (orgError || !organization || (await organizationBranding(db))[body.organizationId]?.deletedAt) return Response.json({ error: "Choose an existing organization." }, { status: 400 });
  const { data: existing, error: usersError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) return Response.json({ error: usersError.message }, { status: 500 });
  if (existing.users.some(user => user.email?.toLowerCase() === email)) return Response.json({ error: "That account already exists. Edit its organization and permissions below." }, { status: 409 });
  const direct = body.createMode === "direct";
  if (direct && (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128)) return Response.json({ error: "Use a temporary password between 12 and 128 characters." }, { status: 400 });
  // Existing app domain is used for the invitation, never a caller-supplied redirect.
  const { data: invitation, error: inviteError } = (direct ? await db.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { display_name: name }, app_metadata: { workspace_role: body.role, must_change_password: true } }) : await db.auth.admin.inviteUserByEmail(email, { data: { display_name: name }, redirectTo: "https://nextdocs.xrkr80hd.studio/dashboard" }));
  if (inviteError || !invitation.user) return Response.json({ error: inviteError?.message || "Invitation could not be sent." }, { status: 500 });
  const id = invitation.user.id;
  const operations = [
    db.auth.admin.updateUserById(id, { app_metadata: { ...invitation.user.app_metadata, workspace_role: body.role } }),
    db.from("profiles").upsert({ id, role: profileRole(body.role), display_name: name, card_enabled: body.cardEnabled === true }),
    db.from("organization_memberships").upsert({ user_id: id, organization_id: body.organizationId, chat_enabled: body.chatEnabled === true, can_dm: body.chatEnabled === true && body.canDm === true, can_org_chat: body.chatEnabled === true && body.canOrgChat === true, assigned_by: auth.userId }, { onConflict: "user_id" }),
  ];
  // The membership references profiles, so finish profile creation first.
  const metadata = await operations[0];
  const profile = await operations[1];
  const membership = profile.error ? profile : await operations[2];
  const setupError = metadata.error || profile.error || membership.error;
  if (setupError) return Response.json({ error: `Invitation sent, but account setup needs attention: ${setupError.message}`, userId: id }, { status: 500 });
  const bucket = `consultant-media-${id}`;
  const { error: missingBucket } = await db.storage.getBucket(bucket);
  if (missingBucket) {
    const { error } = await db.storage.createBucket(bucket, { public: true, fileSizeLimit: 100 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"] });
    if (error) return Response.json({ error: `Invitation sent and user created; storage setup failed: ${error.message}`, userId: id }, { status: 500 });
  }
  return Response.json({ ok: true, userId: id, bucket, invited: !direct });
}
