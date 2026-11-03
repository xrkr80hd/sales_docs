import {clearCustomerCopy,selectCustomerCopy,publishCustomerCopy,customerCopyRevision,customerSelectionRevision} from "@/lib/customer-copy";
import { requestJson } from "@/lib/request-json";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { normalizeWorkflowData, stripSsnFields, type SignatureStore, type WorkflowData } from "@/lib/walker-workflow";

const DEAL_ID_KEY = "walker.deal.id.v1";
const START_FRESH_DEAL_TYPE_KEY = "walker.deal.start-fresh.v1";

async function getAuthToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Local deal ID tracking ──

export function getLocalDealId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(DEAL_ID_KEY) || null;
}

export function setLocalDealId(id: string) {
  if (typeof window !== "undefined") {
    const changed=getLocalDealId()!==id;
    window.sessionStorage.setItem(DEAL_ID_KEY, id);
    if(changed)selectCustomerCopy(id);
  }
}

export function clearLocalDealId() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(DEAL_ID_KEY);
    clearCustomerCopy();
  }
}

export function markStartFreshDeal(dealType: "new" | "used") {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(START_FRESH_DEAL_TYPE_KEY, dealType);
  }
}

export function consumeStartFreshDeal(): "new" | "used" | null {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(START_FRESH_DEAL_TYPE_KEY);
  window.sessionStorage.removeItem(START_FRESH_DEAL_TYPE_KEY);

  return value === "new" || value === "used" ? value : null;
}

// ── API calls ──

export type DealSummary = {
  id: string;
  workflow_data: WorkflowData;
  signatures: SignatureStore;
  status: "open" | "finished";
  created_at: string;
  updated_at: string;
};

export async function listMyDeals(summary = false): Promise<DealSummary[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const json=await requestJson<{deals:DealSummary[]}>(summary ? "/api/deals?summary=1" : "/api/deals", { headers: authHeaders(token) });
  return (json.deals ?? []).map((deal: DealSummary) => ({ ...deal, workflow_data: normalizeWorkflowData(deal.workflow_data) }));
}

export async function loadDealFromServer(dealId: string, options: {copyOnly?:boolean} = {}): Promise<DealSummary | null> {
  if(!options.copyOnly)clearCustomerCopy(dealId);
  const revision=customerCopyRevision();
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const json=await requestJson<{deal:DealSummary|null}>(`/api/deals/${encodeURIComponent(dealId)}`, {headers:authHeaders(token)});
    if(!json.deal||json.deal.id!==dealId){if(!options.copyOnly&&customerCopyRevision()===revision)clearCustomerCopy(getLocalDealId());return null;}
    if(customerCopyRevision()===revision&&(!options.copyOnly||getLocalDealId()===dealId))publishCustomerCopy(dealId,json.deal.workflow_data);
    return {...json.deal,workflow_data:normalizeWorkflowData(json.deal.workflow_data)};
  }catch(error){if(!options.copyOnly&&customerCopyRevision()===revision)clearCustomerCopy(getLocalDealId());throw error;}
}

export async function saveDealToServer(
  workflowData: WorkflowData,
  signatures: SignatureStore,
  dealId?: string | null,
): Promise<{ id: string; updated_at: string } | null> {
  const selection=customerSelectionRevision();
  const token = await getAuthToken();
  if (!token) return null;

  const body: Record<string, unknown> = { workflowData: normalizeWorkflowData(workflowData), signatures: stripSsnFields(signatures) };
  if (dealId) body.id = dealId;

  try {
    const json=await requestJson<{deal?:{id:string;updated_at:string}}>("/api/deals",{method:"POST",headers:authHeaders(token),body:JSON.stringify(body)});
    const deal=json.deal;
    if(deal?.id&&selection===customerSelectionRevision()){setLocalDealId(deal.id);publishCustomerCopy(deal.id,workflowData);}
    return deal??null;
  }catch{return null;}
}

export async function finishDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/finish`, {
    method: "POST",
    headers: authHeaders(token),
  });

  if (res.ok) {
    clearLocalDealId();
  }

  return res.ok;
}

export async function deleteDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (res.ok) {
    clearLocalDealId();
  }

  return res.ok;
}

export async function sendToFni(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/send-fni`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}

export type FniQueueDeal = {
  id: string;
  workflow_data: Record<string, string>;
  deal_number: string | null;
  fni_sent_at: string;
  fni_claimed_at: string | null;
  fni_claimed_by: string | null;
  fni_finished_at: string | null;
  updated_at: string;
  user_id: string;
  claimer: { display_name: string } | null;
};

export async function listFniQueue(): Promise<FniQueueDeal[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const res = await fetch("/api/fni-queue", { headers: authHeaders(token) });
  if (!res.ok) return [];

  const json = await res.json();
  return json.deals ?? [];
}

export async function claimFniDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/fni-claim`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}

export async function finishFniDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/fni-finish`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}

// ── SM Queue helpers ──

export type SmQueueDeal = {
  id: string;
  workflow_data: Record<string, string>;
  sm_sent_at: string;
  sm_claimed_at: string | null;
  sm_claimed_by: string | null;
  sm_finished_at: string | null;
  deal_number: string | null;
  updated_at: string;
  user_id: string;
  claimer: { display_name: string } | null;
};

export async function sendToSm(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/send-sm`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}

export async function listSmQueue(): Promise<SmQueueDeal[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const res = await fetch("/api/sm-queue", { headers: authHeaders(token) });
  if (!res.ok) return [];

  const json = await res.json();
  return json.deals ?? [];
}

export async function claimSmDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sm-claim`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}

export async function setDealNumber(dealId: string, dealNumber: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/deal-number`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ dealNumber }),
  });

  return res.ok;
}

export async function finishSmDeal(dealId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sm-finish`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return res.ok;
}
