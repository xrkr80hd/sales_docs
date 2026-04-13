"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { BuyersGuideReverseSheet } from "@/components/documents/buyers-guide-reverse-sheet";
import { useVinConfirmation } from "@/components/ui/use-vin-confirmation";
import { getWorkflowReturnPath } from "@/components/workflow/workflow-screen";
import {
  loadConsultant,
  loadDealer,
  type ConsultantInfo,
  type DealerInfo,
} from "@/lib/dealer-consultant";
import {
  getLast8,
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

const PAGE_W = 816;

export function BuyersGuideReverseScreen() {
  const { confirmVinAction, dialog } = useVinConfirmation();
  const [workflow, setWorkflow] = useState<WorkflowData>(() => loadWorkflow());
  const [dealer] = useState<DealerInfo>(() => loadDealer());
  const [consultant] = useState<ConsultantInfo>(() => loadConsultant());
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageScale, setPageScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPageScale(w >= PAGE_W ? 1 : w / PAGE_W);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return subscribeToWorkflowSessionClear(() => {
      setWorkflow(loadWorkflow());
    });
  }, []);

  async function openPrintSurface() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const latest = loadWorkflow();
    if (!(await confirmVinAction(latest.vin, "printing"))) return;
    window.open("/print/buyers-guide/reverse?autoprint=1&vinchecked=1", "_blank");
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-[8.5in] flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)]">
          <Link
            href={getWorkflowReturnPath()}
            className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-white px-4 text-sm font-bold text-[var(--foreground)]"
          >
            Back to Deal Sheet
          </Link>
          <span className="text-sm font-bold text-[var(--foreground)]">
            Last 8: {getLast8(workflow.vin) || "-"}
          </span>
          <button
            type="button"
            onClick={openPrintSurface}
            className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-4 text-sm font-bold text-white"
          >
            Print Form
          </button>
        </div>

        <div ref={containerRef}>
          <div
            style={
              pageScale < 1
                ? { zoom: pageScale }
                : undefined
            }
          >
            <BuyersGuideReverseSheet workflow={workflow} dealer={dealer} consultant={consultant} />
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}
