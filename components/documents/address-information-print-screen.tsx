"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AddressInformationSheet } from "@/components/documents/address-information-sheet";
import {
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

export function AddressInformationPrintScreen() {
  const searchParams = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowData>(() => loadWorkflow());
  const printedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageScale, setPageScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPageScale(w >= 816 ? 1 : w / 816);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return subscribeToWorkflowSessionClear(() => setWorkflow(loadWorkflow()));
  }, []);

  useEffect(() => {
    if (printedRef.current || searchParams.get("autoprint") !== "1") return;
    printedRef.current = true;
    const timeout = window.setTimeout(() => {
      window.print();
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[8.5in] flex-col px-4 py-4 print:min-h-0 print:px-0 print:py-0 sm:px-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)] print:hidden">
          <Link href="/documents/address-information" className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-white px-4 text-sm font-bold text-[var(--foreground)]">
            Back to Document
          </Link>
          <button type="button" onClick={handlePrint} className="inline-flex min-h-10 items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-4 text-sm font-bold text-white">
            Print Form
          </button>
        </div>
        <div ref={containerRef}>
          <div style={pageScale < 1 ? { zoom: pageScale } : undefined} className="print:[zoom:1]">
            <AddressInformationSheet workflow={workflow} />
          </div>
        </div>
      </div>
    </>
  );
}
