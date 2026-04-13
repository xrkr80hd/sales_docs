const DEALER_STORAGE_KEY = "walker.dealer.v1";
const CONSULTANT_STORAGE_KEY = "walker.consultant.v1";

export type DealerInfo = {
  dealershipName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type ConsultantInfo = {
  name: string;
  salespersonNumber: string;
  phone: string;
  email: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createDefaultDealer(): DealerInfo {
  return { dealershipName: "", street: "", city: "", state: "", zip: "" };
}

export function createDefaultConsultant(): ConsultantInfo {
  return { name: "", salespersonNumber: "", phone: "", email: "" };
}

function normalizeDealer(value: unknown): DealerInfo {
  if (!isRecord(value)) return createDefaultDealer();
  return {
    dealershipName: safeTrim(value.dealershipName),
    street: safeTrim(value.street),
    city: safeTrim(value.city),
    state: safeTrim(value.state),
    zip: safeTrim(value.zip),
  };
}

function normalizeConsultant(value: unknown): ConsultantInfo {
  if (!isRecord(value)) return createDefaultConsultant();
  return {
    name: safeTrim(value.name),
    salespersonNumber: safeTrim(value.salespersonNumber),
    phone: safeTrim(value.phone),
    email: safeTrim(value.email),
  };
}

export function loadDealer(): DealerInfo {
  if (!isBrowser()) return createDefaultDealer();
  try {
    return normalizeDealer(
      JSON.parse(localStorage.getItem(DEALER_STORAGE_KEY) || "{}"),
    );
  } catch {
    return createDefaultDealer();
  }
}

export function saveDealer(data: DealerInfo): DealerInfo {
  const next = normalizeDealer(data);
  if (isBrowser()) {
    localStorage.setItem(DEALER_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadConsultant(): ConsultantInfo {
  if (!isBrowser()) return createDefaultConsultant();
  try {
    return normalizeConsultant(
      JSON.parse(localStorage.getItem(CONSULTANT_STORAGE_KEY) || "{}"),
    );
  } catch {
    return createDefaultConsultant();
  }
}

export function saveConsultant(data: ConsultantInfo): ConsultantInfo {
  const next = normalizeConsultant(data);
  if (isBrowser()) {
    localStorage.setItem(CONSULTANT_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function getDealerFullAddress(dealer: DealerInfo): string {
  const line1 = dealer.street;
  const line2 = [dealer.city, dealer.state].filter(Boolean).join(", ");
  const line3 = dealer.zip;
  return [line1, line2, line3].filter(Boolean).join(", ");
}

// ── Server persistence helpers ──

async function getAuthToken(): Promise<string | null> {
  if (!isBrowser()) return null;
  try {
    const { getSupabaseBrowserClient, isSupabaseConfigured } = await import("@/lib/supabase-browser");
    if (!isSupabaseConfigured()) return null;
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchServerSettings(): Promise<{ dealer: DealerInfo; consultant: ConsultantInfo } | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch("/api/me/settings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      dealer: normalizeDealer(json.dealer_info),
      consultant: normalizeConsultant(json.consultant_info),
    };
  } catch {
    return null;
  }
}

export async function saveServerSettings(dealer: DealerInfo, consultant: ConsultantInfo): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch("/api/me/settings", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dealer_info: dealer,
        consultant_info: consultant,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
