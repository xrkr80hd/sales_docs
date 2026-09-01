import { getSupabaseServiceClient } from "@/lib/supabase-server";

function tokenFrom(request: Request) {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (!token) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const subscription = await request.json().catch(() => null);
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: subscription.endpoint,
    user_id: user.id,
    subscription,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}