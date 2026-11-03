"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const LOADED = process.env.NEXT_PUBLIC_BUILD_ID || "";
const CHECK_MS = 5 * 60 * 1000;

/*
 * Keeps open tabs current after a deploy. Checks the live build every few minutes and when
 * the tab comes back into view. When a newer one is live: a small "Refresh" bar, and the
 * next page change does a full reload onto the new version. Never reloads mid-typing.
 */
export function UpdatePrompt() {
  const pathname = usePathname();
  const [stale, setStale] = useState(false);
  const staleRef = useRef(false);
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (!LOADED) return;
    let timer = 0;
    const check = async () => {
      if (staleRef.current) return;
      try {
        const { build } = await (await fetch("/api/version", { cache: "no-store" })).json() as { build?: string };
        if (build && build !== LOADED) { staleRef.current = true; setStale(true); }
      } catch { /* offline: try again later */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    timer = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);

  // A page change after an update loads the new version instead of the old one in memory.
  useEffect(() => {
    if (pathname !== firstPath.current && staleRef.current) window.location.reload();
    firstPath.current = pathname;
  }, [pathname]);

  if (!stale) return null;
  return <div role="status" style={{ position: "fixed", left: "50%", bottom: "max(14px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 2000, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 16px", borderRadius: 12, background: "#131b1f", border: "1px solid #303c44", boxShadow: "0 12px 34px rgba(0,0,0,.45)", color: "#f7f7f7", fontSize: 14, fontWeight: 700, width: "max-content", maxWidth: "calc(100vw - 24px)" }}>
    <span>NXTDOX was updated.</span>
    <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 36, padding: "6px 16px", borderRadius: 10, border: "1px solid #be1717", background: "#be1717", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Refresh</button>
  </div>;
}
