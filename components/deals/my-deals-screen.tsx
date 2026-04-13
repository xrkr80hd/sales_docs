"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  deleteDeal,
  listMyDeals,
  saveDealToServer,
  setLocalDealId,
  type DealSummary,
} from "@/lib/deals";
import {
  clearWorkflowSession,
  createDefaultWorkflowData,
  getLast8,
  loadWorkflow,
  normalizeVin,
  saveSignatures,
  saveWorkflow,
} from "@/lib/walker-workflow";

export function MyDealsScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newDealReady, setNewDealReady] = useState(false);
  const [voiDone, setVoiDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [voiVin, setVoiVin] = useState("");
  const [voiYear, setVoiYear] = useState("");
  const [voiMake, setVoiMake] = useState("");
  const [voiModel, setVoiModel] = useState("");
  const [voiDealType, setVoiDealType] = useState<"" | "new" | "used">("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listMyDeals();
      if (!cancelled) {
        setDeals(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleStartNewDeal() {
    if (creating) return;
    setCreating(true);
    clearWorkflowSession();
    const fresh = createDefaultWorkflowData();
    saveWorkflow(fresh);
    const result = await saveDealToServer(fresh, {});
    if (result?.id) {
      setLocalDealId(result.id);
      setNewDealReady(true);
    }
    setCreating(false);
  }

  async function resumeDeal(deal: DealSummary) {
    saveWorkflow(deal.workflow_data);
    saveSignatures(deal.signatures);
    setLocalDealId(deal.id);
    router.push("/deal-sheet");
  }

  async function handleDelete(dealId: string) {
    const ok = await deleteDeal(dealId);
    if (ok) {
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
    }
    setConfirmDeleteId(null);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="grid gap-4">
      {/* ── Start a New Deal ── */}
      <section className="overflow-hidden border border-white/10 bg-[#1c1c1e] shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-white">Start a New Deal</h2>
          <p className="mt-1 text-sm text-white/70">Create a deal, then choose your path.</p>
        </div>

        <div className="px-5 py-6 sm:px-6">
          {!newDealReady ? (
            <button
              type="button"
              onClick={handleStartNewDeal}
              disabled={creating}
              className="inline-flex min-h-12 w-full items-center justify-center border border-white bg-white text-sm font-bold uppercase tracking-[0.08em] text-[var(--accent)] transition hover:bg-white/90 disabled:opacity-40"
            >
              {creating ? "Creating…" : "Start a New Deal"}
            </button>
          ) : !voiDone ? (
            <div className="grid gap-4">
              <p className="text-center text-sm font-bold text-white/60">Vehicle of Interest — enter once, flows everywhere</p>

              <div className="border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3">
                <p className="text-xs leading-5 text-white/70">Walk to the vehicle — read VIN from the dash, NOT from the website. Year/make/model from the window sticker or lot tag.</p>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">VIN</span>
                <input
                  type="text"
                  maxLength={17}
                  value={voiVin}
                  onChange={(e) => setVoiVin(normalizeVin(e.target.value))}
                  placeholder="17-character VIN"
                  className="min-h-12 border border-white/10 bg-white px-4 font-mono text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Year</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={voiYear}
                    onChange={(e) => setVoiYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="e.g. 2025"
                    className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Make</span>
                  <input
                    type="text"
                    value={voiMake}
                    onChange={(e) => setVoiMake(e.target.value)}
                    placeholder="e.g. Jeep"
                    className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Model</span>
                  <input
                    type="text"
                    value={voiModel}
                    onChange={(e) => setVoiModel(e.target.value)}
                    placeholder="e.g. Wrangler"
                    className="min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">New or Used?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiDealType("new")}
                    className={`flex min-h-12 flex-1 items-center justify-center border px-4 text-sm font-bold transition ${voiDealType === "new" ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]" : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"}`}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiDealType("used")}
                    className={`flex min-h-12 flex-1 items-center justify-center border px-4 text-sm font-bold transition ${voiDealType === "used" ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]" : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"}`}
                  >
                    Used
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={!voiDealType}
                onClick={() => {
                  const wf = loadWorkflow();
                  const updated = {
                    ...wf,
                    vin: voiVin,
                    vehicleYear: voiYear,
                    vehicleMake: voiMake,
                    vehicleModel: voiModel,
                    dealType: voiDealType,
                  };
                  saveWorkflow(updated);
                  // Also persist to server
                  const dealId = typeof window !== "undefined" ? window.sessionStorage.getItem("walker.deal.id.v1") : null;
                  if (dealId) {
                    saveDealToServer(updated, {}, dealId);
                  }
                  setVoiDone(true);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center border border-white bg-white text-sm font-bold uppercase tracking-[0.08em] text-[var(--accent)] transition hover:bg-white/90 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-center text-sm font-bold text-white/60">
                {voiYear} {voiMake} {voiModel} ({voiDealType === "new" ? "New" : "Used"}) — how do you want to start?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/documents/spaced"
                  className="inline-flex min-h-12 items-center justify-center border border-white bg-white text-sm font-bold uppercase tracking-[0.08em] text-[var(--accent)] transition hover:bg-white/90"
                >
                  Use SPACED
                </Link>
                <Link
                  href="/documents/spaced?bypass=1"
                  className="inline-flex min-h-12 items-center justify-center border border-white bg-white text-sm font-bold uppercase tracking-[0.08em] text-[var(--accent)] transition hover:bg-white/90"
                >
                  Continue to Deal
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Load a Deal ── */}
      <section className="overflow-hidden border border-white/10 bg-[#1c1c1e] shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-white">Load a Deal</h2>
          <p className="mt-1 text-sm text-white/70">Resume an open deal where you left off.</p>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
          {loading ? (
            <p className="text-center text-sm text-white/50">Loading deals…</p>
          ) : deals.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">No open deals yet.</p>
          ) : (
            <div className="grid gap-3">
              {deals.map((deal) => {
                const wd = deal.workflow_data;
                const customer = wd.customerName || "No customer";
                const vehicle = [wd.vehicleYear, wd.vehicleMake, wd.vehicleModel]
                  .filter(Boolean)
                  .join(" ");
                const last8 = getLast8(wd.vin);
                const dealNum = wd.dealNumber || "";

                return (
                  <div
                    key={deal.id}
                    className="border border-white/10 bg-[#2a2a2e] transition hover:border-white/25 hover:bg-[#333]"
                  >
                    <button
                      type="button"
                      onClick={() => resumeDeal(deal)}
                      className="w-full px-4 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-white">
                            {customer}
                          </p>
                          <p className="mt-1 truncate text-sm text-white/60">
                            {vehicle || "No vehicle"}{" "}
                            {last8 && (
                              <span className="text-white/40">· {last8}</span>
                            )}
                          </p>
                        </div>
                        {dealNum && (
                          <span className="shrink-0 text-lg font-extrabold text-white/30">
                            #{dealNum}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-white/30">
                        Updated {formatTime(deal.updated_at)}
                      </p>
                    </button>

                    {/* Delete row */}
                    <div className="flex items-center justify-end border-t border-white/5 px-4 py-2">
                      {confirmDeleteId === deal.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">Delete this deal?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(deal.id)}
                            className="inline-flex min-h-8 items-center justify-center border border-red-500 bg-red-500 px-3 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-red-600"
                          >
                            Yes, Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex min-h-8 items-center justify-center border border-white/20 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em] text-white/60 transition hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(deal.id)}
                          className="inline-flex min-h-8 items-center justify-center border border-white/10 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em] text-red-400 transition hover:border-red-500/30 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
