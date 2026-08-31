"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useVinConfirmation } from "@/components/ui/use-vin-confirmation";
import {
  clearLocalDealId,
  consumeStartFreshDeal,
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
  CHECKLIST_ITEMS,
  clearWorkflowSession,
  createDefaultWorkflowData,
  getLast8,
  loadSignatures,
  loadWorkflow,
  normalizeVin,
  REQUIRED_DOCS_SECTIONS,
  saveSignatures,
  saveWorkflow,
  subscribeToWorkflowSessionClear,
  type ChecklistKey,
  type WorkflowData
} from "@/lib/walker-workflow";

/* ── Accordion helper ─────────────────────────────────────── */

function Section({
  title,
  open,
  onToggle,
  complete,
  onToggleComplete,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  complete?: boolean;
  onToggleComplete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 shadow-[0_0_30px_rgba(190,23,23,0.12),0_14px_40px_rgba(0,0,0,0.2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-[16px] bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          {complete && (
            <span className="flex h-5 w-5 items-center justify-center bg-green-500 text-xs font-bold text-white">
              ✓
            </span>
          )}
          <span className="text-lg font-bold text-white">{title}</span>
        </span>
        <span
          className="text-xl leading-none text-white/70 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 bg-[#2a2a2e] px-5 pb-6 pt-5">
          {children}
          {onToggleComplete && (
            <button
              type="button"
              onClick={onToggleComplete}
              className={`mt-5 flex min-h-12 w-full items-center justify-center gap-3 border px-4 text-sm font-bold uppercase tracking-[0.08em] transition ${complete
                ? "border-green-500 bg-green-500/20 text-green-400"
                : "border-white/20 bg-white/5 text-white/60 hover:border-green-500"
                }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center border text-xs ${complete
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-white/30 bg-transparent"
                  }`}
              >
                {complete ? "✓" : ""}
              </span>
              {complete ? "Section Complete" : "Mark Complete"}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="mt-4 flex w-full items-center justify-center py-1 text-white/40 transition hover:text-white/70"
          >
            <span className="text-lg">▲</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared input classes ─────────────────────────────────── */

const INPUT =
  "min-h-12 border border-white/10 bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]";
const LABEL =
  "text-xs font-bold uppercase tracking-[0.14em] text-white/60";

/* ── Main component ───────────────────────────────────────── */

export function UnifiedInputScreen({
  dealType = "used",
}: {
  dealType?: "used" | "new";
}) {
  const isNew = dealType === "new";
  const { dialog } = useVinConfirmation();
  const [data, setData] = useState<WorkflowData>(() => loadWorkflow());
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"" | "success" | "warn">("");
  const [dealId, setDealId] = useState<string | null>(() => getLocalDealId());
  const [openDeals, setOpenDeals] = useState<DealSummary[] | null>(null);
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [vinCheckOpen, setVinCheckOpen] = useState(false);

  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  /* ── Accordion open states ── */
  const [sections, setSections] = useState<Record<string, boolean>>({
    customer: true,
    address: false,
    vehicle: false,
    trade: false,
    payoff: false,
    dealSetup: false,
    checklist: false,
    requiredDocs: false,
    spaced: false,
  });

  function toggle(key: string) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isSectionComplete(key: string) {
    return Boolean(data.sectionComplete?.[key]);
  }

  function toggleSectionComplete(key: string) {
    setData((cur) => {
      const next = {
        ...cur,
        sectionComplete: {
          ...(cur.sectionComplete ?? {}),
          [key]: !cur.sectionComplete[key],
        },
      };
      saveWorkflow(next);
      return next;
    });
  }

  /* ── Data helpers ── */

  function updateField(name: keyof WorkflowData, value: string | boolean) {
    setData((cur) => {
      const next = { ...cur, [name]: value };
      if (name === "homeAddress" && typeof value === "string")
        next.address = value;
      saveWorkflow(next);
      return next;
    });
  }

  function toggleChecklistItem(key: ChecklistKey) {
    setData((cur) => {
      const next = {
        ...cur,
        deliveryChecklist: {
          ...cur.deliveryChecklist,
          [key]: !cur.deliveryChecklist[key],
        },
      };
      saveWorkflow(next);
      return next;
    });
  }

  /* ── sessionStorage auto-save ── */
  useEffect(() => {
    saveWorkflow(data);
  }, [data]);

  /* ── Persist dealType from route ── */
  useEffect(() => {
    setData((prev) => {
      if (prev.dealType === dealType) return prev;
      return { ...prev, dealType };
    });
  }, [dealType]);

  /* ── Server sync (debounced 2s) ── */
  const debouncedServerSave = useCallback(
    (workflow: WorkflowData, currentDealId: string | null) => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
      serverSaveTimer.current = setTimeout(async () => {
        if (!isSupabaseConfigured()) return;
        const sigs = loadSignatures();
        const result = await saveDealToServer(workflow, sigs, currentDealId);
        if (result === null) {
          setStatus("Could not sync to server — please refresh or sign in again.");
          setTone("warn");
          return;
        }
        if (result.id) {
          setDealId(result.id);
        }
      }, 2000);
    },
    [],
  );

  useEffect(() => {
    if (!initialLoadDone.current) return;
    debouncedServerSave(data, dealId);
    return () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    };
  }, [data, dealId, debouncedServerSave]);

  /* ── Load open deals on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function loadDeals() {
      const startFreshDealType = consumeStartFreshDeal();
      if (startFreshDealType === dealType) {
        const next = saveWorkflow({
          ...createDefaultWorkflowData(),
          dealType,
        });
        clearLocalDealId();
        setDealId(null);
        setData(next);
        setOpenDeals(null);
        setShowDealPicker(false);
        initialLoadDone.current = true;
        return;
      }

      if (!isSupabaseConfigured()) {
        initialLoadDone.current = true;
        return;
      }
      const localId = getLocalDealId();
      if (localId) {
        const current = loadWorkflow();
        const isEmpty =
          !current.customerName && !current.vin && !current.dealNumber;
        if (isEmpty) {
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
            clearLocalDealId();
            setDealId(null);
          }
        }
        initialLoadDone.current = true;
        return;
      }
      const deals = await listMyDeals();
      if (cancelled) return;
      if (deals.length === 0) {
        initialLoadDone.current = true;
        return;
      }
      if (deals.length === 1) {
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
      setOpenDeals(deals);
      setShowDealPicker(true);
      initialLoadDone.current = true;
    }
    loadDeals();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Session clear listener ── */
  useEffect(() => {
    return subscribeToWorkflowSessionClear(() => {
      clearLocalDealId();
      setDealId(null);
      setData(loadWorkflow());
      setStatus("Session cleared. Ready for a new deal.");
      setTone("success");
    });
  }, []);

  /* ── Actions ── */

  function clearSessionNow() {
    clearWorkflowSession();
    clearLocalDealId();
    setDealId(null);
    setData(loadWorkflow());
    setStatus("Session cleared. Ready for a new deal.");
    setTone("success");
  }

  async function finishDealNow() {
    if (!dealId) {
      clearSessionNow();
      return;
    }
    const ok = await finishDeal(dealId);
    if (ok) {
      clearSessionNow();
      setStatus("Deal finished. It will be removed in ~8 hours.");
    } else {
      setStatus("Could not finish deal — try again.");
      setTone("warn");
    }
  }

  const [saving, setSaving] = useState(false);

  async function saveNow() {
    setSaving(true);
    setStatus("");
    setTone("");
    try {
      if (!isSupabaseConfigured()) {
        setStatus("Supabase not configured — cannot save.");
        setTone("warn");
        return;
      }
      const sigs = loadSignatures();
      const result = await saveDealToServer(data, sigs, dealId);
      if (result === null) {
        setStatus("Save failed — please refresh or sign in again.");
        setTone("warn");
        return;
      }
      if (result.id) setDealId(result.id);
      setStatus("Saved.");
      setTone("success");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintAll() {
    setVinCheckOpen(true);
  }

  function vinCheckConfirm() {
    setVinCheckOpen(false);
    const path = isNew ? "/print/all-new" : "/print/all";
    window.open(`${path}?autoprint=1`, "_blank");
    setStatus("Print All window opened.");
    setTone("success");
  }

  function vinCheckCancel() {
    setVinCheckOpen(false);
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

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <>
      <div className="grid gap-4">
        {/* ── Hero ── */}
        <section className="overflow-hidden border border-white/10 bg-[var(--panel)] bg-[url('/bg-hero-16x9.jpg')] bg-cover bg-center shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
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
              <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[0.01em] text-white drop-shadow-sm sm:text-4xl">
                {isNew ? "New Vehicle" : "Used Vehicle"}
              </h2>
              <p className="mt-2 text-sm font-bold text-white/90">
                Last 8:{" "}
                <span className="font-mono">{getLast8(data.vin) || "—"}</span>
              </p>
              <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-white/70">
                Fill in every field once — all forms auto-populate at print time.
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

        {/* Status bar */}
        {status ? (
          <p
            className={`px-2 text-sm font-semibold ${tone === "warn"
              ? "text-yellow-400"
              : tone === "success"
                ? "text-green-400"
                : "text-white/50"
              }`}
          >
            {status}
          </p>
        ) : null}

        {/* ── 1. Customer Info ───────────────────────────────── */}
        <Section
          title="Customer Info"
          open={sections.customer}
          onToggle={() => toggle("customer")}
          complete={isSectionComplete("customer")}
          onToggleComplete={() => toggleSectionComplete("customer")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className={LABEL}>Customer Name</span>
              <input
                type="text"
                value={data.customerName}
                onChange={(e) => updateField("customerName", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className={LABEL}>Co-Buyer</span>
              <input
                type="text"
                value={data.coCustomerName}
                onChange={(e) => updateField("coCustomerName", e.target.value)}
                placeholder="Leave blank if none"
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Cell Phone</span>
              <input
                type="tel"
                value={data.cellPhone}
                onChange={(e) => updateField("cellPhone", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Email</span>
              <input
                type="email"
                value={data.email}
                onChange={(e) => updateField("email", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className={LABEL}>How did you hear about us?</span>
              <input
                type="text"
                value={data.customerSource}
                onChange={(e) => updateField("customerSource", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className={LABEL}>Vehicle of Interest</span>
              <input
                type="text"
                value={data.vehicleOfInterest}
                onChange={(e) =>
                  updateField("vehicleOfInterest", e.target.value)
                }
                className={INPUT}
              />
            </label>
          </div>
        </Section>

        {/* ── 2. Address ─────────────────────────────────────── */}
        <Section
          title="Address"
          open={sections.address}
          onToggle={() => toggle("address")}
          complete={isSectionComplete("address")}
          onToggleComplete={() => toggleSectionComplete("address")}
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className={LABEL}>Street Address</span>
              <input
                type="text"
                value={data.homeAddress}
                onChange={(e) => updateField("homeAddress", e.target.value)}
                className={INPUT}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="col-span-2 grid gap-2 sm:col-span-1">
                <span className={LABEL}>City</span>
                <input
                  type="text"
                  value={data.homeCity}
                  onChange={(e) => updateField("homeCity", e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>State</span>
                <input
                  type="text"
                  value={data.homeState}
                  onChange={(e) => updateField("homeState", e.target.value)}
                  className={`${INPUT} w-full sm:w-20`}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Zip</span>
                <input
                  type="text"
                  value={data.homeZip}
                  onChange={(e) => updateField("homeZip", e.target.value)}
                  className={`${INPUT} w-full sm:w-28`}
                />
              </label>
            </div>
          </div>

          {/* Mailing different toggle */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() =>
                updateField("mailingDifferent", !data.mailingDifferent)
              }
              className={`flex min-h-12 w-full items-center gap-3 border px-4 text-sm font-bold transition ${data.mailingDifferent
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center border text-xs ${data.mailingDifferent
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/30 bg-transparent"
                  }`}
              >
                {data.mailingDifferent ? "✓" : ""}
              </span>
              Mailing address is different
            </button>
          </div>

          {data.mailingDifferent && (
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>Mailing Address</span>
                <input
                  type="text"
                  value={data.mailingAddress}
                  onChange={(e) =>
                    updateField("mailingAddress", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="col-span-2 grid gap-2 sm:col-span-1">
                  <span className={LABEL}>City</span>
                  <input
                    type="text"
                    value={data.mailingCity}
                    onChange={(e) => updateField("mailingCity", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>State</span>
                  <input
                    type="text"
                    value={data.mailingState}
                    onChange={(e) => updateField("mailingState", e.target.value)}
                    className={`${INPUT} w-full sm:w-20`}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Zip</span>
                  <input
                    type="text"
                    value={data.mailingZip}
                    onChange={(e) => updateField("mailingZip", e.target.value)}
                    className={`${INPUT} w-full sm:w-28`}
                  />
                </label>
              </div>
            </div>
          )}
        </Section>

        {/* ── 3. S.P.A.C.E.D. ───────────────────────────────── */}
        <Section
          title="S.P.A.C.E.D."
          open={sections.spaced}
          onToggle={() => toggle("spaced")}
          complete={isSectionComplete("spaced")}
          onToggleComplete={() => toggleSectionComplete("spaced")}
        >
          {!data.spacedConfirmed ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className={LABEL}>Current Payment</span>
                  <input
                    type="text"
                    value={data.currentPayment}
                    onChange={(e) => updateField("currentPayment", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>New Budget</span>
                  <input
                    type="text"
                    value={data.newBudget}
                    onChange={(e) => updateField("newBudget", e.target.value)}
                    className={INPUT}
                  />
                </label>
              </div>
              <p className="mb-4 text-xs text-white/40">
                Select which priorities matter to this customer, then confirm.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["prioritySafety", "S — Safety"],
                    ["priorityPerformance", "P — Performance"],
                    ["priorityAppearance", "A — Appearance"],
                    ["priorityComfort", "C — Comfort"],
                    ["priorityEconomy", "E — Economy"],
                    ["priorityDependability", "D — Dependability"],
                  ] as [keyof typeof data, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateField(key, data[key] ? "" : " ")
                    }
                    className={`flex min-h-14 items-center gap-3 border px-4 text-base font-bold transition ${data[key]
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                      : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                      }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border text-sm ${data[key]
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-white/30 bg-transparent"
                        }`}
                    >
                      {data[key] ? "✓" : ""}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => updateField("spacedConfirmed", true)}
                className="mt-5 inline-flex min-h-10 items-center justify-center border border-[var(--accent)] rounded-[16px] bg-[var(--accent)] px-6 text-xs font-bold uppercase tracking-[0.08em] text-white"
              >
                Confirm Selections
              </button>
            </>
          ) : (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className={LABEL}>Current Payment</span>
                  <input
                    type="text"
                    value={data.currentPayment}
                    onChange={(e) => updateField("currentPayment", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>New Budget</span>
                  <input
                    type="text"
                    value={data.newBudget}
                    onChange={(e) => updateField("newBudget", e.target.value)}
                    className={INPUT}
                  />
                </label>
              </div>
              <p className="mb-4 text-xs text-white/40">
                Type why each priority matters — only your text shows on the printed form.
              </p>
              {(
                [
                  ["prioritySafety", "Safety"],
                  ["priorityPerformance", "Performance"],
                  ["priorityAppearance", "Appearance"],
                  ["priorityComfort", "Comfort"],
                  ["priorityEconomy", "Economy"],
                  ["priorityDependability", "Dependability"],
                ] as [keyof typeof data, string][]
              )
                .filter(([key]) => data[key])
                .map(([key, label]) => (
                  <label key={key} className="mb-3 grid gap-2">
                    <span className={LABEL}>{label}</span>
                    <input
                      type="text"
                      value={data[key] === " " ? "" : (data[key] as string)}
                      onChange={(e) =>
                        updateField(key, e.target.value || " ")
                      }
                      placeholder={`Why does ${label.toLowerCase()} matter to this customer?`}
                      className={INPUT}
                    />
                  </label>
                ))}
              <label className="mb-3 grid gap-2">
                <span className={LABEL}>Other</span>
                <input
                  type="text"
                  value={data.priorityOther}
                  onChange={(e) => updateField("priorityOther", e.target.value)}
                  placeholder="Any other priority — type here"
                  className={INPUT}
                />
              </label>
              <button
                type="button"
                onClick={() => updateField("spacedConfirmed", false)}
                className="mt-5 inline-flex min-h-10 items-center justify-center border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-[0.08em] text-white/60 hover:border-[var(--accent)]"
              >
                Edit Selections
              </button>
            </>
          )}
        </Section>

        {/* ── 4. Vehicle Trade-In ─────────────────────────── */}
        <Section
          title="Vehicle Trade-In"
          open={sections.trade}
          onToggle={() => toggle("trade")}
          complete={isSectionComplete("trade")}
          onToggleComplete={() => toggleSectionComplete("trade")}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                updateField(
                  "tradeIn",
                  data.tradeIn === "yes" ? "" : "yes",
                )
              }
              className={`flex min-h-12 flex-1 items-center justify-center border px-4 text-sm font-bold transition ${data.tradeIn === "yes"
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              Yes — Has Trade
            </button>
            <button
              type="button"
              onClick={() =>
                updateField(
                  "tradeIn",
                  data.tradeIn === "no" ? "" : "no",
                )
              }
              className={`flex min-h-12 flex-1 items-center justify-center border px-4 text-sm font-bold transition ${data.tradeIn === "no"
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              No Trade
            </button>
          </div>

          {data.tradeIn === "yes" && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className={LABEL}>Approx. Balance</span>
                  <input
                    type="text"
                    value={data.approxBalance}
                    onChange={(e) =>
                      updateField("approxBalance", e.target.value)
                    }
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Current Payment</span>
                  <input
                    type="text"
                    value={data.currentPayment}
                    onChange={(e) =>
                      updateField("currentPayment", e.target.value)
                    }
                    className={INPUT}
                  />
                </label>
              </div>

              <hr className="my-4 border-white/10" />
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                Trade-In Vehicle
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2">
                  <span className={LABEL}>Year</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={data.tradeYear}
                    onChange={(e) => updateField("tradeYear", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Make</span>
                  <input
                    type="text"
                    value={data.tradeMake}
                    onChange={(e) => updateField("tradeMake", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Model</span>
                  <input
                    type="text"
                    value={data.tradeModel}
                    onChange={(e) => updateField("tradeModel", e.target.value)}
                    className={INPUT}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2">
                  <span className={LABEL}>Trade VIN</span>
                  <input
                    type="text"
                    maxLength={17}
                    spellCheck={false}
                    autoCapitalize="characters"
                    value={data.tradeVin}
                    onChange={(e) => updateField("tradeVin", e.target.value)}
                    className={`${INPUT} font-mono uppercase`}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Color</span>
                  <input
                    type="text"
                    value={data.tradeColor}
                    onChange={(e) => updateField("tradeColor", e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-2">
                  <span className={LABEL}>Mileage</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={data.tradeMileage}
                    onChange={(e) =>
                      updateField("tradeMileage", e.target.value)
                    }
                    className={INPUT}
                  />
                </label>
              </div>
            </>
          )}
        </Section>

        {/* ── 5. Payoff (shows when trade = yes) ─────────────── */}
        {data.tradeIn === "yes" && (
          <Section
            title="Payoff / Lienholder"
            open={sections.payoff}
            onToggle={() => toggle("payoff")}
            complete={isSectionComplete("payoff")}
            onToggleComplete={() => toggleSectionComplete("payoff")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className={LABEL}>Lienholder Name</span>
                <input
                  type="text"
                  value={data.lienholderName}
                  onChange={(e) =>
                    updateField("lienholderName", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Lienholder Phone</span>
                <input
                  type="tel"
                  value={data.lienholderPhone}
                  onChange={(e) =>
                    updateField("lienholderPhone", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Lienholder Address</span>
                <input
                  type="text"
                  value={data.lienholderAddress}
                  onChange={(e) =>
                    updateField("lienholderAddress", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Account Number</span>
                <input
                  type="text"
                  value={data.accountNumber}
                  onChange={(e) =>
                    updateField("accountNumber", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>10 Day Payoff $</span>
                <input
                  type="text"
                  value={data.payoff15Day}
                  onChange={(e) => updateField("payoff15Day", e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Good Until Date</span>
                <input
                  type="date"
                  value={data.goodUntilDate}
                  onChange={(e) =>
                    updateField("goodUntilDate", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Payoff as of Today $</span>
                <input
                  type="text"
                  value={data.payoffToday}
                  onChange={(e) => updateField("payoffToday", e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Per Diem</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={data.perDiem}
                  onChange={(e) => updateField("perDiem", e.target.value)}
                  className={INPUT}
                />
              </label>
            </div>

            <hr className="my-4 border-white/10" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
              Representative
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className={LABEL}>Rep Name</span>
                <input
                  type="text"
                  value={data.representativeName}
                  onChange={(e) =>
                    updateField("representativeName", e.target.value)
                  }
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Rep Date</span>
                <input
                  type="date"
                  value={data.repDate}
                  onChange={(e) => updateField("repDate", e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Verified By</span>
                <input
                  type="text"
                  value={data.verifiedBy}
                  onChange={(e) => updateField("verifiedBy", e.target.value)}
                  className={INPUT}
                />
              </label>
            </div>
          </Section>
        )}

        {/* ── 6. Vehicle Being Purchased ─────────────────────── */}
        <Section
          title="Vehicle Being Purchased"
          open={sections.vehicle}
          onToggle={() => toggle("vehicle")}
          complete={isSectionComplete("vehicle")}
          onToggleComplete={() => toggleSectionComplete("vehicle")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className={LABEL}>Year</span>
              <input
                type="text"
                inputMode="numeric"
                value={data.vehicleYear}
                onChange={(e) => updateField("vehicleYear", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Make</span>
              <input
                type="text"
                value={data.vehicleMake}
                onChange={(e) => updateField("vehicleMake", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Model</span>
              <input
                type="text"
                value={data.vehicleModel}
                onChange={(e) => updateField("vehicleModel", e.target.value)}
                className={INPUT}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className={LABEL}>VIN</span>
              <input
                type="text"
                maxLength={17}
                spellCheck={false}
                autoCapitalize="characters"
                value={data.vin}
                onChange={(e) => updateField("vin", e.target.value)}
                className={`${INPUT} font-mono uppercase`}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Mileage</span>
              <input
                type="text"
                inputMode="numeric"
                value={data.mileage}
                onChange={(e) => updateField("mileage", e.target.value)}
                className={INPUT}
              />
            </label>
            <div className="grid gap-2">
              <span className={LABEL}>Stock #</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={data.stockNumber}
                  onChange={(e) => updateField("stockNumber", e.target.value)}
                  className={`${INPUT} flex-1`}
                />
                <select
                  value={data.stockNumberLetter}
                  onChange={(e) =>
                    updateField("stockNumberLetter", e.target.value)
                  }
                  className="min-h-12 border border-white/10 bg-white px-3 text-base font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="F">F – Dealer Trade</option>
                  <option value="G">G</option>
                </select>
              </div>
            </div>
            <label className="grid gap-2">
              <span className={LABEL}>Deal #</span>
              <input
                type="text"
                value={data.dealNumber}
                onChange={(e) => updateField("dealNumber", e.target.value)}
                className={INPUT}
              />
            </label>
          </div>
        </Section>

        {/* ── 7. Deal Setup ──────────────────────────────────── */}
        <Section
          title="Deal Setup"
          open={sections.dealSetup}
          onToggle={() => toggle("dealSetup")}
          complete={isSectionComplete("dealSetup")}
          onToggleComplete={() => toggleSectionComplete("dealSetup")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className={LABEL}>Deal Date</span>
              <input
                type="date"
                value={data.dealDate}
                onChange={(e) => updateField("dealDate", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Tax %</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 6.25"
                value={data.taxPercent}
                onChange={(e) => updateField("taxPercent", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="grid gap-2">
              <span className={LABEL}>Etch #&apos;s</span>
              <input
                type="text"
                value={data.etchNumbers}
                onChange={(e) => updateField("etchNumbers", e.target.value)}
                className={INPUT}
              />
            </label>
          </div>
        </Section>

        {/* ── 8. Required Documents ──────────────────────────── */}
        <Section
          title="Required Documents"
          open={sections.requiredDocs}
          onToggle={() => toggle("requiredDocs")}
          complete={isSectionComplete("requiredDocs")}
          onToggleComplete={() => toggleSectionComplete("requiredDocs")}
        >
          <p className="mb-4 text-sm text-white/50">
            What you need from the customer — and what&apos;s acceptable.
          </p>
          <div className="grid gap-4">
            {REQUIRED_DOCS_SECTIONS.map((section) => (
              <div
                key={section.key}
                className="border border-white/10 bg-[#1e1e21]"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {section.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {section.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toggleSectionComplete(`reqDoc_${section.key}`)
                    }
                    className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs ${isSectionComplete(`reqDoc_${section.key}`)
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-white/30 bg-transparent"
                      }`}
                  >
                    {isSectionComplete(`reqDoc_${section.key}`) ? "✓" : ""}
                  </button>
                </div>
                <ul className="border-t border-white/5 px-4 pb-3 pt-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 py-1 text-xs leading-5 text-white/60"
                    >
                      <span className="mt-1 text-white/30">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 9. Checklist Items ─────────────────────────────── */}
        <Section
          title="Checklist"
          open={sections.checklist}
          onToggle={() => toggle("checklist")}
          complete={isSectionComplete("checklist")}
          onToggleComplete={() => toggleSectionComplete("checklist")}
        >
          <p className="mb-4 text-sm text-white/50">
            Tap to toggle each item.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleChecklistItem(item.key)}
                className={`flex min-h-12 w-full items-center gap-3 border px-4 text-left text-sm font-bold transition ${data.deliveryChecklist[item.key]
                  ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                  }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${data.deliveryChecklist[item.key]
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-white/30 bg-transparent"
                    }`}
                >
                  {data.deliveryChecklist[item.key] ? "✓" : ""}
                </span>
                {item.label}
              </button>
            ))}
          </div>

          <hr className="my-4 border-white/10" />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                updateField(
                  "signedBuyerAgreement",
                  !data.signedBuyerAgreement,
                )
              }
              className={`flex min-h-12 items-center gap-3 border px-4 text-sm font-bold transition ${data.signedBuyerAgreement
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${data.signedBuyerAgreement
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/30 bg-transparent"
                  }`}
              >
                {data.signedBuyerAgreement ? "✓" : ""}
              </span>
              Signed Buyer&apos;s Agreement
            </button>
            <button
              type="button"
              onClick={() =>
                updateField(
                  "factoryInvBuyerGuide",
                  !data.factoryInvBuyerGuide,
                )
              }
              className={`flex min-h-12 items-center gap-3 border px-4 text-sm font-bold transition ${data.factoryInvBuyerGuide
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${data.factoryInvBuyerGuide
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/30 bg-transparent"
                  }`}
              >
                {data.factoryInvBuyerGuide ? "✓" : ""}
              </span>
              Factory Inv./Fed. Buyer&apos;s Guide
            </button>
            <button
              type="button"
              onClick={() =>
                updateField("deliveryEnabled", !data.deliveryEnabled)
              }
              className={`flex min-h-12 items-center gap-3 border px-4 text-sm font-bold transition ${data.deliveryEnabled
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-[var(--accent)]"
                }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${data.deliveryEnabled
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/30 bg-transparent"
                  }`}
              >
                {data.deliveryEnabled ? "✓" : ""}
              </span>
              Prepare for Sales Manager
            </button>
          </div>

          {/* First Service Visit Date */}
          <label className="mt-4 grid gap-2 border-t border-white/10 pt-4">
            <span className={LABEL}>First Service Visit Date</span>
            <input
              type="date"
              value={data.firstServiceVisitDate}
              onChange={(e) =>
                updateField("firstServiceVisitDate", e.target.value)
              }
              className={INPUT}
            />
          </label>

          {/* Specialty Plate */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-white/60">
              Does the customer have a specialty plate?
            </p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              Louisiana: Only specialty plates (Saints, LSU, Disabled Veteran,
              Handicap, etc.) can transfer between vehicles for $3. Standard
              plates are canceled — a new plate is issued ($40–$112).
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  updateField(
                    "specialtyPlate",
                    data.specialtyPlate === "yes" ? "" : "yes",
                  )
                }
                className={`inline-flex min-h-10 items-center justify-center border px-5 text-sm font-bold uppercase tracking-[0.08em] transition ${data.specialtyPlate === "yes"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/20 bg-white/10 text-white"
                  }`}
              >
                Yes — Specialty
              </button>
              <button
                type="button"
                onClick={() =>
                  updateField(
                    "specialtyPlate",
                    data.specialtyPlate === "no" ? "" : "no",
                  )
                }
                className={`inline-flex min-h-10 items-center justify-center border px-5 text-sm font-bold uppercase tracking-[0.08em] transition ${data.specialtyPlate === "no"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-white/20 bg-white/10 text-white"
                  }`}
              >
                No — Standard
              </button>
            </div>
            {data.specialtyPlate === "yes" && (
              <div className="mt-3 border-l-4 border-[var(--success)] bg-[var(--success)]/10 px-4 py-3">
                <p className="text-sm font-bold text-[var(--success)]">
                  Plate Transfer — $3 fee
                </p>
              </div>
            )}
            {data.specialtyPlate === "no" && (
              <div className="mt-3 border-l-4 border-[var(--warn)] bg-[var(--warn)]/10 px-4 py-3">
                <p className="text-sm font-bold text-[var(--warn)]">
                  New Plate Required — $40–$112
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* ── Bottom Action Bar ──────────────────────────────── */}
        <div className="border border-white/10 bg-[#2a2a2e] p-5 shadow-[0_0_30px_rgba(190,23,23,0.12),0_14px_40px_rgba(0,0,0,0.2)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handlePrintAll}
              className="flex min-h-14 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-6 text-base font-bold uppercase tracking-[0.08em] text-white transition hover:rounded-[16px] bg-[var(--accent)]/90 sm:col-span-2"
            >
              Print All Forms
            </button>
            <div className="flex flex-col gap-3">
              {dealId && (
                <button
                  type="button"
                  onClick={finishDealNow}
                  className="flex min-h-12 w-full items-center justify-center border border-[var(--success)] bg-[var(--success)]/20 px-4 text-sm font-bold uppercase tracking-[0.08em] text-[var(--success)] transition"
                >
                  Finish Deal
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={clearSessionNow}
                className="flex min-h-12 w-full items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
              >
                New Deal
              </button>
              <button
                type="button"
                onClick={saveNow}
                disabled={saving}
                className="flex min-h-12 w-full items-center justify-center border border-emerald-500 bg-emerald-500 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deal picker overlay ── */}
      {showDealPicker && openDeals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-white/10 bg-[#141414] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.28)]">
            <h3 className="text-lg font-bold text-white">
              You have open deals
            </h3>
            <p className="mt-1 text-sm text-white/60">
              Pick one to continue, or start fresh.
            </p>
            <div className="mt-4 grid gap-2">
              {openDeals.map((deal) => {
                const w = deal.workflow_data as unknown as WorkflowData;
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => pickDeal(deal)}
                    className="flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-[var(--accent)]"
                  >
                    <span className="font-bold text-white">
                      {w.customerName || "Unnamed"}
                    </span>
                    <span className="text-xs text-white/40">
                      {getLast8(w.vin) || "No VIN"}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setShowDealPicker(false);
                  setOpenDeals(null);
                }}
                className="mt-2 flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIN confirmation dialog ── */}
      {dialog}

      {/* ── VIN double-check dialog (print) ── */}
      {vinCheckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md border border-white/10 bg-[#141414] p-6 text-white shadow-[0_20px_44px_rgba(0,0,0,0.4)]">
            <h2 className="text-center text-lg font-bold uppercase tracking-[0.08em]">
              Please Double Check Your VIN Numbers
            </h2>

            <div className="mt-5 space-y-4">
              <div className="border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                  Vehicle Being Sold
                </p>
                <p className="mt-2 break-all text-xl font-extrabold tracking-[0.06em]">
                  {data.vin ? normalizeVin(data.vin) : "No VIN Entered"}
                </p>
              </div>

              {data.tradeVin && (
                <div className="border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                    Trade-In Vehicle
                  </p>
                  <p className="mt-2 break-all text-xl font-extrabold tracking-[0.06em]">
                    {normalizeVin(data.tradeVin)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={vinCheckCancel}
                className="min-h-12 border border-white/20 bg-white/10 font-bold uppercase tracking-[0.06em] text-white transition hover:bg-white/20"
              >
                No, I Need to Change
              </button>
              <button
                type="button"
                onClick={vinCheckConfirm}
                className="min-h-12 border border-[var(--accent)] bg-[var(--accent)] font-bold uppercase tracking-[0.06em] text-white transition hover:rounded-[16px] bg-[var(--accent)]/90"
              >
                Yes, It&apos;s Correct
              </button>
            </div>
            <button
              type="button"
              onClick={vinCheckConfirm}
              className="mt-2 w-full text-center text-xs font-bold uppercase tracking-[0.12em] text-white/30 transition hover:text-white/60"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </>
  );
}
