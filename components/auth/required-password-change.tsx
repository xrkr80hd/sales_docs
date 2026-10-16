"use client";
import { requestJson } from "@/lib/request-json";
import { SoftwareLogo } from "@/components/branding/software-logo";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { WorkspaceIdentity } from "@/components/command-center/workspace-context";
const VerifiedAccountContext = createContext<WorkspaceIdentity | null>(null);
export function useVerifiedAccount() { return useContext(VerifiedAccountContext); }
export function PasswordRequirement({ session, children }: { session: Session; children: ReactNode }) {
  const [account, setAccount] = useState<WorkspaceIdentity | null>(null);
  const [required, setRequired] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    const check = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await requestJson<WorkspaceIdentity & { mustChangePassword: boolean }>("/api/me?access=1", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (typeof result.mustChangePassword !== "boolean") throw new Error("Could not verify access. Please retry.");
        if (!result.mustChangePassword && (!result.id || !result.role)) throw new Error("Your workspace could not be verified. Please retry.");
        if (active) { setAccount(previous => result.mustChangePassword ? null : JSON.stringify(previous) === JSON.stringify(result) ? previous : result); setRequired(result.mustChangePassword); setError(""); }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Could not verify access."); }
      finally { pending = false; }
    };
    void check(); const timer = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session.access_token, attempt]);
  if (required === false && account) return <VerifiedAccountContext.Provider value={account}>{children}</VerifiedAccountContext.Provider>;
  return <div className="nxt-ui nxt-auth-screen"><section className="nxt-auth-panel"><header className="nxt-auth-header"><div className="nxt-auth-wordmark"><SoftwareLogo /></div><h2>{required ? "Choose a new password" : error ? "Account check interrupted" : "Checking account access…"}</h2></header><div className="nxt-auth-form">
    {error && <><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry account check</button></>}
    {required && <form className="grid gap-4" onSubmit={async event => {
      event.preventDefault(); setError("");
      if (password !== confirm) { setError("Passwords must match."); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/me/password", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not change password.");
        setPassword(""); setConfirm(""); await getSupabaseBrowserClient().auth.refreshSession(); setRequired(null); setAttempt(value => value + 1);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not change password."); }
      finally { setBusy(false); }
    }}><p>Your administrator requires a new password before you can use NXTDOX.</p><label>New password<input className="block w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Confirm new password<input className="block w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} /></label><button disabled={busy} type="submit">{busy ? "Saving…" : "Change password & continue"}</button></form>}
    <button type="button" onClick={()=>{ void getSupabaseBrowserClient().auth.signOut(); }}>Sign out</button>
  </div></section></div>;
}
