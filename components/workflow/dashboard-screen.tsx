"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CarFront, ChevronRight, FileText, ContactRound, Images, MessageCircle } from "lucide-react";
import { ConsultantPace, ConsultantTeamBoard } from "@/components/command-center/team-board";
import styles from "@/components/command-center/workspace.module.css";
import {
  clearLocalDealId,
  consumeStartFreshDeal,
  deleteDeal,
  listMyDeals,
  markStartFreshDeal,
  setLocalDealId,
  type DealSummary
} from "@/lib/deals";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import {
  clearWorkflowSession,
  loadWorkflow,
  saveSignatures,
  saveWorkflow,
  type WorkflowData
} from "@/lib/walker-workflow";

export function DashboardScreen() {
  const router = useRouter();
  const [lastDeal, setLastDeal] = useState<DealSummary | null>(null);
  const [allDeals, setAllDeals] = useState<DealSummary[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [messengerUnread, setMessengerUnread] = useState(0);
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

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    async function loadUnread() {
      const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/messenger", { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const payload = await response.json();
      const unread = (payload.conversations ?? []).reduce((total: number, conversation: { id: string; messenger_participants?: Array<{ user_id: string; last_read_at: string }> }) => {
        const lastRead = conversation.messenger_participants?.find((participant) => participant.user_id === payload.me)?.last_read_at;
        const threshold = lastRead ? new Date(lastRead).getTime() : 0;
        return total + (payload.messages ?? []).filter((message: { conversation_id: string; sender_id: string; created_at: string; deleted_at?: string | null }) =>
          message.conversation_id === conversation.id
          && message.sender_id !== payload.me
          && !message.deleted_at
          && new Date(message.created_at).getTime() > threshold
        ).length;
      }, 0);
      if (!cancelled) setMessengerUnread(unread);
    }
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
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
  return (
    <>
      <section aria-label="Consultant dashboard">
        <div className={styles.hero} id="start-deal">
          <p className={styles.eyebrow}>Welcome to NDOX</p>
          <h1 className={styles.pageTitle}>Start a Deal</h1>
          <div className={styles.underline} />
          <p className={styles.subtitle}>Choose a vehicle type to get started.</p>
        </div>
        <nav className={styles.vehicleActions} aria-label="Start a deal">
          <button type="button" onClick={() => startFreshDeal("new")} className={styles.vehicleButton}><CarFront /><span>New Vehicle</span><ChevronRight /></button>
          <button type="button" onClick={() => startFreshDeal("used")} className={styles.vehicleButton}><CarFront /><span>Used Vehicle</span><ChevronRight /></button>
        </nav>
        <div className={styles.dashboardGrid}>
          <div className={styles.column}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}><h2>Resume Deal / Previous Deals</h2><button type="button" className={styles.textLink} onClick={() => setShowPicker(true)}>View All ({pickerDeals.length})</button></div>
              <div className={styles.dealList}>
                {allDeals.slice(0, 3).map(deal => {
                  const wf = deal.workflow_data as unknown as WorkflowData;
                  const vehicle = [wf.vehicleYear, wf.vehicleMake, wf.vehicleModel].filter(Boolean).join(" ");
                  return <button type="button" key={deal.id} onClick={() => resumeDeal(deal)} className={styles.dealRow}><div><strong>{wf.customerName || "In-Progress Deal"}</strong><small>{vehicle || "Vehicle details pending"}</small></div><span className={styles.dealStatus}>Resume</span><ChevronRight size={18} /></button>;
                })}
                {!lastDeal && localResume && <Link href={localResume.dealType === "new" ? "/deal-sheet/new" : "/deal-sheet"} className={styles.dealRow}><div><strong>{localResume.name}</strong><small>Resume this device&apos;s in-progress deal</small></div><ChevronRight size={18} /></Link>}
                {!lastDeal && !localResume && <p className={`${styles.muted} p-4`}>No saved deals yet. Start a new or used vehicle deal above.</p>}
              </div>
            </section>
            <ConsultantPace />
          </div>
          <div className={styles.column}>
            <section className={styles.panel}>
              <details open><summary className={`${styles.panelHeader} cursor-pointer list-none`}><h2>Consultant Tools</h2><ChevronRight size={18} /></summary>
                <div className={styles.tools}>
                  {[
                    { label: "Training", href: "/training", icon: FileText },
                    { label: "Business Card", href: "/business-card", icon: ContactRound },
                    { label: "Vehicle Collage", href: "/vehicle-collage", icon: Images },
                    { label: "Messenger", href: "/messenger", icon: MessageCircle },
                  ].map(({ label, href, icon: Icon }) => <Link key={href} href={href} className={styles.tool}><Icon /><span>{label}{href === "/messenger" && messengerUnread > 0 && <span className={styles.unread}> · {messengerUnread} unread</span>}</span><ChevronRight /></Link>)}
                </div>
              </details>
            </section>
            <ConsultantTeamBoard />
          </div>
        </div>
      </section>

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
