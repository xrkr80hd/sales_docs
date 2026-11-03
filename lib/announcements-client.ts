"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { requestJson } from "@/lib/request-json";
import { announcements as builtIn, type Announcement } from "@/lib/announcements";

/*
 * Every announcement a user can see: the built-in ones plus those sent from the
 * Notification Center. Loaded once, refreshed at most every 5 minutes (and when
 * the tab comes back into view), so the bell costs almost nothing in DB calls.
 */
const REFRESH_MS = 5 * 60 * 1000;
const order = (a: Announcement) => a.postedAt || `${a.date}T12:00:00.000Z`;
const merge = (remote: Announcement[]) => [...remote, ...builtIn].sort((a, b) => order(b).localeCompare(order(a)));

let all: Announcement[] = merge([]);
let loadedAt = 0, loadedFor = "";
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export async function refreshAnnouncements(token: string, force = false) {
  if (!token) return;
  if (!force && loadedFor === token && Date.now() - loadedAt < REFRESH_MS) return;
  if (pending && !force) return pending;
  pending = requestJson<{ announcements: Announcement[] }>("/api/announcements", { headers: { Authorization: `Bearer ${token}` } })
    .then(value => { all = merge(Array.isArray(value.announcements) ? value.announcements : []); loadedAt = Date.now(); loadedFor = token; emit(); })
    .catch(() => undefined)
    .finally(() => { pending = null; });
  return pending;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const serverSnapshot = merge([]);

export function useAnnouncements(): Announcement[] {
  const { accessToken } = useSession();
  const token = accessToken || "";
  useEffect(() => {
    void refreshAnnouncements(token);
    const visible = () => { if (document.visibilityState === "visible") void refreshAnnouncements(token); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [token]);
  return useSyncExternalStore(subscribe, () => all, () => serverSnapshot);
}
