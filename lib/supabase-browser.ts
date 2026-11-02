"use client";
import {clearPageAccordions} from "@/lib/page-accordion-state";
import { clearCustomerCopy } from "@/lib/customer-copy";
import { browserSessionExpired, recordBrowserActivity } from "@/lib/browser-activity";
import { clearMessengerCache } from "@/lib/messenger-cache";
import { clearLinksCache } from "@/lib/consultant-links-cache";
import { clearResourceCache } from "@/lib/client-resource-cache";
import { LiveChannel, LiveHub } from "@/lib/live-client";
import type { AuthChangeEvent, AuthError, Session, User } from "@/lib/auth/types";

/*
 * Browser client for NXTDOX's own login and live updates (Supabase removed).
 * It keeps the method names the app already used — auth.getSession,
 * auth.signInWithPassword, channel(...) — so components did not change.
 * Sessions are stored under the same localStorage key as before.
 */
const AUTH_STORAGE_KEY = "walker-docs-next.auth.session";

type BrowserStorageAdapter = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void };
const persistentBrowserStorage: BrowserStorageAdapter = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    try {
      const persisted = window.localStorage.getItem(key);
      if (persisted) return persisted;
      // Preserve an existing login when upgrading from tab-only session storage.
      const previousSession = window.sessionStorage.getItem(key);
      if (previousSession) { window.localStorage.setItem(key, previousSession); window.sessionStorage.removeItem(key); }
      return previousSession;
    } catch { return null; }
  },
  setItem(key, value) { if (typeof window === "undefined") return; try { window.localStorage.setItem(key, value); window.sessionStorage.removeItem(key); } catch { /* storage blocked */ } },
  removeItem(key) { if (typeof window === "undefined") return; try { window.localStorage.removeItem(key); window.sessionStorage.removeItem(key); } catch { /* storage blocked */ } },
};

type Listener = (event: AuthChangeEvent, session: Session | null) => void;
type Result<T> = { data: T; error: AuthError | null };

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ ok: boolean; status: number; body: T & { error?: AuthError } }> {
  const headers: Record<string, string> = { ...(init.body ? { "Content-Type": "application/json" } : {}) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { ...init, headers, cache: "no-store", signal: controller.signal });
    const body = await response.json().catch(() => ({})) as T & { error?: AuthError };
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: { message: "Connection interrupted. Please retry.", status: 0 } } as T & { error?: AuthError } };
  } finally { clearTimeout(timer); }
}

function readStoredSession(): Session | null {
  try {
    const saved = JSON.parse(persistentBrowserStorage.getItem(AUTH_STORAGE_KEY) || "null") as Session | null;
    // Old Supabase logins (JWTs start with "eyJ") don't work on the new server; sign in once more.
    if (!saved?.access_token || saved.access_token.startsWith("eyJ") || typeof saved.user?.id !== "string") return null;
    return saved;
  } catch { return null; }
}

class BrowserAuth {
  private session: Session | null = null;
  private listeners = new Set<Listener>();
  private ready: Promise<void>;
  private recovering = false;

  constructor() {
    this.session = readStoredSession();
    if (!this.session) persistentBrowserStorage.removeItem(AUTH_STORAGE_KEY);
    this.ready = this.initialize();
    if (typeof window !== "undefined") {
      // Signing in or out in another tab updates this one too.
      window.addEventListener("storage", event => {
        if (event.key !== AUTH_STORAGE_KEY) return;
        const next = readStoredSession();
        if (next?.access_token === this.session?.access_token) return;
        this.session = next;
        this.emit(next ? "SIGNED_IN" : "SIGNED_OUT", next);
      });
    }
  }

