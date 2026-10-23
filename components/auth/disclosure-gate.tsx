"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { DISCLOSURE_VERSION, DISCLOSURE_SECTIONS, validDisclosureAcceptance } from "@/lib/disclosure";

const DISCLOSURE_ACCEPTED_KEY = "walker.disclosure.accepted";


function hasAcceptedDisclosure(): boolean {
  try {
    const raw = window.localStorage.getItem(DISCLOSURE_ACCEPTED_KEY);
    if (!raw) return false;
    if (!validDisclosureAcceptance(JSON.parse(raw))) return false;
    return true;
  } catch {
    return false;
  }
}

function saveAcceptance() {
  try {
    window.localStorage.setItem(DISCLOSURE_ACCEPTED_KEY, JSON.stringify({ version: DISCLOSURE_VERSION, acceptedAt: Date.now() }));
  } catch {
    // Storage unavailable — acceptance will last until page reload only.
  }
}

const emptySubscribe = () => () => { };

export function DisclosureGate({ children }: { children: ReactNode }) {
  const initiallyAccepted = useSyncExternalStore(
    emptySubscribe,
    hasAcceptedDisclosure,
    () => false,
  );
  const [accepted, setAccepted] = useState(initiallyAccepted);

  if (accepted || initiallyAccepted) return <>{children}</>;

  function handleAccept() {
    saveAcceptance();
    setAccepted(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="w-full border border-black/10 bg-[var(--panel)] p-6 shadow-[0_24px_60px_rgba(35,23,12,0.12)]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
          Disclosure &amp; Acknowledgment
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-[var(--foreground)]">
          Terms of Use
        </h1>

        <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
          {DISCLOSURE_SECTIONS.map(section => <p key={section.title}><strong className="text-[var(--foreground)]">{section.title}.</strong>{" "}{section.text}</p>)}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex min-h-12 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-6 text-sm font-bold uppercase tracking-[0.08em] text-white"
          >
            I Agree &mdash; Continue
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          By clicking &ldquo;I Agree &mdash; Continue&rdquo; you confirm that
          you have read, understood, and agree to the terms outlined above.
        </p>
      </section>
    </div>
  );
}
