"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AddressInformationSheet } from "@/components/documents/address-information-sheet";
import { DeliveryChecklistSheet } from "@/components/documents/delivery-checklist-sheet";
import { PayoffFormSheet } from "@/components/documents/payoff-form-sheet";
import { SpaceSheet } from "@/components/documents/space-sheet-sheet";
import { VinVerificationSheet } from "@/components/documents/vin-verification-sheet";
import {
  loadConsultant,
  type ConsultantInfo,
} from "@/lib/dealer-consultant";

import {
  createDefaultWorkflowData,
  loadDeliveryChecklistNotes,
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type DeliveryChecklistNotes,
  type WorkflowData,
} from "@/lib/walker-workflow";

export function AllNewPrintScreen() {
  const searchParams = useSearchParams();
  const isBlank = searchParams.get("blank") === "1";
  const [workflow, setWorkflow] = useState<WorkflowData>(() => isBlank ? createDefaultWorkflowData() : loadWorkflow());
  const [consultant] = useState<ConsultantInfo>(() => loadConsultant());
  const [notes, setNotes] = useState<DeliveryChecklistNotes>(() =>
    loadDeliveryChecklistNotes(),
  );
  const printedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pageScale, setPageScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPageScale(w >= 816 || w < 640 ? 1 : w / 816);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.style.zoom = pageScale < 1 ? String(pageScale) : "1";
  }, [pageScale]);

  useEffect(() => {
    return subscribeToWorkflowSessionClear(() => {
      setWorkflow(loadWorkflow());
      setNotes(loadDeliveryChecklistNotes());
    });
  }, []);

  useEffect(() => {
    if (printedRef.current || searchParams.get("autoprint") !== "1") return;
    printedRef.current = true;
    const timeout = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  function handleAction() {
    window.print();
  }

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[8.5in] flex-col px-4 py-4 print:min-h-0 print:px-0 print:py-0 sm:px-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)] print:hidden">
          <Link
            href="/deal-sheet/new"
            className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-white px-4 text-sm font-bold text-[var(--foreground)]"
          >
            Back to Deal Sheet
          </Link>
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-4 text-sm font-bold text-white"
          >
            {"Print All Forms"}
          </button>
        </div>

        <div ref={containerRef} className="overflow-x-auto sm:overflow-visible">
          <div ref={previewRef} className="print:[zoom:1]">
            <DeliveryChecklistSheet
              workflow={workflow}
              consultant={consultant}
              notes={notes}
              onNoteChange={() => { }}
            />
            <div className="mt-6" />
            <SpaceSheet workflow={workflow} />
            <div className="mt-6" />
            <PayoffFormSheet workflow={workflow} />
            <div className="mt-6" />
            <AddressInformationSheet workflow={workflow} />
            <div className="mt-6" />
            <VinVerificationSheet workflow={workflow} consultant={consultant} />
          </div>
        </div>
      </div>
    </>
  );
}