  private async initialize() {
    if (typeof window === "undefined") return;
    // Password reset and invitation links arrive as #recovery_token=...
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryToken = hash.get("recovery_token");
    if (recoveryToken) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      const { ok, body } = await api<{ session?: Session }>("/api/auth/recovery", { method: "POST", body: JSON.stringify({ token: recoveryToken }) });
      if (ok && body.session) { this.store(body.session); this.recovering = true; }
      return;
    }
    // Confirm a stored session is still valid (it may have been signed out elsewhere).
    if (this.session) {
      const token = this.session.access_token;
      const { ok, status, body } = await api<{ user?: User }>("/api/auth/user", { token });
      if (ok && body.user && this.session?.access_token === token) { this.session = { ...this.session, user: body.user }; persistentBrowserStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.session)); }
      else if (status === 401 && this.session?.access_token === token) { this.store(null); this.emit("SIGNED_OUT", null); }
    }
  }

  private store(session: Session | null) {
    this.session = session;
    if (session) persistentBrowserStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    else persistentBrowserStorage.removeItem(AUTH_STORAGE_KEY);
  }
  private emit(event: AuthChangeEvent, session: Session | null) { for (const listener of [...this.listeners]) { try { listener(event, session); } catch { /* one listener must not break others */ } } }

  currentToken() { return this.session?.access_token; }

  async getSession(): Promise<Result<{ session: Session | null }>> {
    await this.ready;
    return { data: { session: this.session }, error: null };
  }
  async getUser(): Promise<Result<{ user: User | null }>> {
    await this.ready;
    if (!this.session) return { data: { user: null }, error: { message: "Auth session missing!", status: 401 } };
    const { ok, body } = await api<{ user?: User }>("/api/auth/user", { token: this.session.access_token });
    return ok && body.user ? { data: { user: body.user }, error: null } : { data: { user: null }, error: body.error || { message: "Sign in again.", status: 401 } };
  }
  onAuthStateChange(callback: Listener) {
    this.listeners.add(callback);
    void this.ready.then(() => {
      if (!this.listeners.has(callback)) return;
      if (this.recovering) callback("PASSWORD_RECOVERY", this.session);
      callback("INITIAL_SESSION", this.session);
    });
    return { data: { subscription: { id: String(Math.random()), callback, unsubscribe: () => { this.listeners.delete(callback); } } } };
  }
  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<Result<{ session: Session | null; user: User | null }>> {
    await this.ready;
    const { ok, body } = await api<{ session?: Session }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (!ok || !body.session) return { data: { session: null, user: null }, error: body.error || { message: "Could not sign in.", status: 400 } };
    this.store(body.session);
    this.emit("SIGNED_IN", body.session);
    return { data: { session: body.session, user: body.session.user }, error: null };
  }
  async signOut(): Promise<{ error: AuthError | null }> {
    const token = this.session?.access_token;
    this.store(null);
    this.emit("SIGNED_OUT", null);
    if (token) void api("/api/auth/logout", { method: "POST", token });
    return { error: null };
  }
  async refreshSession(): Promise<Result<{ session: Session | null; user: User | null }>> {
    await this.ready;
    if (!this.session) return { data: { session: null, user: null }, error: { message: "Auth session missing!", status: 401 } };
    const token = this.session.access_token;
    const { ok, status, body } = await api<{ user?: User }>("/api/auth/user", { token });
    if (ok && body.user) {
      this.store({ ...this.session, user: body.user });
      this.emit("TOKEN_REFRESHED", this.session);
      return { data: { session: this.session, user: body.user }, error: null };
    }
    if (status === 401) { this.store(null); this.emit("SIGNED_OUT", null); }
    return { data: { session: null, user: null }, error: body.error || { message: "Sign in again.", status } };
  }
  async updateUser(attributes: { password?: string }): Promise<Result<{ user: User | null }>> {
    await this.ready;
    if (!this.session) return { data: { user: null }, error: { message: "Auth session missing!", status: 401 } };
    if (!attributes.password) return { data: { user: this.session.user }, error: null };
    const { ok, body } = await api<{ user?: User }>("/api/auth/password", { method: "POST", token: this.session.access_token, body: JSON.stringify({ password: attributes.password }) });
    if (!ok || !body.user) return { data: { user: null }, error: body.error || { message: "Could not update the password.", status: 400 } };
    this.recovering = false;
    this.store({ ...this.session, user: body.user });
    this.emit("USER_UPDATED", this.session);
    return { data: { user: body.user }, error: null };
  }
  async resetPasswordForEmail(email: string, options: { redirectTo?: string } = {}): Promise<Result<Record<string, never>>> {
    const { ok, body } = await api("/api/auth/recover", { method: "POST", body: JSON.stringify({ email, redirectTo: options.redirectTo }) });
    return ok ? { data: {}, error: null } : { data: {}, error: body.error || { message: "Could not send the reset email.", status: 400 } };
  }
  // Sessions last 30 days and slide forward on use, so there is nothing to refresh on a timer.
  async startAutoRefresh() { /* not needed */ }
  async stopAutoRefresh() { /* not needed */ }
}

type BrowserClient = {
  auth: BrowserAuth;
  channel(name: string, options?: { config?: { presence?: { key?: string } } }): LiveChannel;
  removeChannel(channel: LiveChannel): Promise<"ok">;
  storage: { from(bucket: string): { uploadToSignedUrl(path: string, token: string, file: Blob, options?: { contentType?: string }): Promise<{ data: { path: string } | null; error: { message: string } | null }> } };
};

let browserClient: BrowserClient | null = null;

export function isSupabaseConfigured() { return true; }
export function getSupabaseConfigError() { return ""; }

export function forgetBrowserSession() {
  clearCustomerCopy();
  persistentBrowserStorage.removeItem(AUTH_STORAGE_KEY);
  clearResourceCache();clearPageAccordions();
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
  } catch { /* malformed session data is discarded on read */ }
}

export function getSupabaseBrowserClient(): BrowserClient {
  if (!browserClient) {
    expireStoredBrowserSession();
    const auth = new BrowserAuth();
    const hub = new LiveHub(() => auth.currentToken());
    browserClient = {
      auth,
      channel: (name, options) => new LiveChannel(name, hub, options?.config?.presence?.key),
      removeChannel: async channel => { await channel.unsubscribe(); return "ok"; },
      storage: {
        from: bucket => ({
          async uploadToSignedUrl(path, token, file, options = {}) {
            const url = `/api/storage/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
            try {
              const response = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": options.contentType || file.type || "application/octet-stream" } });
              const body = await response.json().catch(() => ({})) as { error?: string };
              return response.ok ? { data: { path }, error: null } : { data: null, error: { message: body.error || "Upload failed. Try again." } };
            } catch { return { data: null, error: { message: "Upload was interrupted. Try again." } }; }
          },
        }),
      },
    };
  }
  return browserClient;
}

let sessionRestore: Promise<Result<{ session: Session | null }>> | null = null;
/** Retry buttons share the pending session check instead of queueing more work. */
export function restoreBrowserSession() {
  if (!sessionRestore) sessionRestore = getSupabaseBrowserClient().auth.getSession().finally(() => { sessionRestore = null; });
  return sessionRestore;
}

export function getAuthRedirectUrl() {
  if (typeof window === "undefined") return "/deal-sheet";
  return `${window.location.origin}/deal-sheet`;
}

export function getSessionLabel(session: Session | null) {
  return session?.user?.email?.trim() || "Authorized User";
}
