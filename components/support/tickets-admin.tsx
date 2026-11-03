"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "@/components/command-center/workspace-context";
import { notifySave } from "@/components/ui/save-toast-host";
import { requestJson } from "@/lib/request-json";
import { CATEGORY_LABELS, ROLE_LABELS, STATUS_LABELS, type TicketView } from "./ticket-types";
import styles from "./tickets.module.css";

type Filter = "active" | TicketView["status"] | "all";

/** Master admin: every ticket from every role and organization, with status and a reply. */
export function TicketsAdmin() {
  const { accessToken } = useSession();
  const token = accessToken || "";
  const identity = useWorkspaceIdentity();
  const isAdmin = identity?.role === "admin" || identity?.email?.toLowerCase() === "xrkr80hd@gmail.com";
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try { setTickets((await requestJson<{ tickets: TicketView[] }>("/api/tickets?all=1", { headers: { Authorization: `Bearer ${token}` } })).tickets); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Tickets could not load."); setTickets(current => current ?? []); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function update(ticket: TicketView, status: TicketView["status"]) {
    setBusy(ticket.id);
    try {
      const adminNote = notes[ticket.id] ?? ticket.adminNote;
      const { ticket: next } = await requestJson<{ ticket: TicketView }>("/api/tickets", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: ticket.id, status, adminNote }) });
      setTickets(current => current?.map(item => item.id === next.id ? next : item) ?? null);
      setNotes(current => { const copy = { ...current }; delete copy[ticket.id]; return copy; });
      notifySave("success", "Ticket updated.");
    } catch (failure) { notifySave("error", failure instanceof Error ? failure.message : "Could not update the ticket."); }
    finally { setBusy(""); }
  }

  if (identity && !isAdmin) return <div className={`nxt-house ${styles.page}`}><p className={styles.muted}>Tickets are for the master admin.</p></div>;
  const counts = { open: 0, in_progress: 0, resolved: 0 };
  tickets?.forEach(ticket => { counts[ticket.status]++; });
  const shown = (tickets || []).filter(ticket => filter === "all" ? true : filter === "active" ? ticket.status !== "resolved" : ticket.status === filter);

  return <div className={`nxt-house ${styles.page}`}>
    <header className="nxt-page-header"><p className={styles.kicker}>MASTER ADMIN</p><h1>Tickets</h1><p className={styles.muted}>Everything consultants, managers and F&amp;I have sent in. Your reply shows on their ticket.</p></header>
    <div className={styles.filters} role="group" aria-label="Show">
      {([["active", `Needs attention (${counts.open + counts.in_progress})`], ["open", `Open (${counts.open})`], ["in_progress", `In progress (${counts.in_progress})`], ["resolved", `Done (${counts.resolved})`], ["all", "All"]] as [Filter, string][]).map(([value, label]) =>
        <button key={value} type="button" className="nxt-btn" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      <button type="button" className="nxt-btn" onClick={() => void load()}>Refresh</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {tickets === null ? <p className={styles.muted} role="status">Loading tickets…</p> : shown.length === 0 ? <p className={styles.muted}>No tickets here.</p> : <ul className={styles.list}>
      {shown.map(ticket => <li key={ticket.id} className="nxt-panel">
        <div className={styles.ticketHead}><strong>{ticket.subject}</strong><span className={`${styles.status} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span></div>
        <p className={styles.meta}>{ticket.name || ticket.email || "Unknown user"} · {ROLE_LABELS[ticket.role] || ticket.role}{ticket.organization ? ` · ${ticket.organization}` : ""} · {CATEGORY_LABELS[ticket.category]} · {new Date(ticket.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{ticket.page ? ` · from ${ticket.page}` : ""}</p>
        {ticket.email && <p className={styles.meta}><a href={`mailto:${ticket.email}?subject=${encodeURIComponent("Re: " + ticket.subject)}`}>{ticket.email}</a></p>}
        <p className={styles.details}>{ticket.details}</p>
        <div className={styles.adminRow}>
          <select aria-label={`Status for ${ticket.subject}`} value={ticket.status} disabled={busy === ticket.id} onChange={event => void update(ticket, event.target.value as TicketView["status"])}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className={styles.actions} style={{ display: "grid" }}>
            <textarea aria-label={`Reply to ${ticket.name || "user"}`} rows={2} maxLength={4000} placeholder="Reply (they'll see this on their ticket)" value={notes[ticket.id] ?? ticket.adminNote} disabled={busy === ticket.id} onChange={event => setNotes(current => ({ ...current, [ticket.id]: event.target.value }))} />
            {notes[ticket.id] !== undefined && notes[ticket.id] !== ticket.adminNote && <button type="button" className="nxt-btn-primary" disabled={busy === ticket.id} onClick={() => void update(ticket, ticket.status)}>{busy === ticket.id ? "Saving…" : "Save reply"}</button>}
          </div>
        </div>
      </li>)}
    </ul>}
  </div>;
}
