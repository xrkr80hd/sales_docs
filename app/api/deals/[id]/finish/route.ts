import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/deals/[id]/finish — mark deal as finished (starts 8-hour deletion countdown)
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

  const { data: deal, error } = await supabase
    .from("deals")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, status, finished_at")
    .single();

  if (error || !deal) return Response.json({ error: "Deal not found." }, { status: 404 });

  return Response.json({ deal });
}
