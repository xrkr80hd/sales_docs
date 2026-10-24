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

  const supabase = getSupabaseServiceClient({signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const summary = new URL(request.url).searchParams.get("summary") === "1";
  const { data: deals, error } = await supabase
    .from("deals")
    .select((summary ? "id,status,created_at,updated_at,customerName:workflow_data->>customerName,vehicleYear:workflow_data->>vehicleYear,vehicleMake:workflow_data->>vehicleMake,vehicleModel:workflow_data->>vehicleModel,dealType:workflow_data->>dealType" : "id, workflow_data, signatures, status, created_at, updated_at") as string)
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  type ListRow={id:string;status:string;created_at:string;updated_at:string;workflow_data?:unknown;signatures?:unknown;customerName?:string;vehicleYear?:string;vehicleMake?:string;vehicleModel?:string;dealType?:string};
  const rows=(deals||[]) as unknown as ListRow[];
  if(summary)return Response.json({deals:rows.map(deal=>({id:deal.id,status:deal.status,created_at:deal.created_at,updated_at:deal.updated_at,workflow_data:{customerName:deal.customerName,vehicleYear:deal.vehicleYear,vehicleMake:deal.vehicleMake,vehicleModel:deal.vehicleModel,dealType:deal.dealType}}))},{headers:{"Cache-Control":"private, no-store"}});
  return Response.json({ deals: rows.map(deal => ({ ...deal, signatures: stripSsnFields(deal.signatures), workflow_data: normalizeWorkflowData(deal.workflow_data) })) }, { headers: { "Cache-Control": "private, no-store" } });
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
