"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCUMENT_LIBRARY } from "@/lib/walker-workflow";

type DocumentDrawerProps = {
  dealType: "new" | "used";
  open: boolean;
  onClose: () => void;
};

export function DocumentDrawer({ dealType, open, onClose }: DocumentDrawerProps) {
  const pathname = usePathname();

  const docs = DOCUMENT_LIBRARY.filter((doc) => {
    // Buyers Guide is used-only
    if (dealType === "new" && doc.slug === "buyers-guide") return false;
    return true;
  });

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="button"
        tabIndex={-1}
        aria-label="Close documents"
      />

      {/* Drawer panel */}
      <aside
        className={`relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto shadow-[0_0_40px_rgba(190,23,23,0.15),0_0_80px_rgba(0,0,0,0.4)] transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[var(--accent)] bg-[url('/bg-drawer-9x16.jpg')] bg-cover bg-top px-5 py-5">
          <div>
            <h2 className="text-xl font-bold text-white">My Workflow</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label="Close documents"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Document list */}
        <div className="flex flex-1 flex-col bg-[#1c1c1e]">
          <nav className="flex flex-1 flex-col justify-evenly bg-white/5 p-3">
            {/* Deal Sheet — back to input section */}
            <Link
              href={dealType === "new" ? "/deal-sheet/new" : "/deal-sheet"}
              onClick={onClose}
              className={`group flex items-center gap-3 border px-4 py-3 transition ${pathname.startsWith("/deal-sheet")
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-white/10 bg-[#2a2a2e] hover:border-white/20 hover:bg-[#333338]"
                }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold ${pathname.startsWith("/deal-sheet")
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/20 bg-white/5 text-white/40"
                  }`}
              >
                {pathname.startsWith("/deal-sheet") ? "●" : "✎"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${pathname.startsWith("/deal-sheet") ? "text-[var(--accent)]" : "text-white"}`}>Deal Sheet</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 ${pathname.startsWith("/deal-sheet") ? "text-[var(--accent)]" : "text-white/20 group-hover:text-white/40"}`}>
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </Link>

            {docs.map((doc) => {
              const isActive = pathname === doc.href;

              return (
                <Link
                  key={doc.slug}
                  href={doc.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 border px-4 py-3 transition ${isActive
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-white/10 bg-[#2a2a2e] hover:border-white/20 hover:bg-[#333338]"
                    }`}
                >
                  {/* Status indicator */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold ${isActive
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-white/20 bg-white/5 text-white/40"
                      }`}
                  >
                    {isActive ? "●" : "○"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold ${isActive ? "text-[var(--accent)]" : "text-white"
                        }`}
                    >
                      {doc.title}
                    </p>
                  </div>

                  {/* Arrow */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-white/20 group-hover:text-white/40"
                      }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 border-t border-white/10 bg-[#2a2a2e] px-5 py-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center border border-white/20 bg-white/10 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
          >
            ← Dashboard
          </Link>
          <Link
            href="/documents/cheat-sheet"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--accent-strong)]"
          >
            Cheat Sheet
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("open-settings"));
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-white/20 bg-white/10 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
            Settings
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Floating trigger button — fixed to the right edge of the screen */
export function DocumentDrawerTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-0 top-1/2 z-40 -translate-y-1/2 border border-r-0 border-white/20 bg-[var(--accent)] px-2 py-4 shadow-[0_0_20px_rgba(190,23,23,0.2),0_8px_24px_rgba(0,0,0,0.3)] transition hover:bg-[var(--accent-strong)] print:hidden"
      aria-label="Open documents"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5 text-white"
      >
        <path
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
          clipRule="evenodd"
        />
      </svg>
      <span className="mt-2 block text-[9px] font-bold uppercase leading-tight tracking-wider text-white/80">
        Docs
      </span>
    </button>
  );
}
