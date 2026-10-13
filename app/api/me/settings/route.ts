import { organizationBranding } from "@/lib/organization-branding";
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

export async function GET(request: Request) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.from("user_settings").select("dealer_info, consultant_info, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const {data: membership}=await supabase.from("organization_memberships").select("organization_id,organizations(name)").eq("user_id",user.id).maybeSingle();
  const organization=membership?.organizations as unknown as {name?:string}|null;
  const branded=membership?.organization_id?(await organizationBranding(supabase))[membership.organization_id]:undefined;
  const assignedDealer=organization?.name?{dealershipName:organization.name,...(branded?.address||{street:"",city:"",state:"",zip:""})}:null;
  const dealerInfo = {...asRecord(data?.dealer_info),...(assignedDealer||{})};
  const consultantInfo = asRecord(data?.consultant_info);

  return Response.json({
    dealer_info: {
      ...dealerInfo,
      dealershipName: clean(dealerInfo.dealershipName),
    },
    consultant_info: {
      ...consultantInfo,
      name: clean(profile?.display_name) || clean(consultantInfo.name),
      phone: clean(consultantInfo.phone),
      email: clean(consultantInfo.email) || clean(user.email),
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

  const {data: membership}=await supabase.from("organization_memberships").select("organization_id,organizations(name)").eq("user_id",user.id).maybeSingle();
  const organization=membership?.organizations as unknown as {name?:string}|null;
  const branded=membership?.organization_id?(await organizationBranding(supabase))[membership.organization_id]:undefined;
  const assignedDealer=organization?.name?{dealershipName:organization.name,...(branded?.address||{street:"",city:"",state:"",zip:""})}:null;
  const dealerInfo = { ...asRecord(existing?.dealer_info), ...asRecord(body.dealer_info),...(assignedDealer||{}) };
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
  if (name) {
    const { error: profileError } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  }

  return Response.json({ saved: true, dealer_info: dealerInfo, consultant_info: consultantInfo, updated_at: now });
}
