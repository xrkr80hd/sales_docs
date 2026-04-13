"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DocumentDrawer,
  DocumentDrawerTrigger,
} from "@/components/workflow/document-drawer";
import {
  clearLocalDealId,
  finishDeal,
  getLocalDealId,
  listMyDeals,
  loadDealFromServer,
  saveDealToServer,
  setLocalDealId,
  type DealSummary,
} from "@/lib/deals";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import {
  clearWorkflowSession,
  getFullStockNumber,
  getLast8,
  loadSignatures,
  loadWorkflow,
  saveSignatures,
  saveWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData
} from "@/lib/walker-workflow";

type StatusTone = "" | "success" | "warn";
const WORKFLOW_VIEW_STATE_KEY = "walker.workflow.view.v1";

type WorkflowViewState = {
  openSections: Record<string, boolean>;
  returnPath?: string;
  scrollY: number;
};

function loadWorkflowViewState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_VIEW_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<WorkflowViewState>;
    const openSections =
      parsed.openSections && typeof parsed.openSections === "object"
        ? parsed.openSections
        : null;
    const scrollY =
      typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY)
        ? parsed.scrollY
        : 0;

    if (!openSections) {
      return null;
    }

    return { openSections, scrollY };
  } catch {
    return null;
  }
}

function saveWorkflowViewState(state: WorkflowViewState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(WORKFLOW_VIEW_STATE_KEY, JSON.stringify(state));
}

function clearWorkflowViewState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(WORKFLOW_VIEW_STATE_KEY);
}

export function getWorkflowReturnPath(): string {
  if (typeof window === "undefined") return "/overview";
  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_VIEW_STATE_KEY);
    if (!raw) return "/overview";
    const parsed = JSON.parse(raw) as Partial<WorkflowViewState>;
    return parsed.returnPath || "/overview";
  } catch {
    return "/overview";
  }
}

function OverviewRow({ label, value, href, onNavigate }: { label: string; value: string; href?: string; onNavigate?: () => void }) {
  const display = value || "-";
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">{label}</span>
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          className="truncate text-sm font-semibold text-white underline decoration-white/20 underline-offset-2 transition hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
        >
          {display} <span className="text-[10px] text-white/30">&#x270E;</span>
        </Link>
      ) : (
        <span className="truncate text-sm font-semibold text-white">{display}</span>
      )}
    </div>
  );
}

