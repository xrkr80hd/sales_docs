"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { organizationTheme, organizationThemeStyle } from "@/lib/organization-theme";
import { useVerifiedAccount } from "@/components/auth/required-password-change";
import { useSession } from "@/components/auth/supabase-session-gate";
import { requestJson } from "@/lib/request-json";

export type WorkspaceIdentity = { id: string; displayName: string; role: string; email: string; profileImageUrl?: string; dealership?: string; workspaceRole?: string; organizationHideIcon?:boolean; organizationId?:string; organizationIconUrl?:string; organizationTheme?:string };
const WorkspaceContext = createContext<WorkspaceIdentity | null>(null);
export function useWorkspaceIdentity() { return useContext(WorkspaceContext); }

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useSession();
  const verifiedAccount = useVerifiedAccount();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [boardOrganization,setBoardOrganization]=useState<{name:string;theme?:string}|null>(null);
  useEffect(()=>{const update=(event:Event)=>setBoardOrganization((event as CustomEvent<{name:string;theme?:string}|null>).detail);window.addEventListener("organization-theme",update);return()=>window.removeEventListener("organization-theme",update);},[]);
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(() => process.env.NEXT_PUBLIC_DISABLE_AUTH === "1"
    ? { id: "local-preview", displayName: "Local interface preview", role: "admin", email: "" }
    : verifiedAccount);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") return;
    let active = true;
    if (verifiedAccount) setIdentity(current => current?.id === verifiedAccount.id ? { ...current, ...verifiedAccount } : verifiedAccount);
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        if (!accessToken) throw new Error("Your session is unavailable. Sign in again.");
        const result = await requestJson<WorkspaceIdentity>("/api/me", { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!result.id || !result.role) throw new Error("Your workspace could not be verified. Please retry.");
        if (active) { setIdentity(result); setError(""); }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Could not load your workspace.");
      } finally { pending = false; }
    }
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("consultant-profile-updated", refresh);
    return () => { active = false; window.removeEventListener("consultant-profile-updated", refresh); };
  }, [accessToken, attempt, verifiedAccount]);
  if (!identity) return <section role="status" className="p-6"><p>{error || "Loading your workspace…"}</p>{error && <button type="button" className="min-h-11 underline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry workspace</button>}</section>;
  return <WorkspaceContext.Provider value={identity}><div className="organization-theme" data-mode={organizationTheme(boardOrganization?.name||identity?.dealership,boardOrganization?boardOrganization.theme:identity?.organizationTheme).mode} style={organizationThemeStyle(boardOrganization?.name||identity?.dealership,boardOrganization?boardOrganization.theme:identity?.organizationTheme)}>{children}</div></WorkspaceContext.Provider>;
}
