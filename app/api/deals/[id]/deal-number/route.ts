import { dealOwnerScope } from "@/lib/deal-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * PATCH /api/deals/[id]/deal-number — SM sets the deal number on a claimed deal.
 * Must be the claimer. Requires sales_manager or admin role.
 */

function getToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "sales_manager" && profile.role !== "admin")) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  let body: { dealNumber?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const dealNumber = typeof body.dealNumber === "string" ? body.dealNumber.trim() : "";
  if (!dealNumber) return Response.json({ error: "Deal number is required." }, { status: 400 });

  const scope = await dealOwnerScope(supabase, user, profile.role);
  if (scope && !scope.length) return Response.json({ error: "Organization access required." }, { status: 403 });
  let query = supabase
    .from("deals")
    .select("id, user_id, sm_claimed_by, sm_finished_at")
    .eq("id", id)
;
  if (scope) query = query.in("user_id", scope);
  const { data: deal, error: fetchErr } = await query.single();

  if (fetchErr || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });
  if (deal.sm_claimed_by !== user.id) return Response.json({ error: "Only the claimer can set deal number." }, { status: 403 });
  if (deal.sm_finished_at) return Response.json({ error: "Deal already finished by SM." }, { status: 409 });

  const { error: updateErr } = await supabase
    .from("deals")
    .update({ deal_number: dealNumber })
    .eq("id", id).eq("user_id", deal.user_id);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ ok: true, deal_number: dealNumber });
}
