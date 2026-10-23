import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/deals/[id]/send-sm — salesperson sends deal to SM queue (owner only).
 * Sets sm_ready = true, stamps sm_sent_at, inserts notification for sales_manager.
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

  const { id } = await params;

  // Fetch the deal (owner only)
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, user_id, sm_ready")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });
  if (deal.sm_ready) return Response.json({ error: "Already sent to Sales Manager." }, { status: 409 });

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("deals")
    .update({ sm_ready: true, sm_sent_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  // Build notification message


  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const senderName = profile?.display_name || user.email?.split("@")[0] || "Salesperson";

  await supabase.from("notifications").insert({
    recipient_role: "sales_manager",
    deal_id: id,
    message: `Paperwork ready for review · Sent by ${senderName}`,
  });

  return Response.json({ sent: true, sm_sent_at: now });
}
