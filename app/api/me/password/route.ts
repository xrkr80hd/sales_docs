import { getSupabaseServiceClient } from "@/lib/supabase-server";
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
  const db = getSupabaseServiceClient({ allowPasswordChange: true });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return Response.json({ error: "Invalid session." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== "string" || body.password.length < 12 || body.password.length > 128) return Response.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
  const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password: body.password, app_metadata: { ...user.app_metadata, must_change_password: false, password_changed_at: new Date().toISOString() } });
  if (updateError) return Response.json({ error: updateError.message }, { status: 400 });
  return Response.json({ ok: true });
}
