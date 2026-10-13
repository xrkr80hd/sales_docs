import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !["verify", "set-password", "require-password-change"].includes(body.action)) return Response.json({ error: "Invalid security action." }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data.user) return Response.json({ error: "Account not found." }, { status: 404 });
  // Nobody may reset the protected owner account from another account.
  if (data.user.email?.toLowerCase() === "xrkr80hd@gmail.com" && auth.userId !== id) return Response.json({ error: "Only the Master Admin can manage this account." }, { status: 403 });
  if (body.action === "set-password" && (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128)) return Response.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
  const metadata = { ...data.user.app_metadata, ...(body.action !== "verify" ? { must_change_password: true } : {}), security_updated_by: auth.userId, security_updated_at: new Date().toISOString() };
  const { error: updateError } = await db.auth.admin.updateUserById(id, { app_metadata: metadata, ...(body.action === "verify" ? { email_confirm: true } : {}), ...(body.action === "set-password" ? { password: body.password } : {}) });
  if (updateError) return Response.json({ error: updateError.message }, { status: 400 });
  return Response.json({ ok: true });
}
