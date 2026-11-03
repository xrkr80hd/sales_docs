"use client";
import { useSyncExternalStore } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { readSalesTargets, subscribeSalesTargets } from "@/lib/sales-target-reminder";
import styles from "./workspace.module.css";
const unavailable = () => null;
const labels = [["calls", "Calls"], ["talks", "Convos"], ["appts", "Appts"], ["sold", "Sales"]] as const;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export function SalesTargetReminder() {
  const { accessToken } = useSession();
  const targets = useSyncExternalStore(subscribeSalesTargets, () => readSalesTargets(accessToken || ""), unavailable);
  if (!targets) return null;
  return <div className={styles.targetReminder}>
    <dl className={styles.targetNumbers} aria-label="Daily activity targets">
      {labels.map(([key, label]) => <div key={key} title={`${label}: ${targets[key]} daily target`}><dt>{label}</dt><dd>{compact.format(targets[key])}</dd></div>)}
    </dl>
  </div>;
}
