"use client";

import { useRouter } from "next/navigation";
import { CarFront, ChevronRight } from "lucide-react";
import { clearLocalDealId, consumeStartFreshDeal, markStartFreshDeal } from "@/lib/deals";
import { clearWorkflowSession } from "@/lib/walker-workflow";
import styles from "@/components/command-center/workspace.module.css";

export function DashboardScreen() {
  const router = useRouter();
  function startFreshDeal(dealType: "new" | "used") {
    clearWorkflowSession();
    clearLocalDealId();
    consumeStartFreshDeal();
    markStartFreshDeal(dealType);
    router.push(dealType === "new" ? "/deal-sheet/new" : "/deal-sheet");
  }
  return <section aria-label="Deal Commander">
    <div className={styles.hero} id="start-deal">
      <p className={styles.eyebrow}>Deal Commander</p>
      <h1 className={styles.pageTitle}>Start a Deal</h1>
      <div className={styles.underline} />
      <p className={styles.subtitle}>Choose a vehicle type to get started.</p>
    </div>
    <nav className={styles.vehicleActions} aria-label="Start a deal">
      <button type="button" onClick={() => startFreshDeal("new")} className={styles.vehicleButton}><CarFront /><span>New Vehicle</span><ChevronRight /></button>
      <button type="button" onClick={() => startFreshDeal("used")} className={styles.vehicleButton}><CarFront /><span>Used Vehicle</span><ChevronRight /></button>
    </nav>
  </section>;
}
