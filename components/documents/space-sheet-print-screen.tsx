"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SpaceSheet } from "@/components/documents/space-sheet-sheet";
import {
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

export function SpaceSheetPrintScreen() {
  const searchParams = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowData>(() => loadWorkflow());
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#2a2a2e] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)] print:hidden">
          <Link href="/documents/spaced" className="inline-flex min-h-10 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20">
            Back to SPACED
          </Link>
          <button type="button" onClick={handlePrint} className="inline-flex min-h-10 items-center justify-center border border-white/20 rounded-[16px] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]">
            Print Form
          </button>
        </div>
        <div ref={containerRef} className="overflow-x-auto sm:overflow-visible">
          <div ref={previewRef} className="print:[zoom:1]">
            <SpaceSheet workflow={workflow} />
          </div>
        </div>
      </div>
    </>
  );
}
