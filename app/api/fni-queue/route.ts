import { normalizeWorkflowData } from "@/lib/walker-workflow";
import { dealOwnerScope } from "@/lib/deal-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/fni-queue — list deals flagged for F&I, ordered FIFO by fni_sent_at
 * Accessible by users with 'fni' or 'admin' role only.
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

  // Check role — fni, sales_manager, or admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "fni" && profile.role !== "admin" && profile.role !== "sales_manager")) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const scope = await dealOwnerScope(supabase, user, profile.role);
  if (scope && !scope.length) return Response.json({ deals: [] });
  let query = supabase
    .from("deals")
    .select("id, workflow_data, deal_number, fni_sent_at, fni_claimed_at, fni_claimed_by, fni_finished_at, updated_at, user_id, claimer:profiles!fni_claimed_by(display_name)")
    .eq("fni_ready", true)
    .eq("status", "open")
    .is("fni_finished_at", null)
    .not("sm_finished_at", "is", null)
    .order("fni_sent_at", { ascending: true });
  if (scope) query = query.in("user_id", scope);
  const { data: deals, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ deals: (deals ?? []).map(deal => ({ ...deal, workflow_data: normalizeWorkflowData(deal.workflow_data) })) }, { headers: { "Cache-Control": "private, no-store" } });
}
