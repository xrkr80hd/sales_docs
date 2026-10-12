"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export type WorkspaceIdentity = { id: string; displayName: string; role: string; email: string };
const WorkspaceContext = createContext<WorkspaceIdentity | null>(null);
export function useWorkspaceIdentity() { return useContext(WorkspaceContext); }

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(() => process.env.NEXT_PUBLIC_DISABLE_AUTH === "1"
    ? { id: "local-preview", displayName: "Local interface preview", role: "admin", email: "" }
    : null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1" || !isSupabaseConfigured()) return;
    let active = true;
    const client = getSupabaseBrowserClient();
    async function load() {
      const { data } = await client.auth.getSession();
      if (!data.session) { if (active) setIdentity(null); return; }
      try {
        const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
        if (response.ok && active) setIdentity(await response.json());
      } catch { /* The existing session gate owns authentication errors. */ }
    }
    void load();
    const { data: listener } = client.auth.onAuthStateChange(() => { window.setTimeout(() => void load(), 0); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  return <WorkspaceContext.Provider value={identity}>{children}</WorkspaceContext.Provider>;
}
