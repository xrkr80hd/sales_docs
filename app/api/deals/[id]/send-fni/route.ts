import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/deals/[id]/send-fni — flag a deal for F&I review (owner only)
 * Sets fni_ready = true, stamps fni_sent_at, inserts a notification row.
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

  // Fetch the deal (owner only) to get display info for notification
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, user_id, fni_ready")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });

  if (deal.fni_ready) return Response.json({ error: "Already sent to F&I." }, { status: 409 });

  const now = new Date().toISOString();

  // Flip the switch
  const { error: updateErr } = await supabase
    .from("deals")
    .update({ fni_ready: true, fni_sent_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  // Build notification message


  // Get sender display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const senderName = profile?.display_name || user.email?.split("@")[0] || "Salesperson";

  // Insert notification for fni role
  await supabase.from("notifications").insert({
    recipient_role: "fni",
    deal_id: id,
    message: `Paperwork ready for review · Sent by ${senderName}`,
  });

  return Response.json({ sent: true, fni_sent_at: now });
}
