"use client";

import { useEffect } from "react";

type AnalyticsEvent = "card_view" | "call_click" | "text_click" | "email_click" | "listing_click";

function record(slug: string, eventType: AnalyticsEvent) {
  const viewKey = `nxtdocs.${eventType}.${slug}`;
  if (eventType === "card_view" && window.sessionStorage.getItem(viewKey)) return;
  if (eventType === "card_view") window.sessionStorage.setItem(viewKey, "1");
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, eventType }),
    keepalive: true,
  }).catch(() => undefined);
}

export function PublicCardAnalytics({ slug }: { slug: string }) {
  useEffect(() => {
    record(slug, "card_view");
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      const href = anchor?.getAttribute("href") || "";
      if (href.startsWith("tel:")) record(slug, "call_click");
      else if (href.startsWith("sms:")) record(slug, "text_click");
      else if (href.startsWith("mailto:")) record(slug, "email_click");
      else if (anchor?.textContent?.toLowerCase().includes("listing")) record(slug, "listing_click");
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [slug]);

  return null;
}
