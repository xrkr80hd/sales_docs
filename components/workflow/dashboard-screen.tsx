"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SettingsDrawer } from "@/components/workflow/settings-drawer";
import {
  clearLocalDealId,
  consumeStartFreshDeal,
  deleteDeal,
  listMyDeals,
  markStartFreshDeal,
  setLocalDealId,
  type DealSummary
} from "@/lib/deals";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import {
  clearWorkflowSession,
  loadWorkflow,
  saveSignatures,
  saveWorkflow,
  type WorkflowData
} from "@/lib/walker-workflow";

export function DashboardScreen() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDeal, setLastDeal] = useState<DealSummary | null>(null);
  const [allDeals, setAllDeals] = useState<DealSummary[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [localResume] = useState<{ name: string; dealType: "new" | "used" } | null>(() => {
    const wf = loadWorkflow();
    if (!wf.customerName && !wf.vin && !wf.dealNumber) {
      return null;
    }
    return {
      name: wf.customerName || "In-Progress Deal",
      dealType: wf.dealType === "new" ? "new" : "used",
    };
  });

  // Fetch deals from server on mount (persists across devices)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        return;
      }
      const deals = await listMyDeals();
      if (cancelled) return;

      // Sort most recent first
      const sorted = [...deals].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      setLastDeal(sorted[0] ?? null);
      setAllDeals(sorted);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function startFreshDeal(dealType: "new" | "used") {
    clearWorkflowSession();
    clearLocalDealId();
    consumeStartFreshDeal();
    markStartFreshDeal(dealType);
    router.push(dealType === "new" ? "/deal-sheet/new" : "/deal-sheet");
  }

  function resumeDeal(deal: DealSummary) {
    const workflow = deal.workflow_data as unknown as WorkflowData;
    saveWorkflow(workflow);
    if (deal.signatures && typeof deal.signatures === "object") {
      saveSignatures(deal.signatures as Record<string, string>);
    }
    setLocalDealId(deal.id);
    setShowPicker(false);
    const route = workflow.dealType === "new" ? "/deal-sheet/new" : "/deal-sheet";
    router.push(route);
  }

  const previousDeals = lastDeal
    ? allDeals.filter((deal) => deal.id !== lastDeal.id)
    : allDeals;
  const pickerDeals = previousDeals.length > 0 ? previousDeals : allDeals;
  const primaryButtonClass = "inline-flex h-12 w-full items-center justify-center border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--accent)]/90";
  const secondaryButtonClass = "inline-flex h-12 w-full items-center justify-center border border-white/15 bg-white/5 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/10 hover:text-white";
  const accentGhostButtonClass = "inline-flex h-12 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)]/10 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--accent)]/20";

  return (
    <>
      <section className="overflow-hidden border border-white/10 bg-[var(--panel)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="flex min-h-0 items-start justify-center px-5 py-3 sm:min-h-[60vh] sm:items-center sm:px-6 sm:py-10">
          <div className="text-center">
            <Image
              src="/walker-red-graphic-v2.png"
              alt="Walker Automotive graphic"
              width={320}
              height={116}
              priority
              className="mx-auto h-auto w-full max-w-[190px] sm:max-w-[280px]"
            />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white drop-shadow-sm sm:mt-5 sm:text-xs">
              Walker Docs
            </p>
            <h1 className="mt-0.5 text-[1.55rem] font-extrabold leading-tight tracking-[0.01em] text-white drop-shadow-sm sm:mt-2 sm:text-4xl">
              Start a Deal
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-white/70 sm:mt-3 sm:text-base sm:leading-7">
              Choose a vehicle type to begin.
            </p>

            <nav className="mx-auto mt-3 flex w-[280px] flex-col gap-2 sm:mt-8 sm:gap-3">
              <button
                type="button"
                onClick={() => startFreshDeal("new")}
                className={primaryButtonClass}
              >
                New Vehicle
              </button>
              <button
                type="button"
                onClick={() => startFreshDeal("used")}
                className={primaryButtonClass}
              >
                Used Vehicle
              </button>

              <hr className="my-1 border-white/10 sm:my-2" />

              {/* Resume — shows immediately from sessionStorage, upgrades to server data when loaded */}
              {(() => {
                if (lastDeal) {
                  const wf = lastDeal.workflow_data as unknown as WorkflowData;
                  const name = wf.customerName || "In-Progress Deal";
                  const vehicle = [wf.vehicleYear, wf.vehicleMake, wf.vehicleModel].filter(Boolean).join(" ");
                  return (
                    <button
                      type="button"
                      onClick={() => resumeDeal(lastDeal)}
                      className="inline-flex h-12 w-full flex-col items-center justify-center overflow-hidden border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-white transition hover:bg-[var(--accent)]/90"
                    >
                      <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.08em]">Resume Deal</span>
                      <span className="max-w-full truncate text-[10px] leading-tight text-white/80">{name}{vehicle ? ` · ${vehicle}` : ""}</span>
                    </button>
                  );
                }
                if (localResume) {
                  return (
                    <Link
                      href={localResume.dealType === "new" ? "/deal-sheet/new" : "/deal-sheet"}
                      className="inline-flex h-12 w-full flex-col items-center justify-center overflow-hidden border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-white transition hover:bg-[var(--accent)]/90"
                    >
                      <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.08em]">Resume Deal</span>
                      <span className="max-w-full truncate text-[10px] leading-tight text-white/80">{localResume.name}</span>
                    </Link>
                  );
                }
                return null;
              })()}

              {/* Previous Deals — all deals from server */}
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className={accentGhostButtonClass}
              >
                Previous Deals ({pickerDeals.length})
              </button>

              <hr className="my-1 border-white/10 sm:my-2" />

              <Link
                href="/documents/cheat-sheet"
                className={secondaryButtonClass}
              >
                Cheat Sheet
              </Link>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className={`${secondaryButtonClass} gap-2`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
                Settings
              </button>
            </nav>
          </div>
        </div>
      </section>

      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowPicker(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setShowPicker(false); }}
            role="button"
            tabIndex={-1}
            aria-label="Close deal picker"
          />
          <div className="relative z-10 mx-4 w-full max-w-md border border-white/10 bg-[#1c1c1e] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-bold text-white">Previous Deals</h2>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
                aria-label="Close"
              >✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {pickerDeals.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-white/50">No previous deals found.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {pickerDeals.map((deal) => {
                    const wf = deal.workflow_data as unknown as WorkflowData;
                    const name = wf.customerName || "Unnamed";
                    const vehicle = [wf.vehicleYear, wf.vehicleMake, wf.vehicleModel].filter(Boolean).join(" ") || "No vehicle";
                    const type = wf.dealType === "new" ? "New" : "Used";
                    return (
                      <div key={deal.id} className="flex items-center">
                        <button
                          type="button"
                          onClick={() => resumeDeal(deal)}
                          className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 text-left transition hover:bg-white/5"
                        >
                          <span className="text-sm font-bold text-white">{name}</span>
                          <span className="text-xs text-white/50">{vehicle} · {type}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`Are you sure you want to delete ${name}'s deal?`)) return;
                            const ok = await deleteDeal(deal.id);
                            if (ok) setAllDeals((prev) => prev.filter((d) => d.id !== deal.id));
                          }}
                          className="mr-3 shrink-0 border border-transparent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-label={`Delete ${name}'s deal`}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
