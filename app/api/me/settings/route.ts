import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET  /api/me/settings — fetch the current user's dealer + consultant settings.
 * PUT  /api/me/settings — upsert the current user's settings.
 */

function getToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dealershipAddress(dealer: Record<string, unknown>): string {
  const cityState = [clean(dealer.city), clean(dealer.state)].filter(Boolean).join(", ");
  return [clean(dealer.street), cityState, clean(dealer.zip)].filter(Boolean).join(", ");
}

export async function GET(request: Request) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const [{ data, error }, { data: profile }, { data: card }] = await Promise.all([
    supabase.from("user_settings").select("dealer_info, consultant_info, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("consultant_cards").select("display_name, dealership, location, phone, email").eq("user_id", user.id).maybeSingle(),
  ]);

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const dealerInfo = asRecord(data?.dealer_info);
  const consultantInfo = asRecord(data?.consultant_info);

  return Response.json({
    dealer_info: {
      ...dealerInfo,
      dealershipName: clean(dealerInfo.dealershipName) || clean(card?.dealership),
    },
    consultant_info: {
      ...consultantInfo,
      name: clean(consultantInfo.name) || clean(profile?.display_name) || clean(card?.display_name),
      phone: clean(consultantInfo.phone) || clean(card?.phone),
      email: clean(consultantInfo.email) || clean(card?.email) || clean(user.email),
    },
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
  const { data: existing, error: existingError } = await supabase
    .from("user_settings")
    .select("dealer_info, consultant_info")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) return Response.json({ error: existingError.message }, { status: 500 });

  const dealerInfo = { ...asRecord(existing?.dealer_info), ...asRecord(body.dealer_info) };
  const consultantInfo = { ...asRecord(existing?.consultant_info), ...asRecord(body.consultant_info) };

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        dealer_info: dealerInfo,
        consultant_info: consultantInfo,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const name = clean(consultantInfo.name);
  const phone = clean(consultantInfo.phone);
  const email = clean(consultantInfo.email);
  const dealership = clean(dealerInfo.dealershipName);
  const location = dealershipAddress(dealerInfo);

  const syncTasks = [];
  if (name) syncTasks.push(supabase.from("profiles").update({ display_name: name }).eq("id", user.id));
  syncTasks.push(
    supabase.from("consultant_cards").update({
      ...(name ? { display_name: name } : {}),
      phone,
      email,
      dealership,
      location,
      updated_at: now,
    }).eq("user_id", user.id),
  );
  const syncResults = await Promise.all(syncTasks);
  const syncError = syncResults.find((result) => result.error)?.error;
  if (syncError) return Response.json({ error: syncError.message }, { status: 500 });

  return Response.json({ saved: true, dealer_info: dealerInfo, consultant_info: consultantInfo, updated_at: now });
}
