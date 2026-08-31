"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

const DISCLOSURE_ACCEPTED_KEY = "walker.disclosure.accepted";
const DISCLOSURE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function hasAcceptedDisclosure(): boolean {
  try {
    const raw = window.localStorage.getItem(DISCLOSURE_ACCEPTED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts)) return false;
    if (Date.now() - ts > DISCLOSURE_TTL_MS) {
      window.localStorage.removeItem(DISCLOSURE_ACCEPTED_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function saveAcceptance() {
  try {
    window.localStorage.setItem(DISCLOSURE_ACCEPTED_KEY, String(Date.now()));
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

  if (accepted) return <>{children}</>;

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
          <p>
            <strong className="text-[var(--foreground)]">
              This is an unofficial internal-use application
            </strong>{" "}
            developed for employees of Walker Automotive to streamline the deal
            documentation workflow. It is not a product or service offered by
            Walker Automotive to the general public.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              Handling of Sensitive Information.
            </strong>{" "}
            In the course of using this application you may enter, view, or
            generate documents that contain personally identifiable information
            (&ldquo;PII&rdquo;) including but not limited to customer names,
            addresses, phone numbers, email addresses, vehicle identification
            numbers, Social Security numbers, and financial account details. You
            acknowledge that you are responsible for safeguarding all such
            information in accordance with applicable federal, state, and local
            privacy laws, including the Gramm-Leach-Bliley Act (GLBA) and the
            FTC Safeguards Rule, as well as any internal Walker Automotive data
            handling policies.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              Data Storage &amp; Security.
            </strong>{" "}
            Deal data entered into this application is stored temporarily in
            your browser session and is not transmitted to or stored on any
            external server unless explicitly integrated with an authorized
            backend service. User authentication is provided by Supabase and is
            subject to its security practices and terms of service. While
            reasonable measures have been taken to protect data in transit and at
            rest, no system is guaranteed to be completely secure.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              Use at Your Own Risk.
            </strong>{" "}
            This application is provided on an &ldquo;as-is&rdquo; and
            &ldquo;as-available&rdquo; basis without warranties of any kind,
            whether express or implied, including but not limited to warranties
            of merchantability, fitness for a particular purpose, or
            non-infringement. The developers and Walker Automotive disclaim all
            liability for any errors, omissions, data loss, unauthorized access,
            or damages arising out of your use of this application.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              User Responsibilities.
            </strong>{" "}
            By proceeding you agree to: (a)&nbsp;use this application only for
            legitimate Walker Automotive business purposes; (b)&nbsp;never share
            your login credentials or allow unauthorized persons to access this
            application; (c)&nbsp;log out or close the session when you are
            finished; and (d)&nbsp;report any suspected security incident or
            data breach to management immediately.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              Acceptance &amp; Record.
            </strong>{" "}
            Your acceptance of these terms is recorded and associated with the
            email address used to sign in. Continued use of this application
            constitutes ongoing agreement to these terms. Walker Automotive
            reserves the right to update these terms at any time; material
            changes will require re-acknowledgment.
          </p>

          <p>
            <strong className="text-[var(--foreground)]">
              Trademarks &amp; Logo Usage.
            </strong>{" "}
            The Walker Automotive name and logo displayed within this
            application are the property of Walker Automotive and its respective
            owners. The developer of this application does not own, claim, or
            assert any rights to the Walker Automotive logo or branding. This
            application is strictly a prototype built for internal demonstration
            and development purposes. By proceeding, you acknowledge that this
            is not an official Walker Automotive product and that all
            trademarked materials are used solely for contextual accuracy during
            prototyping and testing.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex min-h-12 items-center justify-center border border-[var(--accent)] rounded-[16px] bg-[var(--accent)] px-6 text-sm font-bold uppercase tracking-[0.08em] text-white"
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
