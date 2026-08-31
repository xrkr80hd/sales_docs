"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type UserRow = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // Sections
  const [showUsers, setShowUsers] = useState(true);
  const [showInvites, setShowInvites] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersRes, invitesRes] = await Promise.all([
        apiFetch<{ users: UserRow[] }>("/api/admin/users"),
        apiFetch<{ invites: InviteRow[] }>("/api/admin/invites"),
      ]);
      setUsers(usersRes.users);
      setInvites(invitesRes.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setInviteSending(true);
    setInviteStatus("");
    setError("");

    try {
      await apiFetch("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email, role: inviteRole }),
      });
      setInviteStatus(`Invite sent to ${email}`);
      setInviteEmail("");
      setInviteRole("user");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRemoveUser(id: string, email: string) {
    if (!confirm(`Remove ${email}? This deletes their account.`)) return;

    setError("");
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove user.");
    }
  }

  async function handleRevokeInvite(id: string, email: string) {
    if (!confirm(`Revoke invite for ${email}?`)) return;

    setError("");
    try {
      await apiFetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite.");
    }
  }

  async function handleRoleChange(id: string, newRole: string) {
    setError("");
    // Optimistic: update local state immediately so the page doesn't jump
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    try {
      await apiFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
      // Revert on failure
      loadData();
    }
  }

  return (
    <div className="grid gap-6">
      {/* ── Compact Hero ── */}
      <section className="overflow-hidden border border-black/10 bg-[var(--panel)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/walker-red-graphic-v2.png"
              alt="Walker Automotive graphic"
              width={160}
              height={58}
              priority
              className="h-auto w-[120px]"
            />
            <div>
              <h2 className="text-xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-2xl">
                Admin Console
              </h2>
              <p className="text-xs text-white/60">
                Manage team access, invites &amp; roles
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Error banner ── */}
      <Link href="/admin/messenger" className="flex items-center justify-between border border-black/10 bg-white px-5 py-4 font-bold shadow-sm">
        <span><span className="block text-xs uppercase tracking-widest text-[var(--accent)]">Organizations &amp; permissions</span>Manage NXTDox Messenger</span>
        <span aria-hidden>→</span>
      </Link>

      {error && (
        <div className="border border-red-900/20 bg-red-50 px-5 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-black/10 bg-white p-6">
          <p className="text-sm font-bold text-[var(--muted)]">Loading…</p>
        </div>
      ) : (
        /* ── Single unified panel ── */
        <div className="overflow-hidden border border-black/10 bg-white shadow-[0_18px_44px_rgba(35,23,12,0.08)]">

          {/* ── Send Invite (inline) ── */}
          <div className="px-5 py-4 sm:px-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Send Invite
            </h3>
            <form onSubmit={handleInvite} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="email"
                required
                placeholder="team@walkerautomotive.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.currentTarget.value)}
                className="h-10 border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.currentTarget.value as "user" | "admin")}
                title="Invite role"
                className="h-10 border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviteSending}
                className="h-10 rounded-[16px] border border-[var(--accent)] bg-[var(--accent)] px-5 text-[11px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-40"
              >
                {inviteSending ? "Sending…" : "Invite"}
              </button>
            </form>
            {inviteStatus && (
              <p className="mt-2 text-xs font-bold text-[var(--success)]">
                {inviteStatus}
              </p>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-[var(--border)]" />

          {/* ── Team Members ── */}
          <div className="px-5 sm:px-6">
            <button
              type="button"
              onClick={() => setShowUsers((v) => !v)}
              className="flex w-full items-center justify-between py-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Team Members
                <span className="ml-1.5 text-[var(--foreground)]">({users.length})</span>
              </h3>
              <span className={`text-sm text-[var(--muted)] transition-transform ${showUsers ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {showUsers && (
              <div className="divide-y divide-[var(--border)] pb-1">
                {users.length === 0 ? (
                  <p className="py-3 text-sm text-[var(--muted)]">No users yet.</p>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-[var(--foreground)]">
                          {u.display_name || u.email.split("@")[0]}
                        </span>
                        <span className="mx-2 text-[var(--border)]">·</span>
                        <span className="text-xs text-[var(--muted)]">{u.email}</span>
                      </div>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.currentTarget.value)}
                        title={`Change role for ${u.display_name || u.email}`}
                        className={`min-w-[120px] border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition focus:border-[var(--accent)] ${u.role === "admin"
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)]"
                          }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(u.id, u.email)}
                        className="shrink-0 rounded-[16px] border border-transparent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-[var(--border)]" />

          {/* ── Invites ── */}
          <div className="px-5 sm:px-6">
            <button
              type="button"
              onClick={() => setShowInvites((v) => !v)}
              className="flex w-full items-center justify-between py-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Invites
                <span className="ml-1.5 text-[var(--foreground)]">({invites.filter((i) => !i.accepted_at).length} pending)</span>
              </h3>
              <span className={`text-sm text-[var(--muted)] transition-transform ${showInvites ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {showInvites && (
              <div className="divide-y divide-[var(--border)] pb-1">
                {invites.length === 0 ? (
                  <p className="py-3 text-sm text-[var(--muted)]">No invites sent yet.</p>
                ) : (
                  invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-[var(--foreground)]">
                          {inv.email}
                        </span>
                        <span className="mx-2 text-[var(--border)]">·</span>
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(inv.created_at).toLocaleDateString()} → {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${inv.accepted_at
                          ? "border-[var(--success)] bg-green-50 text-[var(--success)]"
                          : "border-[var(--warn)] bg-amber-50 text-[var(--warn)]"
                          }`}
                      >
                        {inv.accepted_at ? "Accepted" : "Pending"}
                      </span>
                      <span className="shrink-0 border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {inv.role}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id, inv.email)}
                        className="shrink-0 rounded-[16px] border border-transparent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {inv.accepted_at ? "Delete" : "Revoke"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
