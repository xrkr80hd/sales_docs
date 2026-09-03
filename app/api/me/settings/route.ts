import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET  /api/me/settings — fetch the current user's dealer + consultant settings.
 * PUT  /api/me/settings — upsert the current user's settings.
 */

function getToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function GET(request: Request) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const { data, error } = await supabase
    .from("user_settings")
    .select("dealer_info, consultant_info, updated_at")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    dealer_info: data?.dealer_info ?? {},
    consultant_info: data?.consultant_info ?? {},
    updated_at: data?.updated_at ?? null,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PUT(request: Request) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  let body: { dealer_info?: unknown; consultant_info?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        dealer_info: body.dealer_info ?? {},
        consultant_info: body.consultant_info ?? {},
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ saved: true, updated_at: now });
}
