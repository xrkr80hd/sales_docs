"use client";

import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  {
    id: "10-steps",
    title: "10 Steps to the Sale",
    content: (
      <ol className="grid gap-4 text-sm leading-6 text-white/80">
        <li>
          <p className="font-bold text-white">1. Meet &amp; Greet <span className="font-normal text-white/50">(10–30 seconds)</span></p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Strong first impression</li>
            <li>Eye contact, energy, take control</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">2. Interview / Needs Analysis</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Build rapport</li>
            <li>Establish common ground</li>
            <li>Identify SPACED priorities</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">3. Trade (De)Valuation</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Walk-around with customer</li>
            <li>Build value in their vehicle</li>
            <li>Continue fact-finding</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">4. Lot Selection</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Show cheapest/oldest unit first</li>
            <li>Set negotiation expectations early</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">5. Presentation</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Use FAB</li>
            <li>Sell yourself and the vehicle</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">6. Demonstration Drive</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Create emotional connection</li>
            <li>Build ownership feeling</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">7. Write-Up (Numbers)</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Time and money commitment</li>
            <li>Transition to negotiation</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">8. Negotiation &amp; Close</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Gain commitment</li>
            <li>Stay focused on advancing the deal</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">9. Finance Turn (TOA)</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Transfer of Authority to manager</li>
          </ul>
        </li>
        <li>
          <p className="font-bold text-white">10. Delivery &amp; Follow-Up</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
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
      <div className="text-sm leading-6 text-white/80">
        <ul className="grid gap-1">
          <li><span className="font-bold text-white">S</span> — Safety</li>
          <li><span className="font-bold text-white">P</span> — Performance</li>
          <li><span className="font-bold text-white">A</span> — Appearance</li>
          <li><span className="font-bold text-white">C</span> — Comfort / Convenience</li>
          <li><span className="font-bold text-white">E</span> — Economy</li>
          <li><span className="font-bold text-white">D</span> — Dependability</li>
        </ul>
        <p className="mt-3 border-l-2 border-white/20 pl-3 text-xs italic text-white/50">
          Identify the top 2–3 priorities before presenting a vehicle.
        </p>
      </div>
    ),
  },
  {
    id: "fab",
    title: "FAB (How to Present)",
    content: (
      <div className="text-sm leading-6 text-white/80">
        <ul className="grid gap-2">
          <li><span className="font-bold text-white">Feature</span> = What it is</li>
          <li><span className="font-bold text-white">Advantage</span> = What it does</li>
          <li><span className="font-bold text-white">Benefit</span> = Why it matters to the customer</li>
        </ul>
        <p className="mt-3 border-l-2 border-white/20 pl-3 text-xs italic text-white/50">
          Always tie the benefit back to the customer&apos;s SPACED priorities.
        </p>
      </div>
    ),
  },
  {
    id: "objections",
    title: "Objection Handling",
    content: (
      <div className="grid gap-4 text-sm leading-6 text-white/80">
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-white/50">Flow</p>
          <ol className="list-decimal pl-5">
            <li>Acknowledge</li>
            <li>Clarify</li>
            <li>Isolate</li>
            <li>Respond</li>
            <li>Advance</li>
          </ol>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-white/50">LAST</p>
          <ul className="list-disc pl-5 text-white/60">
            <li><span className="font-bold text-white">L</span>ook</li>
            <li><span className="font-bold text-white">A</span>ct</li>
            <li><span className="font-bold text-white">S</span>ound</li>
            <li><span className="font-bold text-white">T</span>hink</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-white/50">A.I.M.</p>
          <ul className="list-disc pl-5 text-white/60">
            <li><span className="font-bold text-white">A</span>cknowledge</li>
            <li><span className="font-bold text-white">I</span>gnore</li>
            <li><span className="font-bold text-white">M</span>ove On</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase tracking-wider text-white/50">I.O.C.</p>
          <ul className="list-disc pl-5 text-white/60">
            <li><span className="font-bold text-white">I</span>solate</li>
            <li><span className="font-bold text-white">O</span>vercome</li>
            <li><span className="font-bold text-white">C</span>lose</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "sales-flow",
    title: "Sales Flow",
    content: (
      <div className="text-sm leading-6 text-white/80">
        <p className="font-mono text-xs text-white/70">
          Greeting → Needs → Vehicle → Demo → Numbers → Close → Delivery → Follow-Up
        </p>
        <p className="mt-3 border-l-2 border-white/20 pl-3 text-xs italic text-white/50">
          Do not skip steps. Shortcuts kill deals.
        </p>
      </div>
    ),
  },
  {
    id: "lot-control",
    title: "Lot Control",
    content: (
      <ul className="list-disc pl-5 text-sm leading-7 text-white/70">
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
      <div className="text-sm leading-6 text-white/80">
        <p className="font-bold text-white">Sell ownership, not price.</p>
        <p className="mt-2 text-white/50">Focus on:</p>
        <ul className="mt-1 list-disc pl-5 text-white/70">
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
      <div className="grid gap-3 text-sm leading-6 text-white/80">
        <div>
          <p className="font-bold text-white">Open-Ended</p>
          <p className="mt-1 italic text-white/50">&ldquo;What are you hoping your next vehicle does better?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold text-white">Either/Or</p>
          <p className="mt-1 italic text-white/50">&ldquo;Gas or diesel?&rdquo; &bull; &ldquo;Crew cab or quad cab?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold text-[var(--warn)]">Avoid</p>
          <p className="mt-1 text-white/50">Yes/No questions early</p>
        </div>
      </div>
    ),
  },
  {
    id: "demo-drive",
    title: "Demo Drive Flow",
    content: (
      <ol className="list-decimal pl-5 text-sm leading-7 text-white/70">
        <li>Set expectations</li>
        <li>Highlight SPACED-based features</li>
        <li>Let customer drive</li>
        <li>Reduce talking at key moments</li>
        <li className="font-bold text-white">Trial close: <span className="font-normal italic text-white/50">&ldquo;Can you see yourself driving this every day?&rdquo;</span></li>
      </ol>
    ),
  },
  {
    id: "trade-talk",
    title: "Trade Talk",
    content: (
      <div className="grid gap-2 text-sm leading-6 text-white/80">
        <p className="italic text-white/50">&ldquo;What do you like most about your current vehicle?&rdquo;</p>
        <p>Build emotional value first.</p>
        <p>Transition: <span className="italic text-white/50">&ldquo;Let&apos;s make sure we get you everything it&apos;s worth.&rdquo;</span></p>
      </div>
    ),
  },
  {
    id: "follow-up",
    title: "Follow-Up",
    content: (
      <div className="text-sm leading-6 text-white/80">
        <ul className="grid gap-1">
          <li><span className="font-bold text-white">Day 1:</span> Thank you + recap</li>
          <li><span className="font-bold text-white">Day 2:</span> Value reminder</li>
          <li><span className="font-bold text-white">Day 3–5:</span> Re-engage</li>
          <li><span className="font-bold text-white">Weekly:</span> Stay relevant</li>
        </ul>
        <p className="mt-3 border-l-2 border-white/20 pl-3 text-xs italic text-white/50">
          Always set the next step before the customer leaves.
        </p>
      </div>
    ),
  },
  {
    id: "mindset",
    title: "Sales Mindset",
    content: (
      <ul className="list-disc pl-5 text-sm leading-7 text-white/70">
        <li>Think like a business owner</li>
        <li>Stay emotionally controlled</li>
        <li>Confidence comes from repetition</li>
        <li>Questions &gt; talking</li>
        <li>People buy emotionally and justify logically</li>
        <li className="font-bold text-white">Shortcuts kill deals</li>
      </ul>
    ),
  },
  {
    id: "tools",
    title: "Dealership Tools",
    content: (
      <div className="grid gap-4 text-sm leading-6 text-white/80">
        <div>
          <p className="font-bold text-white">DealerCONNECT</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>VIN lookup</li>
            <li>Incentives awareness</li>
            <li>Factory information</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-white">vAuto</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Market pricing</li>
            <li>Used vehicle comparisons</li>
            <li>Value justification</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-white">Provision</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
            <li>Inventory lookup</li>
            <li>Find alternatives quickly</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-white">Drive Centric</p>
          <ul className="mt-1 list-disc pl-5 text-white/60">
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
      <div className="grid gap-3 text-sm leading-6 text-white/80">
        <div>
          <p className="font-bold uppercase tracking-wider text-white/50">Greeting</p>
          <p className="italic text-white/70">&ldquo;Welcome in. What brought you out today?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-white/50">Needs</p>
          <p className="italic text-white/70">&ldquo;What do you wish your current vehicle did better?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-white/50">Demo Close</p>
          <p className="italic text-white/70">&ldquo;Can you see yourself driving this every day?&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-white/50">Numbers Transition</p>
          <p className="italic text-white/70">&ldquo;Let&apos;s take a look at what this looks like for you.&rdquo;</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-white/50">Close</p>
          <p className="italic text-white/70">&ldquo;Are you ready to move forward if everything lines up?&rdquo;</p>
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
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-white/70 transition hover:text-white"
        >
          <span aria-hidden="true">&larr;</span>
          Back
        </Link>
      </div>

      <section className="overflow-hidden border border-white/10 bg-[var(--panel)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="px-5 py-5 text-center sm:px-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            CDJR Sales Cheat Sheet
          </h1>
          <p className="mt-1 text-sm text-white/60">
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
            className="overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(190,23,23,0.08),0_12px_32px_rgba(0,0,0,0.2)]"
          >
            <button
              type="button"
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
              className="flex w-full items-center justify-between rounded-[16px] bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-4 text-left transition sm:px-6"
            >
              <h2 className="text-base font-bold text-white sm:text-lg">{section.title}</h2>
              <span className="ml-3 shrink-0 text-xl text-white/70" aria-hidden="true">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="border-t border-white/10 bg-[#2a2a2e] px-5 py-4 sm:px-6 sm:py-5">
                {section.content}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
