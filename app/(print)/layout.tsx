import type { ReactNode } from "react";

import { DisclosureGate } from "@/components/auth/disclosure-gate";
import { SupabaseSessionGate } from "@/components/auth/supabase-session-gate";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <SupabaseSessionGate surface="print">
      <DisclosureGate><div className="nxt-print-preview">{children}</div></DisclosureGate>
    </SupabaseSessionGate>
  );
}
