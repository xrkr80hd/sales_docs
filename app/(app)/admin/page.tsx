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
  card_enabled?: boolean;
  card_slug?: string | null;
  card_is_published?: boolean;
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
  const [copiedCardId, setCopiedCardId] = useState("");

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

  async function copyCardLink(user: UserRow) {
    if (!user.card_slug) return;
    const cardUrl = `${window.location.origin}/card/${user.card_slug}`;
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopiedCardId(user.id);
      window.setTimeout(() => setCopiedCardId(""), 2500);
    } catch {
      window.prompt("Copy this business-card link:", cardUrl);
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
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    try {
      await apiFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
      loadData();
    }
  }

  async function handleToggleCard(id: string, currentStatus: boolean) {
    setError("");
    const nextStatus = !currentStatus;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, card_enabled: nextStatus } : u)));
    try {
      await apiFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ card_enabled: nextStatus }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle card permission.");
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
      <Link href="/admin/messenger" className="flex items-center justify-between rounded-2xl border border-[#2e3035] bg-gradient-to-r from-[#22252a] to-[#131519] px-6 py-4 font-bold text-white shadow-lg transition hover:border-[#be1717]">
        <span><span className="block text-xs uppercase tracking-widest text-[var(--accent)] font-mono">Organizations &amp; permissions</span>Manage NXTDox Messenger</span>
        <span aria-hidden className="text-xl">→</span>
      </Link>

      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/40 px-5 py-3 text-sm font-bold text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#2e3035] bg-[#17191d] p-8 text-center">
          <p className="text-sm font-bold text-neutral-400">Loading admin console…</p>
        </div>
      ) : (
        /* ── Single unified dark panel ── */
        <div className="overflow-hidden rounded-2xl border border-[#2e3035] bg-gradient-to-b from-[#1c1f24] to-[#121418] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">

          {/* ── Send Invite (inline) ── */}
          <div className="px-5 py-5 sm:px-6">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)] font-mono">
              Send Invite
            </h3>
            <form onSubmit={handleInvite} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="email"
                required
                placeholder="team@walkerautomotive.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.currentTarget.value)}
                className="h-11 rounded-xl border border-[#2e3035] bg-[#0f1114] px-4 text-sm text-[#f7f7f7] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.currentTarget.value as "user" | "admin")}
                title="Invite role"
                className="h-11 rounded-xl border border-[#2e3035] bg-[#0f1114] px-4 text-sm text-[#f7f7f7] outline-none transition focus:border-[var(--accent)]"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviteSending}
                className="h-11 rounded-xl bg-[var(--accent)] px-6 text-[11px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-red-600 disabled:opacity-40"
              >
                {inviteSending ? "Sending…" : "Invite"}
              </button>
            </form>
            {inviteStatus && (
              <p className="mt-2 text-xs font-bold text-emerald-400">
                {inviteStatus}
              </p>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-[#2e3035]" />

          {/* ── Team Members ── */}
          <div className="px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setShowUsers((v) => !v)}
              className="flex w-full items-center justify-between py-2 text-left"
            >
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400 font-mono">
                Team Members
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-white">({users.length})</span>
              </h3>
              <span className={`text-sm text-neutral-400 transition-transform ${showUsers ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {showUsers && (
              <div className="divide-y divide-[#2e3035] pt-2">
                {users.length === 0 ? (
                  <p className="py-4 text-sm text-neutral-400">No users registered yet.</p>
                ) : (
                  users.map((u) => {
                    const isOwner = u.email.toLowerCase() === "xrkr80hd@gmail.com";
                    return (
                      <div key={u.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-[#f7f7f7]">
                              {u.display_name || u.email.split("@")[0]}
                            </span>
                            {isOwner && (
                              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400">
                                Total Admin &amp; Owner
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-all text-xs leading-4 text-neutral-400">{u.email}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                          <button
                            type="button"
                            onClick={() => void copyCardLink(u)}
                            disabled={!u.card_slug}
                            title={u.card_slug ? `Copy ${u.display_name || u.email}'s public business-card link` : "This consultant has not created a business card yet"}
                            className="col-span-2 min-h-10 rounded-lg border border-[#f97316]/45 bg-[#f97316]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#fb923c] transition hover:border-[#fb923c] hover:bg-[#f97316]/20 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-600 sm:col-span-1 sm:rounded-full"
                          >
                            {copiedCardId === u.id ? "✓ Link Copied" : u.card_slug ? "Copy Card Link" : "Card Not Created"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleCard(u.id, Boolean(u.card_enabled || isOwner))}
                            disabled={isOwner}
                            title={u.card_enabled || isOwner ? "Card permission granted" : "Click to grant card permission"}
                            className={`min-h-10 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition sm:rounded-full ${
                              u.card_enabled || isOwner
                                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                                : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500 hover:text-white"
                            }`}
                          >
                            {u.card_enabled || isOwner ? "✓ Card Enabled" : "+ Enable Card"}
                          </button>

                          <select
                            value={u.role}
                            disabled={isOwner}
                            onChange={(e) => handleRoleChange(u.id, e.currentTarget.value)}
                            title={`Change role for ${u.display_name || u.email}`}
                            className={`h-10 min-w-0 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.08em] outline-none transition focus:border-[var(--accent)] ${
                              u.role === "admin"
                                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                                : "border-[#2e3035] bg-[#0f1114] text-neutral-300"
                            }`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>

                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(u.id, u.email)}
                              className="col-span-2 min-h-10 rounded-lg border border-[#2e3035] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400 transition hover:border-red-800/40 hover:bg-red-950/30 hover:text-red-300 sm:col-span-1"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-[#2e3035]" />

          {/* ── Invites ── */}
          <div className="px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setShowInvites((v) => !v)}
              className="flex w-full items-center justify-between py-2 text-left"
            >
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400 font-mono">
                Invites
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-white">({invites.filter((i) => !i.accepted_at).length} pending)</span>
              </h3>
              <span className={`text-sm text-neutral-400 transition-transform ${showInvites ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {showInvites && (
              <div className="divide-y divide-[#2e3035] pt-2">
                {invites.length === 0 ? (
                  <p className="py-4 text-sm text-neutral-400">No pending invites.</p>
                ) : (
                  invites.map((inv) => (
                    <div key={inv.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <span className="block break-all text-sm font-bold text-[#f7f7f7]">
                          {inv.email}
                        </span>
                        <span className="mt-1 block text-xs text-neutral-400">
                          {new Date(inv.created_at).toLocaleDateString()} → {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 items-center gap-2 sm:flex">
                        <span className={`rounded-lg border px-2 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] sm:rounded-full sm:py-1 ${inv.accepted_at ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300" : "border-amber-500/30 bg-amber-950/40 text-amber-300"}`}>
                          {inv.accepted_at ? "Accepted" : "Pending"}
                        </span>
                        <span className="rounded-lg border border-[#2e3035] bg-[#0f1114] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-300">
                          {inv.role}
                        </span>
                        <button type="button" onClick={() => handleRevokeInvite(inv.id, inv.email)} className="rounded-lg border border-[#2e3035] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 transition hover:border-red-800/40 hover:bg-red-950/30 hover:text-red-300">
                          {inv.accepted_at ? "Delete" : "Revoke"}
                        </button>
                      </div>
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
