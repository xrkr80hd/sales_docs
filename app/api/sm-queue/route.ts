import { normalizeWorkflowData } from "@/lib/walker-workflow";
import { dealOwnerScope } from "@/lib/deal-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/sm-queue — list deals flagged for Sales Manager review, FIFO by sm_sent_at.
 * Accessible by sales_manager or admin role only.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "sales_manager" && profile.role !== "admin")) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const scope = await dealOwnerScope(supabase, user, profile.role);
  if (scope && !scope.length) return Response.json({ deals: [] });
  let query = supabase
    .from("deals")
    .select("id, workflow_data, sm_sent_at, sm_claimed_at, sm_claimed_by, sm_finished_at, deal_number, updated_at, user_id, claimer:profiles!sm_claimed_by(display_name)")
    .eq("sm_ready", true)
    .eq("status", "open")
    .is("sm_finished_at", null)
    .order("sm_sent_at", { ascending: true });
  if (scope) query = query.in("user_id", scope);
  const { data: deals, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ deals: (deals ?? []).map(deal => ({ ...deal, workflow_data: normalizeWorkflowData(deal.workflow_data) })) }, { headers: { "Cache-Control": "private, no-store" } });
}
