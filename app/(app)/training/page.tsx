import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import styles from "@/components/command-center/workspace.module.css";
export default function TrainingPage() {
  return <div className="grid gap-6"><header><p className={styles.eyebrow}>CONSULTANT RESOURCES</p><h1 className={styles.pageTitle}>Training</h1><div className={styles.underline} /><p className={styles.subtitle}>Quick references for your next deal.</p></header><section className={styles.panel}><details open><summary className={styles.panelHeader}><h2><BookOpen />Cheat Sheet</h2></summary><p className={styles.muted}>Open your existing sales reference and payment tools.</p><Link href="/documents/cheat-sheet" className={`${styles.primary} mt-5`}>Open Cheat Sheet<ArrowRight size={18} /></Link></details></section></div>;
}
