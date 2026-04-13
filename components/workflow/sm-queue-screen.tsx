"use client";

import { useEffect, useState } from "react";

import {
  claimSmDeal,
  finishSmDeal,
  listSmQueue,
  setDealNumber,
  type SmQueueDeal,
} from "@/lib/deals";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

function relativeTime(isoDate: string, now: number): string {
  const diff = now - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function SmQueueScreen({ role }: { role: string }) {
  const [deals, setDeals] = useState<SmQueueDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [dealNumbers, setDealNumbers] = useState<Record<string, string>>({});
  const [savingDealNum, setSavingDealNum] = useState<string | null>(null);

  const canAct = role === "sales_manager" || role === "admin";

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listSmQueue();
      if (!cancelled) {
        setDeals(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Shared refetch helper — used by realtime, polling, and visibility
  const refresh = () => listSmQueue().then((fresh) => setDeals(fresh));

  // Tick the relative-time display every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Polling fallback — refetch every 15s so deals always appear even if realtime drops
  useEffect(() => {
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Refetch when tab becomes visible (returning from background)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Realtime: notifications + deal updates → instant refresh
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("sm-queue-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: "recipient_role=eq.sales_manager" },
        (payload) => {
          refresh();

          const msg = (payload.new as { message?: string })?.message ?? "New deal in queue";
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Sales Docs — SM Queue", { body: msg, icon: "/android-chrome-192x192.png" });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals", filter: "sm_ready=eq.true" },
        () => { refresh(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals", filter: "sm_ready=eq.true" },
        () => { refresh(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleClaim(dealId: string) {
    setClaiming(dealId);
    const ok = await claimSmDeal(dealId);
    if (ok) await refresh();
    setClaiming(null);
  }

  async function handleSaveDealNumber(dealId: string) {
    const num = dealNumbers[dealId]?.trim();
    if (!num) return;
    setSavingDealNum(dealId);
    const ok = await setDealNumber(dealId, num);
    if (ok) await refresh();
    setSavingDealNum(null);
  }

  async function handleFinish(dealId: string) {
    setFinishing(dealId);
    const ok = await finishSmDeal(dealId);
    if (ok) await refresh();
    setFinishing(null);
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
    <section className="overflow-hidden border border-white/10 bg-[#1c1c1e] shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
      <div className="bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-5 sm:px-6">
        <h2 className="text-2xl font-bold text-white">Sales Manager Queue</h2>
        <p className="mt-1 text-sm text-white/70">Review deals, assign deal numbers, then send to F&amp;I — oldest first</p>
      </div>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        {loading ? (
          <p className="text-center text-sm text-white/50">Loading queue…</p>
        ) : deals.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-lg font-semibold text-white/60">Queue is empty</p>
            <p className="mt-2 text-sm text-white/40">
              No deals have been sent for review yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {deals.map((deal, i) => {
              const wd = deal.workflow_data;
              const customer = wd.customerName || "No customer";
              const vehicle = [wd.vehicleYear, wd.vehicleMake, wd.vehicleModel]
                .filter(Boolean)
                .join(" ");
              const vin = wd.vin || "";
              const last8 = vin.length >= 8 ? vin.slice(-8) : vin;

              const isClaimed = !!deal.sm_claimed_at;
              const isMyClaim = isClaimed && deal.sm_claimed_by === userId;
              const claimerName = deal.claimer?.display_name || "Sales Manager";
              const hasDealNum = !!deal.deal_number;
              const localDealNum = dealNumbers[deal.id] ?? deal.deal_number ?? "";

              return (
                <div
                  key={deal.id}
                  className={`border bg-[#2a2a2e] px-4 py-4 ${isClaimed
                    ? "border-l-4 border-l-amber-500 border-t-white/10 border-r-white/10 border-b-white/10"
                    : "border-white/10"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/20 bg-white/5 text-sm font-bold text-white/40">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-bold text-white">
                            {customer}
                          </p>
                          {isClaimed && (
                            <span className="shrink-0 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-amber-400">
                              Working
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-white/60">
                          {vehicle || "No vehicle"}{" "}
                          {last8 && (
                            <span className="text-white/40">· {last8}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {hasDealNum && (
                      <span className="shrink-0 text-lg font-extrabold text-white/30">
                        #{deal.deal_number}
                      </span>
                    )}
                  </div>

                  {/* SPACED priorities */}
                  {(() => {
                    const spacedItems: { letter: string; value: string }[] = [
                      { letter: "S", value: wd.prioritySafety },
                      { letter: "P", value: wd.priorityPerformance },
                      { letter: "A", value: wd.priorityAppearance },
                      { letter: "C", value: wd.priorityComfort },
                      { letter: "E", value: wd.priorityEconomy },
                      { letter: "D", value: wd.priorityDependability },
                    ].filter((s) => !!s.value);
                    const other = wd.priorityOther;
                    const hasSpaced = spacedItems.length > 0 || !!other;
                    if (!hasSpaced) return null;
                    return (
                      <div className="mt-3">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/25">SPACED</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {spacedItems.map((s) => (
                            <span
                              key={s.letter}
                              className="inline-flex items-center gap-1 border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-bold text-[var(--accent)]"
                            >
                              {s.letter}
                              <span className="font-normal text-white/50">— {s.value}</span>
                            </span>
                          ))}
                          {other && (
                            <span className="inline-flex items-center gap-1 border border-white/20 bg-white/5 px-2 py-0.5 text-xs font-bold text-white/60">
                              Other
                              <span className="font-normal text-white/40">— {other}</span>
                            </span>
                          )}
                        </div>
                        {(wd.currentPayment || wd.newBudget) && (
                          <div className="mt-1.5 flex gap-4 text-xs text-white/40">
                            {wd.currentPayment && <span>Current: <span className="text-white/60">${wd.currentPayment}</span></span>}
                            {wd.newBudget && <span>Budget: <span className="text-white/60">${wd.newBudget}</span></span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Deal details row */}
                  <div className="mt-3 grid gap-2 text-xs text-white/40 sm:grid-cols-4">
                    <div>
                      <span className="font-bold uppercase tracking-[0.12em] text-white/25">Phone</span>
                      <p className="mt-0.5 text-white/50">{wd.cellPhone || "—"}</p>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-[0.12em] text-white/25">Trade</span>
                      <p className="mt-0.5 text-white/50">{wd.tradeIn === "yes" ? `Yes · $${wd.approxBalance || "?"}` : "No"}</p>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-[0.12em] text-white/25">Sent</span>
                      <p className="mt-0.5 text-white/50">{deal.sm_sent_at ? formatTime(deal.sm_sent_at) : "—"}</p>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-[0.12em] text-white/25">Waiting</span>
                      <p className="mt-0.5 font-mono text-white/50">{deal.sm_sent_at ? relativeTime(deal.sm_sent_at, now) : "—"}</p>
                    </div>
                  </div>

                  {isClaimed && (
                    <p className="mt-2 text-xs text-amber-400/70">
                      Claimed by {claimerName}
                    </p>
                  )}

                  {/* SM Actions */}
                  {canAct && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      {!isClaimed && (
                        <button
                          onClick={() => handleClaim(deal.id)}
                          disabled={claiming === deal.id}
                          className="inline-flex min-h-9 items-center justify-center border border-amber-500 bg-amber-500/10 px-4 text-xs font-bold uppercase tracking-[0.08em] text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          {claiming === deal.id ? "Claiming…" : "Claim"}
                        </button>
                      )}
                      {isMyClaim && !hasDealNum && (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Deal #"
                            value={localDealNum}
                            onChange={(e) => setDealNumbers((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                            className="min-h-9 w-32 border border-white/10 bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                          />
                          <button
                            onClick={() => handleSaveDealNumber(deal.id)}
                            disabled={!localDealNum.trim() || savingDealNum === deal.id}
                            className="inline-flex min-h-9 items-center justify-center border border-white/20 bg-white/10 px-4 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20 disabled:opacity-50"
                          >
                            {savingDealNum === deal.id ? "Saving…" : "Set Deal #"}
                          </button>
                        </>
                      )}
                      {isMyClaim && hasDealNum && (
                        <button
                          onClick={() => handleFinish(deal.id)}
                          disabled={finishing === deal.id}
                          className="inline-flex min-h-9 items-center justify-center border border-green-500 bg-green-500/10 px-4 text-xs font-bold uppercase tracking-[0.08em] text-green-400 transition hover:bg-green-500/20 disabled:opacity-50"
                        >
                          {finishing === deal.id ? "Sending…" : "Send to F&I"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
