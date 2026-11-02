"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SpaceSheet } from "@/components/documents/space-sheet-sheet";
import {
  loadWorkflow,
  subscribeToWorkflowSessionClear,
  type WorkflowData,
} from "@/lib/walker-workflow";

const PAGE_W = 816;

export function SpaceSheetScreen() {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowData>(() => loadWorkflow());
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
    return subscribeToWorkflowSessionClear(() => setWorkflow(loadWorkflow()));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[8.5in]">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="text-sm font-bold uppercase tracking-[0.08em] text-white/60 transition hover:text-white">← Back</button>
        <h1 className="text-lg font-bold uppercase tracking-[0.14em] text-white">SPACED</h1>
      </div>
      <div ref={containerRef}>
        <div style={pageScale < 1 ? { zoom: pageScale } : undefined}>
          <SpaceSheet workflow={workflow} />
        </div>
      </div>
    </div>
  );
}
