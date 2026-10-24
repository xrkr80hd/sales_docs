"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  deleteDeal,
  listMyDeals,
  setLocalDealId,
  type DealSummary,
} from "@/lib/deals";
import {
  getLast8,
  saveSignatures,
  saveWorkflow,
} from "@/lib/walker-workflow";

export function MyDealsScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
      {/* ── Load a Deal ── */}
      <section className="overflow-hidden border border-white/10 bg-[#1c1c1e] shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-white">Resume Deal</h2>
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
