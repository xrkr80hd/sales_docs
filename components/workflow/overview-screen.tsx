"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getFullStockNumber,
  getLast8,
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

const WORKFLOW_VIEW_STATE_KEY = "walker.workflow.view.v1";

function saveOverviewReturnPath() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_VIEW_STATE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    existing.returnPath = "/overview";
    window.sessionStorage.setItem(WORKFLOW_VIEW_STATE_KEY, JSON.stringify(existing));
  } catch {
    window.sessionStorage.setItem(
      WORKFLOW_VIEW_STATE_KEY,
      JSON.stringify({ returnPath: "/overview", openSections: {}, scrollY: 0 }),
    );
  }
}

function OverviewRow({
  label,
  value,
  href,
  onNavigate,
}: {
  label: string;
  value: string;
  href?: string;
  onNavigate?: () => void;
}) {
  const display = value || "-";
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          className="truncate text-sm font-semibold text-white underline decoration-white/20 underline-offset-2 transition hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
        >
          {display} <span className="text-[10px] text-white/30">&#x270E;</span>
        </Link>
      ) : (
        <span className="truncate text-sm font-semibold text-white">
          {display}
        </span>
      )}
    </div>
  );
}

export function OverviewScreen() {
  const [data, setData] = useState<WorkflowData>(loadWorkflow);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "walker.walkthrough.workflow.v1") {
        setData(loadWorkflow());
      }
    }
    window.addEventListener("storage", onStorage);
    const unsub = subscribeToWorkflowSessionClear(() => setData(loadWorkflow()));
    return () => {
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, []);

  function beforeNavigate() {
    saveOverviewReturnPath();
  }

  return (
    <section className="overflow-hidden border border-white/10 bg-[#1c1c1e] shadow-[0_0_40px_rgba(190,23,23,0.15),0_24px_60px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--accent)] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Deal Overview</h2>
          <p className="mt-1 text-lg font-semibold text-white/90 underline decoration-[var(--accent)] decoration-2 underline-offset-4">
            {data.customerName || "No customer yet"}{" "}
            {data.coCustomerName ? `& ${data.coCustomerName}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
            Deal #
          </span>
          <span className="text-3xl font-extrabold text-white">
            {data.dealNumber || "—"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="border-t border-white/10 bg-[#2a2a2e] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-x-6 sm:gap-y-3">
          <OverviewRow
            label="Vehicle"
            value={[data.vehicleYear, data.vehicleMake, data.vehicleModel]
              .filter(Boolean)
              .join(" ")}
            href="/documents/vin-verification"
            onNavigate={beforeNavigate}
          />
          {data.tradeIn === "yes" ? (
            <OverviewRow
              label="Trade-In"
              value={[data.tradeYear, data.tradeMake, data.tradeModel]
                .filter(Boolean)
                .join(" ")}
              href="/documents/payoff-form"
              onNavigate={beforeNavigate}
            />
          ) : null}
          <OverviewRow
            label="VIN (Last 8)"
            value={getLast8(data.vin)}
            href="/documents/vin-verification"
            onNavigate={beforeNavigate}
          />
          <OverviewRow
            label="Stock #"
            value={getFullStockNumber(data)}
            href="/documents/vin-verification"
            onNavigate={beforeNavigate}
          />
          <OverviewRow
            label="Deal #"
            value={data.dealNumber}
            href="/documents/delivery-checklist"
            onNavigate={beforeNavigate}
          />
          <OverviewRow
            label="Vehicle Miles"
            value={data.mileage}
            href="/documents/vin-verification"
            onNavigate={beforeNavigate}
          />
          {data.lienholderName ? (
            <OverviewRow
              label="Lienholder"
              value={data.lienholderName}
              href="/documents/payoff-form"
              onNavigate={beforeNavigate}
            />
          ) : null}
          <OverviewRow
            label="Payoff Verified"
            value={data.payoffVerified ? "Yes" : "No"}
            href="/documents/payoff-form"
            onNavigate={beforeNavigate}
          />
          <OverviewRow
            label="Deal is Ready"
            value={data.deliveryEnabled ? "Yes" : "No"}
            href="/documents/delivery-checklist"
            onNavigate={beforeNavigate}
          />
          <OverviewRow
            label="Plate"
            value={
              data.specialtyPlate === "yes"
                ? "Specialty — Transfer $3"
                : data.specialtyPlate === "no"
                  ? "Standard — New Plate"
                  : "Not checked"
            }
          />
        </div>

        {/* Navigation */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
          >
            Dashboard
          </Link>
          <Link
            href="/deal-sheet"
            className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
          >
            Used Vehicle
          </Link>
          <Link
            href="/deal-sheet/new"
            className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/10 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
          >
            New Vehicle
          </Link>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/40">
          Tap any field to edit it on its document screen. Changes save automatically.
        </p>
      </div>
    </section>
  );
}
