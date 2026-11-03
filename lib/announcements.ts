/*
 * Site-wide announcements for the notification center. They live in code rather
 * than the database so they still show when the data service is slow or down.
 * Newest first. Give each a new, never-reused id: read state is keyed by id.
 */
export type Announcement = {
  id: string;
  date: string; // YYYY-MM-DD, Central time
  title: string;
  paragraphs: string[];
  signoff?: string[];
};

export const announcements: Announcement[] = [
  {
    id: "2026-10-moving-off-supabase",
    date: "2026-10-25",
    title: "NextDocs is moving to a new home",
    paragraphs: [
      "NextDocs will be moving off Supabase soon. While we make the move, there may be some delays, possibly a few days of downtime, to make sure everything goes smoothly. You may also need to redo some of your setup once we've moved.",
      "Once we're established at the new residence, it's going to be a very solid system with little to no downtime. Please be patient with us while we build this out.",
    ],
    signoff: ["Thank you so much,", "Yours truly, XRKR80HD"],
  },
];

const key = (userId: string) => `nextdocs.notifications.read.v1:${userId || "anonymous"}`;

/** Read state is a per-device convenience only; failures fall back to "unread". */
export function readAnnouncementIds(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markAnnouncementsRead(userId: string, ids: string[]) {
  try {
    const next = new Set([...readAnnouncementIds(userId), ...ids]);
    window.localStorage.setItem(key(userId), JSON.stringify([...next].slice(-200)));
  } catch {
    /* Storage unavailable (private mode, blocked): the dot simply shows again next visit. */
  }
  window.dispatchEvent(new Event("announcements-read"));
}

export function formatAnnouncementDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
