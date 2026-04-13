"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type BrowserStorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const AUTH_STORAGE_KEY = "walker-docs-next.auth.session";

let browserClient: SupabaseClient | null = null;

const browserSessionStorage: BrowserStorageAdapter = {
  getItem(key) {
    if (typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") {
      return;
    }

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

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(getSupabaseConfigError() || "Supabase is not configured.");
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true,
        storage: browserSessionStorage,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  }

  return browserClient;
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
