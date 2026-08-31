"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden border border-black/10 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
          <div className="rounded-[16px] bg-[var(--accent)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center px-5 py-8 text-center sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white drop-shadow-sm">Walker Docs</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl">Processing…</h2>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing…");
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Auth is not configured.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const type = searchParams.get("type");

    // Supabase appends tokens as hash fragments — the client library
    // picks them up automatically via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setStatus("Set your new password below.");
      } else if (event === "SIGNED_IN") {
        if (type === "recovery") {
          setIsRecovery(true);
          setStatus("Set your new password below.");
        } else {
          setStatus("You're signed in! Redirecting…");
          setTimeout(() => router.replace("/dashboard"), 1000);
        }
      }
    });

    // Fallback timeout — if no event fires
    const timeout = setTimeout(() => {
      if (!isRecovery && !done) {
        setStatus("");
        setError("The link may have expired or already been used. Try signing in or requesting a new link.");
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams, router, isRecovery, done]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setStatus("Password updated! Redirecting…");
        setTimeout(() => router.replace("/dashboard"), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <div className="w-full overflow-hidden border border-black/10 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
        <div className="rounded-[16px] bg-[var(--accent)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center px-5 py-8 text-center sm:px-6">
          <Image src="/walker-red-graphic-v2.png" alt="Walker Automotive" width={320} height={116} priority className="mx-auto h-auto w-full max-w-[200px]" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white drop-shadow-sm">Walker Docs</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl">
            {isRecovery ? "Reset Password" : "Welcome"}
          </h2>
        </div>

        <div className="border-t border-white/10 bg-[#2a2a2e] px-5 py-6 sm:px-6">
          {isRecovery && !done ? (
            <form className="grid gap-4" onSubmit={handleSetPassword}>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  autoComplete="new-password"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  autoComplete="new-password"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center border border-[var(--accent)] rounded-[16px] bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Set Password"}
              </button>
            </form>
          ) : (
            <p className="text-sm font-bold text-white">{status || "Verifying your link…"}</p>
          )}

          {error && (
            <p className="mt-4 border border-red-900/20 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
              {error}
            </p>
          )}

          {(error || done) && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="text-sm font-bold text-[var(--accent)] underline underline-offset-2"
              >
                Go to Walker Docs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
