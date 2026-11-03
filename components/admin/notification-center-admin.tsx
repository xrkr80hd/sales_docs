"use client";
import { useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "@/components/command-center/workspace-context";
import { AnnouncementCard } from "@/components/command-center/notification-center";
import { notifySave } from "@/components/ui/save-toast-host";
import { refreshAnnouncements, useAnnouncements } from "@/lib/announcements-client";
import { requestJson } from "@/lib/request-json";
import type { Announcement } from "@/lib/announcements";
import styles from "./notification-center-admin.module.css";

const SIGNOFF = "Thank you so much,\nYours truly, XRKR80HD";
const starters: { label: string; title: string; body: string; linkUrl?: string; linkLabel?: string }[] = [
  { label: "We're Home", title: "We're Home!!!", body: "NextDocs has officially moved into its new home.\n\nWrite your message here.", linkUrl: "https://nextdox.app", linkLabel: "Open nextdox.app" },
  { label: "What's new", title: "What's new in NextDocs", body: "Here's what changed in this update:\n\n• \n• \n• " },
  { label: "Heads up", title: "Heads up", body: "Write your message here." },
];
const empty = { title: "", body: "", signoff: SIGNOFF, linkUrl: "", linkLabel: "" };

/** Master admin: write a message, preview it, send it to everyone's bell. */
export function NotificationCenterAdmin() {
  const { accessToken } = useSession();
  const token = accessToken || "";
  const all = useAnnouncements();
  const sent = all.filter(item => item.id.startsWith("db-"));
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState("");
  const identity = useWorkspaceIdentity();
  const isAdmin = identity?.role === "admin" || identity?.email?.toLowerCase() === "xrkr80hd@gmail.com";

  const set = (field: keyof typeof empty) => (event: { target: { value: string } }) => setDraft(current => ({ ...current, [field]: event.target.value }));
  const preview: Announcement = {
    id: "preview", date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }),
    title: draft.title.trim() || "Your title",
    paragraphs: (draft.body.trim() || "Your message").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
    signoff: draft.signoff.trim() ? draft.signoff.split("\n").map(l => l.trim()).filter(Boolean) : undefined,
    link: draft.linkUrl.trim() ? { url: draft.linkUrl.trim(), label: draft.linkLabel.trim() || "Open link" } : undefined,
  };

  async function send() {
    setBusy(true); setError(""); notifySave("saving", "Sending…");
    try {
      await requestJson("/api/announcements", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      await refreshAnnouncements(token, true);
      setDraft(empty);
      notifySave("success", "Sent. It's under everyone's bell now.");
    } catch (failure) { const text = failure instanceof Error ? failure.message : "Could not send."; setError(text); notifySave("error", text); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError(""); setConfirming("");
    try {
      await requestJson(`/api/announcements?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      await refreshAnnouncements(token, true);
      notifySave("success", "Deleted.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete."); }
    finally { setBusy(false); }
  }

  if (identity && !isAdmin) return <div className={`nxt-house ${styles.page}`}><p className={styles.muted}>The Notification Center is for the master admin.</p></div>;

  return <div className={`nxt-house ${styles.page}`}>
    <header className="nxt-page-header"><p className={styles.kicker}>MASTER ADMIN</p><h1>Notification Center</h1><p className={styles.muted}>Send a message to everyone. It shows up under the bell and on the Notifications page.</p></header>

    <div className={styles.layout}>
      <section className={`nxt-panel ${styles.card}`} aria-labelledby="compose-title">
        <h2 id="compose-title"><Megaphone size={18} aria-hidden="true" />New notification</h2>
        <div className={styles.starters} role="group" aria-label="Start from">
          {starters.map(starter => <button key={starter.label} type="button" className="nxt-btn" disabled={busy} onClick={() => setDraft({ ...empty, title: starter.title, body: starter.body, linkUrl: starter.linkUrl || "", linkLabel: starter.linkLabel || "" })}>{starter.label}</button>)}
        </div>
        <label>Title<input value={draft.title} maxLength={160} onChange={set("title")} placeholder="We're Home!!!" disabled={busy} /></label>
        <label>Message<textarea value={draft.body} maxLength={6000} rows={8} onChange={set("body")} placeholder="Leave a blank line between paragraphs." disabled={busy} /></label>
        <div className={styles.row}>
          <label>Link (optional)<input value={draft.linkUrl} maxLength={500} onChange={set("linkUrl")} placeholder="https://nextdox.app" inputMode="url" disabled={busy} /></label>
          <label>Button text<input value={draft.linkLabel} maxLength={80} onChange={set("linkLabel")} placeholder="Open nextdox.app" disabled={busy || !draft.linkUrl.trim()} /></label>
        </div>
        <label>Sign-off<textarea value={draft.signoff} maxLength={300} rows={2} onChange={set("signoff")} disabled={busy} /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className="nxt-btn-primary" disabled={busy || !draft.title.trim() || !draft.body.trim()} onClick={() => void send()}><Send size={16} aria-hidden="true" />{busy ? "Sending…" : "Send to everyone"}</button>
          <button type="button" className="nxt-btn" disabled={busy} onClick={() => setDraft(empty)}>Clear</button>
        </div>
      </section>

      <section className={styles.previewCol} aria-labelledby="preview-title">
        <h2 id="preview-title" className={styles.sectionTitle}>Preview</h2>
        <div className={`nxt-panel ${styles.preview}`}><AnnouncementCard item={preview} unread /></div>
      </section>
    </div>

    <section aria-labelledby="sent-title">
      <h2 id="sent-title" className={styles.sectionTitle}>Sent</h2>
      {sent.length === 0 ? <p className={styles.muted}>Nothing sent yet.</p> : <ul className={styles.sent}>
        {sent.map(item => <li key={item.id} className="nxt-panel">
          <AnnouncementCard item={item} unread={false} />
          <div className={styles.actions}>
            {confirming === item.id
              ? <><button type="button" className="nxt-btn-primary" disabled={busy} onClick={() => void remove(item.id)}>Yes, delete it</button><button type="button" className="nxt-btn" onClick={() => setConfirming("")}>Keep it</button></>
              : <button type="button" className="nxt-btn" disabled={busy} onClick={() => setConfirming(item.id)}><Trash2 size={15} aria-hidden="true" />Delete</button>}
          </div>
        </li>)}
      </ul>}
    </section>
  </div>;
}
