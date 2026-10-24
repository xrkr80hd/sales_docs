"use client";

import {requestWorkspaceExit} from "@/lib/workspace-exit";
import { SoftwareLogo } from "@/components/branding/software-logo";
import { PasswordRequirement } from "./required-password-change";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BROWSER_IDLE_MS, staySignedInEnabled,preferredStaySignedIn,setStaySignedIn, browserLastActiveAt, browserSessionExpired, recordBrowserActivity } from "@/lib/browser-activity";
import { clearCustomerCopy } from "@/lib/customer-copy";
import { clearResourceCache } from "@/lib/client-resource-cache";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  getSessionLabel,
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
  forgetBrowserSession,
  restoreBrowserSession
} from "@/lib/supabase-browser";

/* ───── Session Context ───── */

type SessionContextValue = {
  accessToken?: string;
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
  const router=useRouter();
  const authDisabled = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

  const [checking, setChecking] = useState(!authDisabled);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn,setStaySignedInChoice]=useState(()=>preferredStaySignedIn?.()??true);


  useEffect(() => {
    if (authDisabled || !isSupabaseConfigured()) {
      setChecking(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;
    let authChanged = false;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      setError("Session verification took too long. Check your connection and retry.");
    }, 12000);

    restoreBrowserSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authChanged) {
          return;
        }

        if (sessionError) {
          setError(sessionError.message);
        }

        window.clearTimeout(timer);
        if(data.session&&browserSessionExpired(data.session.user.id)){forgetBrowserSession();setSession(null);setChecking(false);return;}
        setSession(data.session ?? null);
        setChecking(false);
      })
      .catch((sessionError: unknown) => {
        if (!active || authChanged) {
          return;
        }

        window.clearTimeout(timer);
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

      if(_event === "SIGNED_IN" && submitting.current && nextSession)recordBrowserActivity(nextSession.user.id,true);
      if(nextSession && browserSessionExpired(nextSession.user.id)) {
        forgetBrowserSession();window.clearTimeout(timer);authChanged=true;setSession(null);setChecking(false);return;
      }
      if(_event === "SIGNED_OUT"){forgetBrowserSession();clearCustomerCopy();}
      window.clearTimeout(timer);
      authChanged = true;
      setSession(nextSession);
      setChecking(false);
      setError("");
    });

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [authDisabled, sessionAttempt]);

  useEffect(()=>{
    if(!session?.user.id||authDisabled)return;
    const userId=session.user.id;
    let lastActive=Date.now(),lastEvent=0,expired=false;
    const expire=()=>{
      if(expired)return;expired=true;
      forgetBrowserSession();void getSupabaseBrowserClient().auth.stopAutoRefresh();
      setSession(null);setError("Your session ended after eight hours of inactivity in this browser. Sign in again.");
    };
    const check=()=>{if(staySignedInEnabled())return true;if(browserSessionExpired(userId)||Date.now()-Math.max(lastActive,browserLastActiveAt(userId)||0)>=BROWSER_IDLE_MS){expire();return false;}return !expired;};
    const activity=()=>{if(Date.now()-lastEvent<1000)return;lastEvent=Date.now();if(!check())return;lastActive=Date.now();recordBrowserActivity(userId);};
    const visible=()=>{if(document.visibilityState==="visible")activity();};
    if(check())recordBrowserActivity(userId);
    const timer=window.setInterval(check,60000);
    window.addEventListener("pointermove",activity,{passive:true});window.addEventListener("scroll",activity,{passive:true});window.addEventListener("pointerdown",activity,{passive:true});window.addEventListener("keydown",activity);
    window.addEventListener("focus",visible);window.addEventListener("storage",check);document.addEventListener("visibilitychange",visible);
    return()=>{window.clearInterval(timer);window.removeEventListener("pointermove",activity);window.removeEventListener("scroll",activity);window.removeEventListener("pointerdown",activity);window.removeEventListener("keydown",activity);window.removeEventListener("focus",visible);window.removeEventListener("storage",check);document.removeEventListener("visibilitychange",visible);};
  },[session?.user.id,authDisabled]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const panel=event.currentTarget?.closest<HTMLElement>(".nxt-auth-panel");
    if(panel)document.documentElement.style.setProperty("--nxt-auth-panel-height",`${panel.getBoundingClientRect().height}px`);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }

    if (mode === "reset") {
      submitting.current = true;
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
        submitting.current = false;
        setSending(false);
      }
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setStaySignedIn?.(staySignedIn);
    setSending(true);
    submitting.current = true;
    setStatus("");
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();

      // Finish the existing refresh before replacing its session. Otherwise an
      // old refresh response can overwrite a newly successful password login.
      await restoreBrowserSession();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (data.session) { clearResourceCache();clearCustomerCopy();recordBrowserActivity(data.session.user.id,true);setSession(data.session);setPassword("");void supabase.auth.startAutoRefresh();if(surface==="app")router.replace("/dashboard"); }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Could not complete sign-in.",
      );
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  async function handleSignOut() {
    if(!await requestWorkspaceExit())return;
    setError("");
    setStatus("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if(!signOutError)clearResourceCache();

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
      <div className="nxt-ui nxt-auth-screen">
        <div className="nxt-auth-panel">
          <div className="nxt-auth-header">
            <div className="nxt-auth-wordmark"><SoftwareLogo /></div>
            <Image src="/branding/walker-automotive.png" alt="Walker Automotive" width={320} height={116} priority className="nxt-auth-dealer" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-white/80 drop-shadow-sm">WALKER AUTOMOTIVE WORKSPACE</p>
          </div>
          <div className="bg-[var(--panel)] px-5 py-6 sm:px-6">
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

  if (checking) return <p className="p-6 text-sm" role="status">Checking your session…</p>;

  if (!session) {
    return (
      <>
      <div className="nxt-ui nxt-auth-screen">
        <div className="nxt-auth-panel">
          {/* Hero header with graphic */}
          <div className="nxt-auth-header">
            <div className="nxt-auth-wordmark"><SoftwareLogo /></div>
            <Image src="/branding/walker-automotive.png" alt="Walker Automotive" width={320} height={116} priority className="nxt-auth-dealer" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white drop-shadow-sm">WALKER AUTOMOTIVE WORKSPACE</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white drop-shadow-sm sm:text-3xl">
              {mode === "reset" ? "Reset Password" : "Sign In"}
            </h2>
          </div>

          {/* Form body */}
          <div className="nxt-auth-form">
            <form className="grid gap-4" onSubmit={handleAuthSubmit}>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="min-h-12 border border-white/10 bg-white px-4 text-base !text-[#171719] caret-[#171719] [-webkit-text-fill-color:#171719] [color-scheme:light] outline-none transition placeholder:!text-neutral-500 focus:border-[var(--accent)]"

                  autoComplete="email"
                />
              </label>

              {mode !== "reset" && (
                <div className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Password</span>
                  <div className="flex">
                    <input
                      aria-label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="min-h-12 flex-1 border border-white/10 bg-white px-4 text-base !text-[#171719] caret-[#171719] [-webkit-text-fill-color:#171719] [color-scheme:light] outline-none transition placeholder:!text-neutral-500 focus:border-[var(--accent)]"

                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="min-h-12 border border-l-0 border-white/10 bg-white px-3 text-xs font-bold uppercase tracking-wider !text-[#34343a] transition hover:!text-[#171719]"

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

              {mode==='login'&&<label className="nxt-stay-signed-in"><input type="checkbox" checked={staySignedIn} onChange={event=>setStaySignedInChoice(event.target.checked)}/><span>Stay signed in<small>Keep this device connected for faster return visits.</small></span></label>}

              <button
                type="submit"
                disabled={sending}
                className="inline-flex min-h-12 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending
                  ? "Please wait…"
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
                  <p className="text-sm text-white/60">New account? Use your emailed invitation link or contact your administrator.</p>
                </>
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

            <div className="nxt-auth-feedback" aria-live="polite">
            {status ? (
              <p className="mt-4 border border-emerald-800/20 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                {status}
              </p>
            ) : null}

            {error ? (
              <div className="mt-4 border border-red-900/20 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
                <p>{error}</p><button type="button" className="min-h-11 underline" onClick={() => { setError(""); setChecking(true); setSessionAttempt(value => value + 1); }}>Retry session check</button>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (surface === "print") {
    return <><PasswordRequirement key={session.user.id} session={session}>{children}</PasswordRequirement></>;
  }

  const sessionCtx: SessionContextValue = {
    accessToken: session?.access_token,
    sessionLabel: getSessionLabel(session),
    signOut: handleSignOut,
  };

  return (
    <SessionContext.Provider value={sessionCtx}>
      {renderBar && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[var(--panel)] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
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
      <PasswordRequirement key={session.user.id} session={session}>{children}</PasswordRequirement>
    </SessionContext.Provider>
  );
}
