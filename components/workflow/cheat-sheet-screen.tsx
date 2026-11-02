"use client";

import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  {
    id: "10-steps",
    title: "10 Steps to the Sale",
    content: (
      <ol className="grid gap-4 text-sm leading-6 text-[var(--foreground)]">
        <li>
          <p className="font-bold text-[var(--foreground)]">1. Meet &amp; Greet <span className="font-normal text-[var(--muted)]">(10–30 seconds)</span></p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Strong first impression</li>
            <li>Eye contact, energy, take control</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">2. Interview / Needs Analysis</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Build rapport</li>
            <li>Establish common ground</li>
            <li>Identify SPACED priorities</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">3. Trade (De)Valuation</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Walk-around with customer</li>
            <li>Build value in their vehicle</li>
            <li>Continue fact-finding</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">4. Lot Selection</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Show cheapest/oldest unit first</li>
            <li>Set negotiation expectations early</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">5. Presentation</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Use FAB</li>
            <li>Sell yourself and the vehicle</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">6. Demonstration Drive</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Create emotional connection</li>
            <li>Build ownership feeling</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">7. Write-Up (Numbers)</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Time and money commitment</li>
            <li>Transition to negotiation</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">8. Negotiation &amp; Close</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Gain commitment</li>
            <li>Stay focused on advancing the deal</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">9. Finance Turn (TOA)</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Transfer of Authority to manager</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-[var(--foreground)]">10. Delivery &amp; Follow-Up</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Deliver experience</li>
            <li>Build repeat and referrals</li>
          </ul>
        </li>
      </ol>
    ),
  },
  {
    id: "spaced",
    title: "SPACED (Needs Analysis)",
    content: (
      <div className="text-sm leading-6 text-[var(--foreground)]">
        <ul className="grid gap-1">
          <li><span className="font-bold text-[var(--foreground)]">S</span> — Safety</li>
          <li><span className="font-bold text-[var(--foreground)]">P</span> — Performance</li>
          <li><span className="font-bold text-[var(--foreground)]">A</span> — Appearance</li>
          <li><span className="font-bold text-[var(--foreground)]">C</span> — Comfort / Convenience</li>
          <li><span className="font-bold text-[var(--foreground)]">E</span> — Economy</li>
          <li><span className="font-bold text-[var(--foreground)]">D</span> — Dependability</li>
        </ul>
        <p className="mt-3 border-l-2 border-[var(--border)] pl-3 text-xs italic text-[var(--muted)]">
          Identify the top 2–3 priorities before presenting a vehicle.
        </p>
      </div>
    ),
  },
  {
    id: "fab",
    title: "FAB (How to Present)",
    content: (
      <div className="text-sm leading-6 text-[var(--foreground)]">
        <ul className="grid gap-2">
          <li><span className="font-bold text-[var(--foreground)]">Feature</span> = What it is</li>
          <li><span className="font-bold text-[var(--foreground)]">Advantage</span> = What it does</li>
          <li><span className="font-bold text-[var(--foreground)]">Benefit</span> = Why it matters to the customer</li>
        </ul>
        <p className="mt-3 border-l-2 border-[var(--border)] pl-3 text-xs italic text-[var(--muted)]">
          Always tie the benefit back to the customer&apos;s SPACED priorities.
        </p>
      </div>
    ),
  },
  {
    id: "objections",
    title: "Objection Handling",
    content: (
      <div className="grid gap-4 text-sm leading-6 text-[var(--foreground)]">
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-[var(--muted)]">Flow</p>
          <ol className="list-decimal pl-5">
            <li>Acknowledge</li>
            <li>Clarify</li>
            <li>Isolate</li>
            <li>Respond</li>
            <li>Advance</li>
          </ol>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-[var(--muted)]">LAST</p>
          <ul className="list-disc pl-5 text-[var(--muted)]">
            <li><span className="font-bold text-[var(--foreground)]">L</span>ook</li>
            <li><span className="font-bold text-[var(--foreground)]">A</span>ct</li>
            <li><span className="font-bold text-[var(--foreground)]">S</span>ound</li>
            <li><span className="font-bold text-[var(--foreground)]">T</span>hink</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-[var(--muted)]">A.I.M.</p>
          <ul className="list-disc pl-5 text-[var(--muted)]">
            <li><span className="font-bold text-[var(--foreground)]">A</span>cknowledge</li>
            <li><span className="font-bold text-[var(--foreground)]">I</span>gnore</li>
            <li><span className="font-bold text-[var(--foreground)]">M</span>ove On</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-[var(--muted)]">I.O.C.</p>
          <ul className="list-disc pl-5 text-[var(--muted)]">
            <li><span className="font-bold text-[var(--foreground)]">I</span>solate</li>
            <li><span className="font-bold text-[var(--foreground)]">O</span>vercome</li>
            <li><span className="font-bold text-[var(--foreground)]">C</span>lose</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "sales-flow",
    title: "Sales Flow",
    content: (
      <div className="text-sm leading-6 text-[var(--foreground)]">
        <p className="font-mono text-xs text-[var(--muted)]">
          Greeting → Needs → Vehicle → Demo → Numbers → Close → Delivery → Follow-Up
        </p>
        <p className="mt-3 border-l-2 border-[var(--border)] pl-3 text-xs italic text-[var(--muted)]">
          Do not skip steps. Shortcuts kill deals.
        </p>
      </div>
    ),
  },
  {
    id: "lot-control",
    title: "Lot Control",
    content: (
      <ul className="list-disc pl-5 text-sm leading-7 text-[var(--muted)]">
        <li>Lead the interaction</li>
        <li>Walk with purpose</li>
        <li>Guide to vehicle quickly</li>
        <li>Ask questions while moving</li>
      </ul>
    ),
  },
  {
    id: "write-up",
    title: "Write-Up / Pencil Focus",
    content: (
      <div className="text-sm leading-6 text-[var(--foreground)]">
        <p className="font-bold text-[var(--foreground)]">Sell ownership, not price.</p>
        <p className="mt-2 text-[var(--muted)]">Focus on:</p>
        <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
          <li>Payment comfort</li>
          <li>Fit to needs</li>
          <li>Trade value</li>
        </ul>
      </div>
    ),
  },
  {
    id: "question-types",
    title: "Question Types",
    content: (
      <div className="grid gap-3 text-sm leading-6 text-[var(--foreground)]">
        <div>
          <p className="font-bold text-[var(--foreground)]">Open-Ended</p>
          <p className="mt-1 italic text-[var(--muted)]">&ldquo;What are you hoping your next vehicle does better?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold text-[var(--foreground)]">Either/Or</p>
          <p className="mt-1 italic text-[var(--muted)]">&ldquo;Gas or diesel?&rdquo; &bull; &ldquo;Crew cab or quad cab?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold text-[var(--warn)]">Avoid</p>
          <p className="mt-1 text-[var(--muted)]">Yes/No questions early</p>
        </div>
      </div>
    ),
  },
  {
    id: "demo-drive",
    title: "Demo Drive Flow",
    content: (
      <ol className="list-decimal pl-5 text-sm leading-7 text-[var(--muted)]">
        <li>Set expectations</li>
        <li>Highlight SPACED-based features</li>
        <li>Let customer drive</li>
        <li>Reduce talking at key moments</li>
        <li className="font-bold text-[var(--foreground)]">Trial close: <span className="font-normal italic text-[var(--muted)]">&ldquo;Can you see yourself driving this every day?&rdquo;</span></li>
      </ol>
    ),
  },
  {
    id: "trade-talk",
    title: "Trade Talk",
    content: (
      <div className="grid gap-2 text-sm leading-6 text-[var(--foreground)]">
        <p className="italic text-[var(--muted)]">&ldquo;What do you like most about your current vehicle?&rdquo;</p>
        <p>Build emotional value first.</p>
        <p>Transition: <span className="italic text-[var(--muted)]">&ldquo;Let&apos;s make sure we get you everything it&apos;s worth.&rdquo;</span></p>
      </div>
    ),
  },
  {
    id: "follow-up",
    title: "Follow-Up",
    content: (
      <div className="text-sm leading-6 text-[var(--foreground)]">
        <ul className="grid gap-1">
          <li><span className="font-bold text-[var(--foreground)]">Day 1:</span> Thank you + recap</li>
          <li><span className="font-bold text-[var(--foreground)]">Day 2:</span> Value reminder</li>
          <li><span className="font-bold text-[var(--foreground)]">Day 3–5:</span> Re-engage</li>
          <li><span className="font-bold text-[var(--foreground)]">Weekly:</span> Stay relevant</li>
        </ul>
        <p className="mt-3 border-l-2 border-[var(--border)] pl-3 text-xs italic text-[var(--muted)]">
          Always set the next step before the customer leaves.
        </p>
      </div>
    ),
  },
  {
    id: "mindset",
    title: "Sales Mindset",
    content: (
      <ul className="list-disc pl-5 text-sm leading-7 text-[var(--muted)]">
        <li>Think like a business owner</li>
        <li>Stay emotionally controlled</li>
        <li>Confidence comes from repetition</li>
        <li>Questions &gt; talking</li>
        <li>People buy emotionally and justify logically</li>
        <li className="font-bold text-[var(--foreground)]">Shortcuts kill deals</li>
      </ul>
    ),
  },
  {
    id: "tools",
    title: "Dealership Tools",
    content: (
      <div className="grid gap-4 text-sm leading-6 text-[var(--foreground)]">
        <div>
          <p className="font-bold text-[var(--foreground)]">DealerCONNECT</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>VIN lookup</li>
            <li>Incentives awareness</li>
            <li>Factory information</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-[var(--foreground)]">vAuto</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Market pricing</li>
            <li>Used vehicle comparisons</li>
            <li>Value justification</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-[var(--foreground)]">Provision</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>Inventory lookup</li>
            <li>Find alternatives quickly</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-[var(--foreground)]">Drive Centric</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            <li>CRM follow-up</li>
            <li>Tasks, notes, pipeline</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "word-tracks",
    title: "Word Tracks",
    content: (
      <div className="grid gap-3 text-sm leading-6 text-[var(--foreground)]">
        <div>
          <p className="font-bold uppercase tracking-wider text-[var(--muted)]">Greeting</p>
          <p className="italic text-[var(--muted)]">&ldquo;Welcome in. What brought you out today?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-[var(--muted)]">Needs</p>
          <p className="italic text-[var(--muted)]">&ldquo;What do you wish your current vehicle did better?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-[var(--muted)]">Demo Close</p>
          <p className="italic text-[var(--muted)]">&ldquo;Can you see yourself driving this every day?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-[var(--muted)]">Numbers Transition</p>
          <p className="italic text-[var(--muted)]">&ldquo;Let&apos;s take a look at what this looks like for you.&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-[var(--muted)]">Close</p>
          <p className="italic text-[var(--muted)]">&ldquo;Are you ready to move forward if everything lines up?&rdquo;</p>
        </div>
      </div>
    ),
  },
] as const;

export function CheatSheetScreen() {
  const [openId, setOpenId] = useState<string>("10-steps");

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? "" : id));
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <span aria-hidden="true">&larr;</span>
          Back
        </Link>
      </div>

      <section className="overflow-hidden border border-[var(--border)] bg-[var(--panel)]  bg-cover bg-center shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="px-5 py-5 text-center sm:px-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
            CDJR Sales Cheat Sheet
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Quick reference for the sales floor
          </p>
        </div>
      </section>

      {/* Accordion sections */}
      {SECTIONS.map((section) => {
        const isOpen = openId === section.id;
        return (
          <section
            key={section.id}
            id={`cheat-${section.id}`}
            className="overflow-hidden border border-[var(--border)] shadow-[0_0_20px_rgba(190,23,23,0.08),0_12px_32px_rgba(0,0,0,0.2)]"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`cheat-content-${section.id}`}
              onClick={() => {
                const el = document.getElementById(`cheat-${section.id}`);
                const wasOpen = openId === section.id;
                toggle(section.id);
                if (wasOpen) return;
                // After opening, scroll the button into view so content appears below viewport top
                requestAnimationFrame(() => {
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
              className="flex w-full items-center justify-between bg-[var(--accent)]  bg-cover bg-center px-5 py-4 text-left transition sm:px-6"
            >
              <h2 className="text-base font-bold text-[var(--on-accent)] sm:text-lg">{section.title}</h2>
              <span className="ml-3 shrink-0 text-xl text-[var(--on-accent)]" aria-hidden="true">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            <div
              id={`cheat-content-${section.id}`}
              hidden={!isOpen}
            >
              <div className="border-t border-[var(--border)] bg-[var(--panel)] px-5 py-4 sm:px-6 sm:py-5">
                {section.content}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
