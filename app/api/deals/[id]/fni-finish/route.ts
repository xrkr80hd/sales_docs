import { dealOwnerScope } from "@/lib/deal-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/deals/[id]/fni-finish — F&I marks a claimed deal as finished.
 * Stamps fni_finished_at. Must be the same user who claimed it.
 * Allowed roles: fni, admin.
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

  // Role check — fni or admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "fni" && profile.role !== "admin")) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  // Fetch the deal — must be claimed by this user
  const scope = await dealOwnerScope(supabase, user, profile.role);
  if (scope && !scope.length) return Response.json({ error: "Organization access required." }, { status: 403 });
  let query = supabase
    .from("deals")
    .select("id, user_id, fni_ready, fni_claimed_by, fni_finished_at, status")
    .eq("id", id)
;
  if (scope) query = query.in("user_id", scope);
  const { data: deal, error: fetchErr } = await query.single();

  if (fetchErr || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });
  if (!deal.fni_ready) return Response.json({ error: "Deal is not in the F&I queue." }, { status: 400 });
  if (deal.status !== "open") return Response.json({ error: "Deal is not open." }, { status: 400 });
  if (!deal.fni_claimed_by) return Response.json({ error: "Deal has not been claimed yet." }, { status: 400 });
  if (deal.fni_claimed_by !== user.id) return Response.json({ error: "You did not claim this deal." }, { status: 403 });
  if (deal.fni_finished_at) return Response.json({ error: "Deal is already finished." }, { status: 409 });

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("deals")
    .update({ fni_finished_at: now })
    .eq("id", id)
    .eq("fni_claimed_by", user.id); // guard: only the claimer can finish

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ finished: true, fni_finished_at: now });
}
