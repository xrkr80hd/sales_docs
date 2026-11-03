"use client";
import { useEffect, useState } from "react";
import { announcements, markAnnouncementsRead } from "@/lib/announcements";
import { AnnouncementCard, useUnreadAnnouncements } from "./notification-center";
import { useWorkspaceIdentity } from "./workspace-context";
import styles from "./notification-center.module.css";

export function NotificationsPage() {
  const userId = useWorkspaceIdentity()?.id || "";
  const unread = useUnreadAnnouncements(userId);
  const [shownUnread, setShownUnread] = useState<string[] | null>(null);
  useEffect(() => {
    // Capture what was new on arrival, then mark it read.
    if (shownUnread === null && unread.length) { setShownUnread(unread); markAnnouncementsRead(userId, announcements.map(a => a.id)); }
  }, [unread, userId, shownUnread]);
  return <div className={styles.page}>
    <p className={styles.kicker}>NXTDOX · UPDATES</p>
    <h1>Notifications</h1>
    <p className={styles.intro}>News about NextDocs: changes, planned downtime and what&apos;s coming.</p>
    <section className={styles.pageList} aria-label="All notifications">
      {announcements.length === 0 ? <p className={styles.empty}>You&apos;re all caught up.</p> : announcements.map(item => <AnnouncementCard key={item.id} item={item} unread={(shownUnread || []).includes(item.id)} headingLevel={2} />)}
    </section>
  </div>;
}
