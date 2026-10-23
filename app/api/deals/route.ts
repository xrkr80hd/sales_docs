import { normalizeWorkflowData, stripSsnFields } from "@/lib/walker-workflow";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET  /api/deals        — list the caller's open deals
 * POST /api/deals        — upsert (create or update) a deal
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

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, workflow_data, signatures, status, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ deals: (deals ?? []).map(deal => ({ ...deal, signatures: stripSsnFields(deal.signatures), workflow_data: normalizeWorkflowData(deal.workflow_data) })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const token = getToken(request);
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id, workflowData, signatures } = body as {
    id?: string;
    workflowData?: Record<string, unknown>;
    signatures?: Record<string, string>;
  };

  if (!workflowData || typeof workflowData !== "object" || Array.isArray(workflowData)) {
    return Response.json({ error: "workflowData is required." }, { status: 400 });
  }

  // Update existing deal
  if (id) {
    const { data: deal, error } = await supabase
      .from("deals")
      .update({
        workflow_data: normalizeWorkflowData(workflowData),
        signatures: stripSsnFields(signatures ?? {}),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, updated_at")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ deal });
  }

  // Create new deal
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      workflow_data: normalizeWorkflowData(workflowData),
      signatures: stripSsnFields(signatures ?? {}),
    })
    .select("id, updated_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ deal });
}
