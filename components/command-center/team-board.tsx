"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, CarFront, CircleDollarSign, ExternalLink, Monitor, Target } from "lucide-react";
import { useWorkspaceIdentity } from "./workspace-context";
import styles from "./workspace.module.css";

// Deliberately no sample sales numbers. Shared objectives require an approved
// persistence path; this interface must never imply that a local draft is live.
export function ConsultantPace() {
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><h2><BarChart3 />My Pace This Month</h2></div>
    <div className={styles.stats}>{["Projection", "Sold", "Objective", "Pace"].map(label => <div key={label} className={styles.stat}><span>{label}</span><strong aria-label={`${label} not available`}>—</strong></div>)}</div>
    <details className={styles.boardControls}><summary>Monthly Sales Projection</summary><p className={styles.muted}>Your monthly projection and manager-assigned target will appear here when shared board saving is connected.</p></details>
  </section>;
}

export function ConsultantTeamBoard({ full = false }: { full?: boolean }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><h2>Today&apos;s Team Board</h2>{!full && <Link className={styles.textLink} href="/team-board">View Full Board</Link>}</div>
    <div className={styles.tableWrap}><table className={`${styles.table} ${styles.tableCompact}`}><thead><tr><th>Consultant</th><th>Sold</th><th>Objective</th><th>Pace</th></tr></thead><tbody><tr><td colSpan={4}>No published team objectives yet.</td></tr></tbody></table></div>
    <p className={`${styles.muted} mt-3`}>Manager updates will keep your weekly progress visible here.</p>
  </section>;
}

export function ManagerBoard({ office = false }: { office?: boolean }) {
  const identity = useWorkspaceIdentity();
  const manager = identity?.role === "admin" || identity?.role === "sales_manager" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  if (!identity) return <p className={styles.notice}>Checking manager access…</p>;
  if (!manager) return <section className={styles.panel}><h1 className={styles.pageTitle}>Manager access required</h1><p className={styles.muted}>Your consultant dashboard includes the team&apos;s unit objectives and your pace.</p><Link href="/dashboard" className={styles.textLink}>Return to dashboard</Link></section>;
  const kpis = [
    { label: "New Goal", icon: CarFront }, { label: "Used Goal", icon: CarFront },
    { label: "Monthly Gross Objective", icon: CircleDollarSign }, { label: "Yearly Gross Objective", icon: BarChart3 },
    { label: "Total Objective", icon: Target },
  ];
  return <section className={office ? styles.office : ""}>
    {!office && <div className={styles.boardHeading}><div><p className={styles.eyebrow}>Manager Tools</p><h1 className={styles.pageTitle}>Manager Board</h1><div className={styles.underline} /><p className={styles.subtitle}>Simple. Visible. Accountable.</p></div><a className={styles.primary} href="/office-display" target="nxtdocs-office-display" rel="noopener"><ExternalLink />Pop Out Display</a></div>}
    <p className={styles.notice}>Board interface preview · Shared objectives and weekly updates are not connected yet.</p>
    <div className={styles.kpis}>{kpis.map(({ label, icon: Icon }) => <div className={styles.kpi} key={label}><Icon /><div><span>{label}</span><strong aria-label={`${label} not set`}>—</strong></div></div>)}</div>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Consultant", "Projection", "MTD", "M", "T", "W", "TH", "F", "S", "Weekly Goal", "90-Day Avg", "Monthly Obj", "On Pace"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={13}>No published consultant objectives yet.</td></tr></tbody></table></div>
    <div className={styles.boardBottom}>
      <section className={styles.panel}><div className={styles.panelHeader}><h2><BarChart3 />Totals</h2></div><div className={styles.totals}>{["Total Objective", "Total MTD", "Total Projection"].map(label => <div className={styles.total} key={label}><span>{label}</span><strong>—</strong></div>)}</div></section>
      <section className={styles.panel} id="team-schedule"><div className={styles.panelHeader}><h2><CalendarDays />Days Off / Team Schedule</h2></div><p className={styles.muted}>No published team schedule yet.</p></section>
    </div>
    {!office && <details className={styles.boardControls}><summary>Objectives &amp; Weekly Updates</summary><p className={styles.muted}>The manager will set new and used unit targets, monthly and yearly gross objectives, and consultant goals here. Shared saving needs an approved storage path before editing can be enabled.</p></details>}
    {office && <p className={`${styles.muted} mt-4`}><Monitor size={16} className="inline mr-2" />This display opens independently of the manager tab. It still requires its own authorized session.</p>}
  </section>;
}