export function WorkflowScreen({ dealType = "used" }: { dealType?: "used" | "new" } = {}) {
  const isNewDeal = dealType === "new";
  const workflowPath = isNewDeal ? "/deal-sheet/new" : "/deal-sheet";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [data, setData] = useState<WorkflowData>(() => loadWorkflow());
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const savedSections = loadWorkflowViewState()?.openSections ?? {};
    return {
      dealer: false,
      consultant: false,
      deal: false,
      overview: true,
      ...savedSections,
    };
  });
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<StatusTone>("");
  const [dealId, setDealId] = useState<string | null>(() => getLocalDealId());
  const [openDeals, setOpenDeals] = useState<DealSummary[] | null>(null);
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [serverSynced, setServerSynced] = useState(false);
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // ── sessionStorage auto-save (every keystroke, instant) ──
  useEffect(() => {
    saveWorkflow(data);
  }, [data]);

  // ── Server auto-save (debounced 2s after last change) ──
  const debouncedServerSave = useCallback(
    (workflow: WorkflowData, currentDealId: string | null) => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
      serverSaveTimer.current = setTimeout(async () => {
        if (!isSupabaseConfigured()) return;
        const sigs = loadSignatures();
        const result = await saveDealToServer(workflow, sigs, currentDealId);
        if (result === null) {
          // Save failed — likely expired session
          setStatus("Could not sync to server — please refresh or sign in again.");
          setTone("warn");
          return;
        }
        if (result.id) {
          setDealId(result.id);
          setServerSynced(true);
          setTimeout(() => setServerSynced(false), 3000);
        }
      }, 2000);
    },
    [],
  );

  useEffect(() => {
    if (!initialLoadDone.current) return; // don't save during initial load
    debouncedServerSave(data, dealId);
    return () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    };
  }, [data, dealId, debouncedServerSave]);

  // ── Load open deals on mount ──
  useEffect(() => {
    let cancelled = false;
    async function loadDeals() {
      if (!isSupabaseConfigured()) {
        initialLoadDone.current = true;
        return;
      }

      // If we have a local deal ID, verify workflow is loaded — if not, fetch from server
      const localId = getLocalDealId();
      if (localId) {
        const current = loadWorkflow();
        const isEmpty = !current.customerName && !current.vin && !current.dealNumber;
        if (isEmpty) {
          // sessionStorage was cleared (refresh/tab close) but dealId survived — reload from server
          const deal = await loadDealFromServer(localId);
          if (!cancelled && deal) {
            const workflow = deal.workflow_data as unknown as WorkflowData;
            saveWorkflow(workflow);
            if (deal.signatures && typeof deal.signatures === "object") {
              saveSignatures(deal.signatures as Record<string, string>);
            }
            setData(workflow);
            setDealId(deal.id);
          } else if (!cancelled) {
            // Server deal gone — clear stale ID
            clearLocalDealId();
            setDealId(null);
          }
        }
        initialLoadDone.current = true;
        return;
      }

      // Check server for open deals
      const deals = await listMyDeals();
      if (cancelled) return;

      if (deals.length === 0) {
        // No open deals — start fresh
        initialLoadDone.current = true;
        return;
      }

      if (deals.length === 1) {
        // Exactly one open deal — auto-load it
        const deal = deals[0];
        const workflow = deal.workflow_data as unknown as WorkflowData;
        saveWorkflow(workflow);
        if (deal.signatures && typeof deal.signatures === "object") {
          saveSignatures(deal.signatures as Record<string, string>);
        }
        setData(workflow);
        setDealId(deal.id);
        setLocalDealId(deal.id);
        initialLoadDone.current = true;
        return;
      }

      // Multiple open deals — show picker
      setOpenDeals(deals);
      setShowDealPicker(true);
      initialLoadDone.current = true;
    }

    loadDeals();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist dealType so other screens (delivery checklist) can read it
  useEffect(() => {
    setData((prev) => {
      if (prev.dealType === dealType) return prev;
      return { ...prev, dealType };
    });
  }, [dealType]);

  useEffect(() => {
    return subscribeToWorkflowSessionClear(() => {
      clearLocalDealId();
      setDealId(null);
      setData(loadWorkflow());
      setStatus("Session cleared. Ready for a new deal.");
      setTone("success");
    });
  }, []);

  useEffect(() => {
    const saved = loadWorkflowViewState();
    if (!saved || saved.scrollY <= 0) {
      return;
    }

    // Retry scroll restore — accordion content may not be in the DOM on the first frame
    let attempts = 0;
    const maxAttempts = 10;
    const targetY = saved.scrollY;
    function tryScroll() {
      attempts++;
      window.scrollTo({ top: targetY, behavior: "auto" });
      if (Math.abs(window.scrollY - targetY) > 2 && attempts < maxAttempts) {
        window.requestAnimationFrame(tryScroll);
      }
    }
    window.requestAnimationFrame(tryScroll);
  }, []);

  useEffect(() => {
    saveWorkflowViewState({
      openSections,
      scrollY: typeof window === "undefined" ? 0 : window.scrollY,
    });
  }, [openSections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frameId: number | null = null;
    const onScroll = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        saveWorkflowViewState({
          openSections,
          scrollY: window.scrollY,
        });
        frameId = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [openSections]);

  function setStatusMessage(message: string, nextTone: StatusTone = "") {
    setStatus(message);
    setTone(nextTone);
  }

  function persistWorkflowViewState() {
    saveWorkflowViewState({
      openSections,
      returnPath: workflowPath,
      scrollY: typeof window === "undefined" ? 0 : window.scrollY,
    });
  }

  function saveNow() {
    const saved = saveWorkflow(data);
    setData(saved);
    setStatusMessage(
      "Saved.",
      "success",
    );
  }

  function clearSessionNow() {
    clearWorkflowSession();
    clearWorkflowViewState();
    clearLocalDealId();
    setDealId(null);
    setData(loadWorkflow());
    setOpenSections({ dealer: false, consultant: false, deal: false, overview: true });
    setStatusMessage(
      "Session cleared. Ready for a new deal.",
      "success",
    );
  }

  async function finishDealNow() {
    if (!dealId) {
      clearSessionNow();
      return;
    }
    const ok = await finishDeal(dealId);
    if (ok) {
      clearWorkflowSession();
      clearWorkflowViewState();
      clearLocalDealId();
      setDealId(null);
      setData(loadWorkflow());
      setOpenSections({ dealer: false, consultant: false, deal: false, overview: true });
      setStatusMessage("Deal finished. It will be removed in ~8 hours.", "success");
    } else {
      setStatusMessage("Could not finish deal — try again.", "warn");
    }
  }

  function pickDeal(deal: DealSummary) {
    const workflow = deal.workflow_data as unknown as WorkflowData;
    saveWorkflow(workflow);
    if (deal.signatures && typeof deal.signatures === "object") {
      saveSignatures(deal.signatures as Record<string, string>);
    }
    setData(workflow);
    setDealId(deal.id);
    setLocalDealId(deal.id);
    setShowDealPicker(false);
    setOpenDeals(null);
  }

  return (
    <>
      <div className="grid gap-6">
        {/* ── Hero ── */}
        <section className="overflow-hidden border border-white/10 bg-[var(--panel)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)] print:bg-none">
          <div className="grid gap-5 px-5 py-5 sm:px-6">
            <div className="text-center">
              <Image
                src="/walker-red-graphic-v2.png"
                alt="Walker Automotive graphic"
                width={320}
                height={116}
                priority
                className="mx-auto h-auto w-full max-w-[280px]"
              />
              <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[0.01em] text-white drop-shadow-sm sm:text-4xl print:text-[var(--foreground)] print:drop-shadow-none">
                {isNewDeal ? "New Vehicle Workflow" : "Used Vehicle Workflow"}
              </h2>
              <p className="mt-2 text-sm font-bold text-white/90 print:text-[var(--foreground)]">
                Last 8: <span className="font-mono">{getLast8(data.vin) || "-"}</span>
              </p>
              <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-white/70 print:text-[var(--muted)]">
                Enter customer and vehicle information once, then generate all
                required documents from a single source.
              </p>

              <div className="mt-5 print:hidden">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-white/70 transition hover:text-white"
                >
                  <span aria-hidden="true">&larr;</span>
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Deal Overview (read-only) ── */}
        <section className="overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(190,23,23,0.12),0_18px_44px_rgba(0,0,0,0.25)]">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpenSections(prev => ({ ...prev, overview: !prev.overview }))}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenSections(prev => ({ ...prev, overview: !prev.overview })); } }}
            className="flex w-full cursor-pointer items-center justify-between bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center p-5 text-left sm:p-6"
          >
            <div>
              <h3 className="text-2xl font-bold text-white">Deal Overview</h3>
              <p className="mt-1 text-lg font-semibold text-white/90 underline decoration-[var(--accent)] decoration-2 underline-offset-4">
                {data.customerName || "No customer yet"} {data.coCustomerName ? `& ${data.coCustomerName}` : ""}
              </p>
            </div>
            {/* Deal # — editable, centered on accordion header */}
            <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Deal #</span>
              <input
                type="text"
                value={data.dealNumber}
                onChange={(e) => setData(prev => ({ ...prev, dealNumber: e.target.value }))}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-28 border-b-2 border-white/40 bg-transparent text-center text-3xl font-extrabold text-white outline-none placeholder:text-white/25 focus:border-white/70"
                placeholder="—"
              />
            </div>
            <span className="ml-3 shrink-0 text-2xl text-white/70" aria-hidden="true">{openSections.overview ? "▲" : "▼"}</span>
          </div>
          {openSections.overview && (
            <div className="border-t border-white/10 bg-[#2a2a2e] px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-x-6 sm:gap-y-3">
                <OverviewRow label="Vehicle" value={[data.vehicleYear, data.vehicleMake, data.vehicleModel].filter(Boolean).join(" ")} href="/documents/vin-verification" onNavigate={persistWorkflowViewState} />
                {data.tradeIn === "yes" ? <OverviewRow label="Trade-In" value={[data.tradeYear, data.tradeMake, data.tradeModel].filter(Boolean).join(" ")} href="/documents/payoff-form" onNavigate={persistWorkflowViewState} /> : null}
                <OverviewRow label="VIN (Last 8)" value={getLast8(data.vin)} href="/documents/vin-verification" onNavigate={persistWorkflowViewState} />
                <OverviewRow label="Stock #" value={getFullStockNumber(data)} href="/documents/vin-verification" onNavigate={persistWorkflowViewState} />
                <OverviewRow label="Deal #" value={data.dealNumber} href="/documents/delivery-checklist" onNavigate={persistWorkflowViewState} />
                <OverviewRow label="Vehicle Miles" value={data.mileage} href="/documents/vin-verification" onNavigate={persistWorkflowViewState} />
                {data.lienholderName ? <OverviewRow label="Lienholder" value={data.lienholderName} href="/documents/payoff-form" onNavigate={persistWorkflowViewState} /> : null}
                <OverviewRow label="Payoff Verified" value={data.payoffVerified ? "Yes" : "No"} href="/documents/payoff-form" onNavigate={persistWorkflowViewState} />
                <OverviewRow label="Deal is Ready" value={data.deliveryEnabled ? "Yes" : "No"} href="/documents/delivery-checklist" onNavigate={persistWorkflowViewState} />
                <OverviewRow label="Plate" value={data.specialtyPlate === "yes" ? "Specialty — Transfer $3" : data.specialtyPlate === "no" ? "Standard — New Plate" : "Not checked"} />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveNow}
                  className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white"
                >
                  Save Session
                </button>
                <button
                  type="button"
                  onClick={clearSessionNow}
                  className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white"
                >
                  New Deal
                </button>
                {dealId && (
                  <button
                    type="button"
                    onClick={finishDealNow}
                    className="inline-flex min-h-12 items-center justify-center border border-[var(--success)] bg-[var(--success)]/20 px-5 text-sm font-bold uppercase tracking-[0.08em] text-[var(--success)]"
                  >
                    Finish Deal
                  </button>
                )}
                {status && (
                  <span className={`text-sm font-bold ${tone === "success" ? "text-[var(--success)]" : tone === "warn" ? "text-[var(--warn)]" : "text-white/50"}`}>
                    {tone === "warn" ? "⚠ " : tone === "success" ? "✓ " : ""}{status}
                  </span>
                )}
                {serverSynced && !status && (
                  <span className="text-sm font-bold text-white/40">☁ Synced</span>
                )}
              </div>
              <p className="mt-4 text-sm leading-6 text-white/40">
                Enter deal data on individual document screens. This overview refreshes automatically.
              </p>
            </div>
          )}
        </section>

        {/* ── Available Documents removed — use Document Drawer instead ── */}
      </div>

      <DocumentDrawerTrigger onClick={() => setDrawerOpen(true)} />
      <DocumentDrawer
        dealType={dealType}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* ── Deal Picker (multiple open deals) ── */}
      {showDealPicker && openDeals && openDeals.length > 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Resume a Deal</h3>
            <p className="mt-1 text-sm text-white/60">You have {openDeals.length} open deals. Pick one to resume, or start fresh.</p>
            <div className="mt-4 grid gap-2">
              {openDeals.map((deal) => {
                const w = deal.workflow_data as unknown as WorkflowData;
                const label = w.customerName || "Untitled Deal";
                const last8 = w.vin ? getLast8(w.vin) : "";
                const updated = new Date(deal.updated_at).toLocaleString();
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => pickDeal(deal)}
                    className="flex items-center justify-between border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                  >
                    <div>
                      <span className="text-sm font-bold text-white">{label}</span>
                      {last8 && <span className="ml-2 font-mono text-xs text-white/50">{last8}</span>}
                      <p className="text-xs text-white/40">Updated {updated}</p>
                    </div>
                    <span className="text-white/30">&rarr;</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => { setShowDealPicker(false); setOpenDeals(null); }}
              className="mt-4 w-full border border-white/20 bg-white/10 p-3 text-sm font-bold uppercase tracking-[0.08em] text-white"
            >
              Start Fresh Instead
            </button>
          </div>
        </div>
      )}
    </>
  );
}
