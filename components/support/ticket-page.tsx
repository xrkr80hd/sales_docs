"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LifeBuoy, Send } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { notifySave } from "@/components/ui/save-toast-host";
import { requestJson } from "@/lib/request-json";
import { CATEGORY_LABELS, STATUS_LABELS, type TicketView } from "./ticket-types";
import styles from "./tickets.module.css";

/** Every role, every organization: report a problem, ask a question or suggest an idea. */
export function TicketPage() {
  const { accessToken } = useSession();
  const token = accessToken || "";
  const from = useSearchParams().get("from") || "";
  const [category, setCategory] = useState("problem");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [tickets, setTickets] = useState<TicketView[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { setTickets((await requestJson<{ tickets: TicketView[] }>("/api/tickets", { headers: { Authorization: `Bearer ${token}` } })).tickets); }
    catch { setTickets(current => current ?? []); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    setBusy(true); setError(""); setSent(false); notifySave("saving", "Sending your ticket…");
    try {
      await requestJson("/api/tickets", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ category, subject, details, page: from }) });
      setSubject(""); setDetails(""); setCategory("problem"); setSent(true);
      notifySave("success", "Ticket sent. Thank you!");
      void load();
    } catch (failure) { const text = failure instanceof Error ? failure.message : "Your ticket could not be sent."; setError(text); notifySave("error", text); }
    finally { setBusy(false); }
  }

  return <div className={`nxt-house ${styles.page}`}>
    <header className="nxt-page-header"><p className={styles.kicker}>HELP &amp; FEEDBACK</p><h1>Submit a Ticket</h1><p className={styles.muted}>Something not working, a question, or an idea? Send it here. It goes straight to the NextDocs admin.</p></header>

    <section className={`nxt-panel ${styles.card}`} aria-labelledby="new-ticket">
      <h2 id="new-ticket"><LifeBuoy size={18} aria-hidden="true" />New ticket</h2>
      <label>What is this about?
        <select value={category} onChange={event => setCategory(event.target.value)} disabled={busy}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Subject<input value={subject} maxLength={160} onChange={event => setSubject(event.target.value)} placeholder="Sales Commander won't save my goal" disabled={busy} /></label>
      <label>Details<textarea value={details} maxLength={6000} rows={7} onChange={event => setDetails(event.target.value)} placeholder="What were you doing, what did you expect, and what happened instead? Include the customer or deal only if it helps, and never card or Social Security numbers." disabled={busy} /></label>
      {from && <p className={styles.muted}>Sent from: {from}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {sent && <p className={styles.success} role="status">Ticket sent. You can follow it below.</p>}
      <div className={styles.actions}><button type="button" className="nxt-btn-primary" disabled={busy || !subject.trim() || !details.trim()} onClick={() => void submit()}><Send size={16} aria-hidden="true" />{busy ? "Sending…" : "Send ticket"}</button></div>
    </section>

    <section aria-labelledby="my-tickets">
      <h2 id="my-tickets" className={styles.sectionTitle}>Your tickets</h2>
      {tickets === null ? <p className={styles.muted} role="status">Loading…</p> : tickets.length === 0 ? <p className={styles.muted}>You haven&apos;t sent any tickets yet.</p> : <ul className={styles.list}>
        {tickets.map(ticket => <li key={ticket.id} className="nxt-panel">
          <div className={styles.ticketHead}><strong>{ticket.subject}</strong><span className={`${styles.status} ${styles[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span></div>
          <p className={styles.meta}>{CATEGORY_LABELS[ticket.category]} · {new Date(ticket.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          <p className={styles.details}>{ticket.details}</p>
          {ticket.adminNote && <p className={styles.reply}><strong>Reply from the admin:</strong> {ticket.adminNote}</p>}
        </li>)}
      </ul>}
    </section>
  </div>;
}
