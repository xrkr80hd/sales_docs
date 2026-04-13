import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("invites")
    .select("id, email, role, created_at, expires_at, accepted_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : body.role === "fni" ? "fni" : body.role === "sales_manager" ? "sales_manager" : "user";

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();

  // Check for existing pending invite
  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return Response.json(
      { error: "A pending invite already exists for this email." },
      { status: 409 },
    );
  }

  // Insert invite row
  const { error: insertError } = await supabase.from("invites").insert({
    email,
    role,
    invited_by: auth.userId,
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Send Supabase invite email (creates user + sends magic link)
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${request.headers.get("origin") ?? ""}/dashboard` },
  );

  if (inviteError) {
    return Response.json({ error: inviteError.message }, { status: 500 });
  }

  return Response.json({ ok: true, email, role });
}
