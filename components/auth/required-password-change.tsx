"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
export function PasswordRequirement({ session, children }: { session: Session; children: ReactNode }) {
  const [required, setRequired] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (!response.ok) throw new Error("Could not verify account access. Please sign in again.");
        const result = await response.json();
        if (active) { setRequired(result.mustChangePassword === true); setError(""); }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Could not verify access."); }
    };
    void check(); const timer = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session.access_token]);
  if (required === false) return children;
  return <div className="nxt-ui nxt-auth-screen"><section className="nxt-auth-panel"><header className="nxt-auth-header"><div className="nxt-auth-wordmark">NDOX</div><h2>{required ? "Choose a new password" : "Checking account access…"}</h2></header><div className="nxt-auth-form">
    {error && <p role="alert">{error}</p>}
    {required && <form className="grid gap-4" onSubmit={async event => {
      event.preventDefault(); setError("");
      if (password !== confirm) { setError("Passwords must match."); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/me/password", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not change password.");
        setPassword(""); setConfirm(""); await getSupabaseBrowserClient().auth.refreshSession(); setRequired(false);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not change password."); }
      finally { setBusy(false); }
    }}><p>Your administrator requires a new password before you can use NDOX.</p><label>New password<input className="block w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Confirm new password<input className="block w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} /></label><button disabled={busy} type="submit">{busy ? "Saving…" : "Change password & continue"}</button></form>}
    <button type="button" onClick={()=>{ void getSupabaseBrowserClient().auth.signOut(); }}>Sign out</button>
  </div></section></div>;
}
