"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatAnnouncementDate, markAnnouncementsRead, readAnnouncementIds, type Announcement } from "@/lib/announcements";
import { useAnnouncements } from "@/lib/announcements-client";
import styles from "./notification-center.module.css";

/** Unread announcement ids for this account on this device. Empty until mounted, to avoid hydration mismatch. */
export function useUnreadAnnouncements(userId: string) {
  const announcements = useAnnouncements();
  const [unread, setUnread] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => { const read = readAnnouncementIds(userId); setUnread(announcements.filter(a => !read.has(a.id)).map(a => a.id)); };
    refresh();
    window.addEventListener("announcements-read", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("announcements-read", refresh); window.removeEventListener("storage", refresh); };
  }, [userId, announcements]);
  return unread;
}

export function AnnouncementCard({ item, unread, headingLevel = 3 }: { item: Announcement; unread: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <article className={styles.item}>
    <header className={styles.itemHead}>
      <Heading className={styles.itemTitle}>{unread && <span className={styles.newTag}>New</span>}{item.title}</Heading>
      <time dateTime={item.date} className={styles.date}>{formatAnnouncementDate(item.date)}</time>
    </header>
    {item.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    {item.link && <a className={styles.linkButton} href={item.link.url} target={item.link.url.startsWith("https://nextdox.app") ? undefined : "_blank"} rel="noopener noreferrer">{item.link.label}</a>}
    {item.signoff && <p className={styles.signoff}>{item.signoff.map((line, i) => <span key={i}>{line}</span>)}</p>}
  </article>;
}

export function NotificationCenter({ userId, className }: { userId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const announcements = useAnnouncements();
  const unread = useUnreadAnnouncements(userId);
  const button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => { setOpen(false); if (returnFocus) button.current?.focus(); }, []);
  // The bell lists only what is still unread. Items clear when marked read; history lives on the Notifications page.
  const toggle = () => { if (open) { close(false); return; } setOpen(true); };
  const markRead = (id: string) => markAnnouncementsRead(userId, [id]);
  const markAll = () => markAnnouncementsRead(userId, announcements.map(a => a.id));

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open, close]);

  const label = unread.length ? `Notifications, ${unread.length} new` : "Notifications";
  return <div className={styles.wrap}>
    <button ref={button} type="button" className={`${className || ""} ${styles.bell}`} aria-label={label} aria-expanded={open} aria-controls={panelId} onClick={toggle}>
      <Bell aria-hidden="true" />
      {unread.length > 0 && <span aria-hidden="true">{unread.length > 9 ? "9+" : unread.length}</span>}
    </button>
    {open && <div ref={panel} id={panelId} className={styles.panel} role="region" aria-label="Notifications" tabIndex={-1}>
      <div className={styles.panelHead}><strong>Notifications</strong><span className={styles.headActions}>{unread.length > 0 && <button type="button" className={styles.markAll} onClick={markAll}>Mark all read</button>}<Link prefetch={false} href="/notifications" onClick={() => close(false)}>View all</Link></span></div>
      <div className={styles.list}>
        {unread.length === 0 ? <p className={styles.empty}>You&apos;re all caught up.</p> : announcements.filter(item => unread.includes(item.id)).map(item => <div key={item.id} className={styles.unreadItem}>
          <AnnouncementCard item={item} unread />
          <button type="button" className={styles.markOne} onClick={() => markRead(item.id)}>Mark read</button>
        </div>)}
      </div>
    </div>}
  </div>;
}
