import { dealOwnerScope } from "@/lib/deal-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/deals/[id]/sm-finish — SM finishes review and forwards deal to F&I.
 * Sets sm_finished_at, fni_ready=true, fni_sent_at. Requires deal_number.
 * Must be claimer. Inserts notification for fni role.
 */

function getToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function POST(
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
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "sales_manager" && profile.role !== "admin")) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  const scope = await dealOwnerScope(supabase, user, profile.role);
  if (scope && !scope.length) return Response.json({ error: "Organization access required." }, { status: 403 });
  let query = supabase
    .from("deals")
    .select("id, user_id, sm_claimed_by, sm_finished_at, deal_number")
    .eq("id", id)
;
  if (scope) query = query.in("user_id", scope);
  const { data: deal, error: fetchErr } = await query.single();

  if (fetchErr || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });
  if (deal.sm_claimed_by !== user.id) return Response.json({ error: "Only the claimer can finish." }, { status: 403 });
  if (deal.sm_finished_at) return Response.json({ error: "Already finished by SM." }, { status: 409 });
  if (!deal.deal_number) return Response.json({ error: "Deal number must be set before sending to F&I." }, { status: 400 });

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("deals")
    .update({ sm_finished_at: now, fni_ready: true, fni_sent_at: now })
    .eq("id", id).eq("user_id", deal.user_id);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  // Build notification

  const smName = profile.display_name || user.email?.split("@")[0] || "Sales Manager";

  await supabase.from("notifications").insert({
    recipient_role: "fni",
    deal_id: id,
    message: `Paperwork approved for F&I · Deal #${deal.deal_number} · Approved by ${smName}`,
  });

  return Response.json({ finished: true, sm_finished_at: now, fni_sent_at: now });
}
