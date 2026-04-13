"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { BuyersGuideReverseSheet } from "@/components/documents/buyers-guide-reverse-sheet";
import { BuyersGuideSheet } from "@/components/documents/buyers-guide-sheet";
import { useVinConfirmation } from "@/components/ui/use-vin-confirmation";
import {
  loadConsultant,
  loadDealer,
  type ConsultantInfo,
  type DealerInfo,
} from "@/lib/dealer-consultant";

import {
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

export function BuyersGuidePrintScreen() {
  const { confirmVinAction, dialog } = useVinConfirmation();
  const searchParams = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowData>(() => loadWorkflow());
  const [dealer] = useState<DealerInfo>(() => loadDealer());
  const [consultant] = useState<ConsultantInfo>(() => loadConsultant());
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
    return subscribeToWorkflowSessionClear(() => setWorkflow(loadWorkflow()));
  }, []);

  useEffect(() => {
    if (printedRef.current || searchParams.get("autoprint") !== "1") return;
    printedRef.current = true;
    const vinChecked = searchParams.get("vinchecked") === "1";
    const timeout = window.setTimeout(async () => {
      const proceed = vinChecked ? true : await confirmVinAction(workflow.vin, "printing");
      if (!proceed) return;
      window.print();
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [searchParams, workflow, confirmVinAction]);

  async function handlePrint() {
    if (!(await confirmVinAction(workflow.vin, "printing"))) return;
    window.print();
  }

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[8.5in] flex-col px-4 py-4 print:min-h-0 print:px-0 print:py-0 sm:px-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)] print:hidden">
          <Link href="/documents/buyers-guide" className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-white px-4 text-sm font-bold text-[var(--foreground)]">
            Back to Document
          </Link>
          <button type="button" onClick={handlePrint} className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-4 text-sm font-bold text-white">
            Print Form
          </button>
        </div>
        <div ref={containerRef} className="overflow-x-auto sm:overflow-visible">
          <div ref={previewRef} className="print:[zoom:1]">
            <BuyersGuideSheet workflow={workflow} />
            <div className="mt-6" />
            <BuyersGuideReverseSheet workflow={workflow} dealer={dealer} consultant={consultant} />
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}
