"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useSession } from "@/components/auth/supabase-session-gate";
import { getWorkflowReturnPath } from "@/components/workflow/workflow-screen";
import { getLast8 } from "@/lib/walker-workflow";

type DocToolbarProps = {
  vin: string;
  mileage?: string;
  saved: boolean;
  onSave: () => void;
  onPrint: () => void;
  /** Optional extra action buttons rendered before Save (e.g. Email F&I) */
  extraActions?: ReactNode;
};

export function DocToolbar({ vin, mileage, saved, onSave, onPrint, extraActions }: DocToolbarProps) {
  const { sessionLabel, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => {
      document.removeEventListener("mousedown", handleTap);
      document.removeEventListener("touchstart", handleTap);
    };
  }, [menuOpen]);

  return (
    <div className="relative mb-3 border border-white/10 bg-[#2a2a2e] shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
      {/* ── Desktop bar (hidden on mobile) ── */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href={getWorkflowReturnPath()}
          className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
        >
          Back to Deal Sheet
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-white/50">{sessionLabel}</span>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
            Last 8: {getLast8(vin) || "—"}
          </span>
          {mileage !== undefined && (
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
              Miles: {mileage || "—"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {extraActions}
          <button
            type="button"
            onClick={onSave}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 rounded-[16px] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Print Form
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Mobile bar (visible ≤640px) ── */}
      <div className="flex sm:hidden items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          className="inline-flex min-h-10 min-w-10 items-center justify-center border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          )}
        </button>
        <div className="flex flex-1 flex-col items-end gap-0.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
            Last 8: {getLast8(vin) || "—"}
          </span>
          {mileage !== undefined && (
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
              Miles: {mileage || "—"}
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile dropdown menu (overlay) ── */}
      {menuOpen && (
        <div ref={menuRef} className="absolute left-0 right-0 top-full z-50 flex sm:hidden flex-col gap-2 border border-white/10 bg-[#2a2a2e] px-4 pb-4 pt-2 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <span className="text-xs font-semibold text-white/50">{sessionLabel}</span>
          <Link
            href={getWorkflowReturnPath()}
            onClick={() => setMenuOpen(false)}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Back to Deal Sheet
          </Link>
          {extraActions}
          <button
            type="button"
            onClick={() => { onSave(); setMenuOpen(false); }}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { onPrint(); setMenuOpen(false); }}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 rounded-[16px] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Print Form
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
