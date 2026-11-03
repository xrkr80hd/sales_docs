"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { DISCLOSURE_VERSION, DISCLOSURE_SECTIONS, DISCLOSURE_SUMMARY, validDisclosureAcceptance } from "@/lib/disclosure";

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

/*
 * Asked once per account: agreeing is saved on the account (so it follows you to any
 * browser or device) and in this browser as a fast path. Asked again only when the
 * terms version changes.
 */
export function DisclosureGate({ children }: { children: ReactNode }) {
  const { accessToken } = useSession();
  const initiallyAccepted = useSyncExternalStore(
    emptySubscribe,
    hasAcceptedDisclosure,
    () => false,
  );
  const [accepted, setAccepted] = useState(initiallyAccepted);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (accepted || initiallyAccepted || !accessToken) return;
    let alive = true;
    fetch("/api/me/state", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((state: { disclosureVersion?: string | null } | null) => {
        if (!alive) return;
        if (state?.disclosureVersion === DISCLOSURE_VERSION) { saveAcceptance(); setAccepted(true); }
        setChecked(true);
      })
      .catch(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
  }, [accepted, initiallyAccepted, accessToken]);

  if (accepted || initiallyAccepted) return <>{children}</>;
  // Checking the account first, so people who already agreed never see the terms flash up.
  if (!checked) return <div className="min-h-screen" aria-busy="true" />;

  function handleAccept() {
    saveAcceptance();
    setAccepted(true);
    if (accessToken) void fetch("/api/me/state", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ acceptDisclosure: true }) }).catch(() => undefined);
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

        <ul className="mt-5 space-y-3 border-l-4 border-[var(--accent)] bg-[var(--panel-strong)] p-4 text-[15px] font-semibold leading-6 text-[var(--foreground)]">
          {DISCLOSURE_SUMMARY.map(line => <li key={line}>{line}</li>)}
        </ul>
        <h2 className="mt-6 text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--foreground)]">The full terms</h2>
        <div className="mt-3 space-y-4 text-sm leading-7 text-[var(--muted)]">
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
          By clicking &ldquo;I Agree &mdash; Continue&rdquo; you confirm that you
          have read and understood these terms, that you are choosing to use
          NXTDOX, and that you understand it is a document preparation tool, not
          a credit application.
        </p>
      </section>
    </div>
  );
}
