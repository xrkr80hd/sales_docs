"use client";

import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  getSessionLabel,
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  isSupabaseConfigured
} from "@/lib/supabase-browser";

/* ───── Session Context ───── */

type SessionContextValue = {
  sessionLabel: string;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside SupabaseSessionGate");
  }
  return ctx;
}

/* ───── Gate Component ───── */

type SupabaseSessionGateProps = {
  children: ReactNode;
  surface?: "app" | "print";
  renderBar?: boolean;
};

export function SupabaseSessionGate({
  children,
  surface = "app",
  renderBar = true,
}: SupabaseSessionGateProps) {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

  const [checking, setChecking] = useState(!authDisabled);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (authDisabled || !isSupabaseConfigured()) {
      setChecking(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) {
          return;
        }

        if (sessionError) {
          setError(sessionError.message);
        }

        setSession(data.session ?? null);
        setChecking(false);
      })
      .catch((sessionError: unknown) => {
        if (!active) {
          return;
        }

        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Could not verify access.",
        );
        setChecking(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setChecking(false);
      setError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authDisabled]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }

    if (mode === "reset") {
      setSending(true);
      setStatus("");
      setError("");
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });
        if (resetError) {
          setError(resetError.message);
        } else {
          setStatus("If that email is registered, you'll receive a password reset link shortly. Check your inbox.");
          setMode("login");
        }
      } catch (resetErr) {
        setError(resetErr instanceof Error ? resetErr.message : "Could not send reset email.");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSending(true);
    setStatus("");
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Signup failed.");
          return;
        }

        setStatus("Account created. You can now sign in.");
        setMode("login");
        setPassword("");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Could not complete sign-in.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
      }
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Could not sign out.",
      );
    }
  }

  // Auth bypass — pass through immediately
  if (authDisabled) {
    return (
      <SessionContext.Provider
        value={{
          sessionLabel: "xrkr80hd@gmail.com (Local Admin)",
          signOut: () => {},
        }}
      >
        {children}
      </SessionContext.Provider>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden border border-black/10 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
          <div className="bg-[var(--accent)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center px-5 py-6 text-center sm:px-6">
            <Image src="/walker-red-graphic-v2.png" alt="Walker Automotive" width={320} height={116} priority className="mx-auto h-auto w-full max-w-[200px]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-white/80 drop-shadow-sm">Walker Docs</p>
          </div>
          <div className="bg-[#2a2a2e] px-5 py-6 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Setup Needed</p>
            <h1 className="mt-2 text-2xl font-extrabold text-white">Auth gate is waiting on environment config.</h1>
            <p className="mt-3 text-sm leading-7 text-white/60">
              {getSupabaseConfigError()} Add the public Supabase URL and anon key, then reload this app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden border border-black/10 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
          <div className="bg-[var(--accent)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center px-5 py-6 text-center sm:px-6">
            <Image src="/walker-red-graphic-v2.png" alt="Walker Automotive" width={320} height={116} priority className="mx-auto h-auto w-full max-w-[200px]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-white/80 drop-shadow-sm">Walker Docs</p>
          </div>
          <div className="bg-[#2a2a2e] px-5 py-6 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Authorizing</p>
            <h1 className="mt-2 text-2xl font-extrabold text-white">Checking access…</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden border border-black/10 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
          {/* Hero header with graphic */}
          <div className="bg-[var(--accent)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center px-5 py-8 text-center sm:px-6">
            <Image src="/walker-red-graphic-v2.png" alt="Walker Automotive" width={320} height={116} priority className="mx-auto h-auto w-full max-w-[200px]" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white drop-shadow-sm">Walker Docs</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl">
              {mode === "signup" ? "Create Account" : mode === "reset" ? "Reset Password" : "Sign In"}
            </h2>
          </div>

          {/* Form body */}
          <div className="border-t border-white/10 bg-[#2a2a2e] px-5 py-6 sm:px-6">
            <form className="grid gap-4" onSubmit={handleAuthSubmit}>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  autoComplete="email"
                />
              </label>

              {mode !== "reset" && (
                <div className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Password</span>
                  <div className="flex">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="min-h-12 flex-1 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="min-h-12 border border-l-0 border-white/10 bg-white/90 px-3 text-xs font-bold uppercase tracking-wider text-[var(--foreground)]/60 transition hover:text-[var(--foreground)]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {mode === "reset" && (
                <p className="text-xs leading-relaxed text-white/50">
                  Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="inline-flex min-h-12 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create Account"
                    : mode === "reset"
                      ? "Send Reset Link"
                      : "Sign In"}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => { setMode("reset"); setError(""); setStatus(""); }}
                    className="text-sm font-bold text-white/50 underline underline-offset-2 transition hover:text-white/70"
                  >
                    Forgot your password?
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(""); setStatus(""); }}
                    className="text-sm font-bold text-[var(--accent)] underline underline-offset-2"
                  >
                    Have an invite? Create your account
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setStatus(""); }}
                  className="text-sm font-bold text-[var(--accent)] underline underline-offset-2"
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setStatus(""); }}
                  className="text-sm font-bold text-[var(--accent)] underline underline-offset-2"
                >
                  Back to sign in
                </button>
              )}
            </div>

            {status ? (
              <p className="mt-4 border border-emerald-800/20 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                {status}
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 border border-red-900/20 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (surface === "print") {
    return <>{children}</>;
  }

  const sessionCtx: SessionContextValue = {
    sessionLabel: getSessionLabel(session),
    signOut: handleSignOut,
  };

  return (
    <SessionContext.Provider value={sessionCtx}>
      {renderBar && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#2a2a2e] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                Authorized Session
              </p>
              <p className="text-sm font-semibold text-white">
                {sessionCtx.sessionLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-11 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
            >
              Sign Out
            </button>
          </div>
          {error ? (
            <p className="mt-3 border border-red-900/20 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
              {error}
            </p>
          ) : null}
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
}
