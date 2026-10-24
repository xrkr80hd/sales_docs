"use client";
import { clearCustomerCopy } from "@/lib/customer-copy";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { browserSessionExpired, recordBrowserActivity } from "@/lib/browser-activity";
import { clearMessengerCache } from "@/lib/messenger-cache";
import { clearLinksCache } from "@/lib/consultant-links-cache";
import { clearResourceCache } from "@/lib/client-resource-cache";
import { createSupabaseFetch } from "@/lib/supabase-fetch";

type BrowserStorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const AUTH_STORAGE_KEY = "walker-docs-next.auth.session";

let browserClient: SupabaseClient | null = null;

const persistentBrowserStorage: BrowserStorageAdapter = {
  getItem(key) {
    if (typeof window === "undefined") {
      return null;
    }

    const persisted = window.localStorage.getItem(key);
    if (persisted) return persisted;

    // Preserve an existing login when upgrading from tab-only session storage.
    const previousSession = window.sessionStorage.getItem(key);
    if (previousSession) {
      window.localStorage.setItem(key, previousSession);
      window.sessionStorage.removeItem(key);
    }
    return previousSession;
  },
  setItem(key, value) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
  },
  removeItem(key) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseConfigError() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    return "";
  }

  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return `Missing ${missing.join(" and ")}.`;
}

export function forgetBrowserSession() {
  clearCustomerCopy();
  persistentBrowserStorage.removeItem(AUTH_STORAGE_KEY);
  clearResourceCache();
  clearLinksCache();
  clearMessengerCache();
}
function expireStoredBrowserSession() {
  if(typeof window === "undefined")return;
  try {
    const saved=JSON.parse(persistentBrowserStorage.getItem(AUTH_STORAGE_KEY)||"null");
    const userId=saved?.user?.id;
    if(typeof userId!=="string")return;
    if(browserSessionExpired(userId))forgetBrowserSession();
    else recordBrowserActivity(userId);
  } catch { /* The SDK handles malformed session data. */ }
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(getSupabaseConfigError() || "Supabase is not configured.");
  }

  if (!browserClient) {
    expireStoredBrowserSession();
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: createSupabaseFetch() },
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true,
        storage: persistentBrowserStorage,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  }

  return browserClient;
}

let sessionRestore: ReturnType<SupabaseClient["auth"]["getSession"]> | null = null;
/** Retry buttons share the pending SDK refresh instead of queueing more work. */
export function restoreBrowserSession() {
  if (!sessionRestore) {
    sessionRestore = getSupabaseBrowserClient().auth.getSession().finally(() => { sessionRestore = null; });
  }
  return sessionRestore;
}

export function getAuthRedirectUrl() {
  if (typeof window === "undefined") {
    return "/deal-sheet";
  }

  return `${window.location.origin}/deal-sheet`;
}

export function getSessionLabel(session: Session | null) {
  return session?.user?.email?.trim() || "Authorized User";
}
