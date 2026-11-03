import Link from "next/link";

import { DOCUMENT_LIBRARY } from "@/lib/walker-workflow";

export default function DocumentsPage() {
  return (
    <div className="grid gap-6">
      <section className="border border-black/10 bg-[var(--panel)] p-5 shadow-[0_24px_60px_rgba(35,23,12,0.12)] sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
          Document Library
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-[0.01em] text-[var(--foreground)]">
          All Documents
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
          View, edit, and print any deal document. All forms pull from the
          information entered on the Workflow page.
        </p>
        <Link
          href="/print/all"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-bold uppercase tracking-[0.08em] text-white"
        >
          Print All Forms
        </Link>
      </section>

      <section className="grid gap-3">
        {DOCUMENT_LIBRARY.map((doc) => (
          <details
            key={doc.slug}
            className="group border border-black/10 bg-[var(--panel-strong)] shadow-[0_18px_44px_rgba(35,23,12,0.08)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-4">
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {doc.stage}
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold text-[var(--foreground)]">
                    {doc.title}
                  </h3>
                </div>
              </div>
              <span
                className={`shrink-0 border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${doc.ready
                  ? "border-[var(--success)] text-[var(--success)]"
                  : "border-[var(--border)] text-[var(--muted)]"
                  }`}
              >
                {doc.ready ? "Ready" : "Queued"}
              </span>
            </summary>

            <div className="border-t border-black/10 px-5 pb-5 pt-4">
              <p className="text-sm leading-6 text-[var(--muted)]">
                {doc.description}
              </p>

              {doc.ready ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={doc.href}
                    className="inline-flex min-h-11 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white"
                  >
                    Open Document
                  </Link>
                  <Link
                    href={doc.printHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center border border-[var(--foreground)] bg-white px-4 text-sm font-bold uppercase tracking-[0.08em] text-[var(--foreground)]"
                  >
                    Print Form
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                  Coming soon.
                </p>
              )}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
