"use client";

import {
  getPermission,
  notificationsSupported,
  requestPermission,
  setDismissed,
  subscribeToPush,
  wasDismissed,
} from "@/lib/notifications";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * A small banner that asks for browser notification permission.
 * Shows only when:
 *  - Browser supports Notifications API
 *  - Permission is still "default" (not yet asked)
 *  - User hasn't dismissed it before
 */
export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notificationsSupported()) return;
    if (getPermission() !== "default") return;
    if (wasDismissed()) return;
    // Short delay so it doesn't flash during page load
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  async function handleAllow() {
    const result = await requestPermission();
    if (result === "granted") {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const token = data.session?.access_token;
      const subscribed = token ? await subscribeToPush(token) : false;
      if (subscribed) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("Walker Docs", {
          body: "Message notifications are enabled.",
          icon: "/android-chrome-192x192.png",
        });
      } else {
        new Notification("Walker Docs", {
          body: "Notifications are enabled while the app is open.",
          icon: "/android-chrome-192x192.png",
        });
      }
    }
    setVisible(false);
  }

  function handleDismiss() {
    setDismissed();
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md animate-[slideUp_0.3s_ease-out] border border-white/15 bg-[#1c1c1e] px-5 py-4 shadow-[0_0_40px_rgba(190,23,23,0.2),0_24px_60px_rgba(0,0,0,0.5)] sm:left-auto sm:right-6 sm:mx-0">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 text-2xl">🔔</span>
        <div>
          <p className="text-sm font-bold text-white">Walker Docs Needs Your Permission</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Features like printing documents, deal reminders, and workflow alerts require browser permissions to work properly. Without them, some core functions may not be available.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAllow}
          className="flex min-h-10 flex-1 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex min-h-10 flex-1 items-center justify-center border border-white/20 bg-white/5 text-sm font-bold uppercase tracking-[0.08em] text-white/60 transition hover:bg-white/10"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
