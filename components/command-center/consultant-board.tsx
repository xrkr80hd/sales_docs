"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { NumberInput } from "@/components/ui/number-input";
import { BarChart3, LockKeyhole } from "lucide-react";
import { emptyRow, pace } from "@/lib/manager-board";
import { OrganizationBadge } from "./organization-badge";
import { useSharedBoard } from "./use-shared-board";
import styles from "./workspace.module.css";
const BoardContext = createContext<ReturnType<typeof useSharedBoard> | null>(null);
export function ConsultantBoardProvider({children}:{children:ReactNode}) {
 const board = useSharedBoard("", "consultant");
 return <BoardContext.Provider value={board}>{children}</BoardContext.Provider>;
}
function useConsultantBoard() {
 const board = useContext(BoardContext);
 if (!board) throw new Error("Consultant board requires its provider");
 return board;
}
export function ConsultantPace(){
 const {data,error,saving,save}=useConsultantBoard();const [projectionDraft,setProjection]=useState<string|null>(null);const [notice,setNotice]=useState("");
 const row=data?.board.rows[data.me]||emptyRow();const proposal=data?.proposals[data.me];const locked=Boolean(row.confirmedAt);
 const projection=locked?String(row.projection??""):projectionDraft??String(proposal?.value??"");
 const metrics=[{label:"Appts Goal / Mo",value:row.appointmentsGoal||0},{label:"Appts Set / Mo",value:row.appointmentsSet||0},{label:"Projection",value:row.projection??proposal?.value??"—"},{label:"Sold",value:row.mtd},{label:"Objective",value:row.objective||"—"},{label:"Pace",value:pace(row)===null?"—":`${pace(row)}%`}];
 return <section className={styles.panel}><div className={styles.panelHeader}><h2><BarChart3/>My Pace This Month</h2></div>{error&&<p className={styles.notice} role="alert">{error}</p>}
 <div className={styles.stats}>{metrics.map(metric=><div className={styles.stat} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
 <details className={styles.boardControls} open={!locked&&!proposal}><summary>Monthly Sales Projection{locked&&<LockKeyhole size={14} className="inline ml-2"/>}</summary><form className={styles.projectionForm} onSubmit={event=>{event.preventDefault();void save({action:"submit-projection",projection:Number(projection)}).then(ok=>{if(ok){setProjection(null);setNotice("Projection submitted for manager confirmation.");}});}}><label>Your projection for {data?.month||"this month"}<NumberInput aria-label="Monthly sales projection" type="number" required min={0} step={1} value={projection} disabled={locked||saving||!data} onChange={event=>setProjection(event.target.value)}/></label>{locked?<p className={styles.muted}>Confirmed and locked. Contact your manager to request a change.</p>:<><button type="submit" className={styles.primary} disabled={saving||!data}>{proposal?"Update projection":"Submit projection"}</button><p className={styles.muted}>You can revise this until your manager confirms it.</p></>}{notice&&<p role="status" className={styles.muted}>{notice}</p>}</form></details>
 {data?.board.weeklyUpdate&&<div className={styles.weeklyUpdate}><strong>Manager weekly update</strong><p>{data.board.weeklyUpdate}</p></div>}
 </section>;
}
export function ConsultantTeamBoard({full=false}:{full?:boolean}){
 const {data,error}=useConsultantBoard();return <section className={styles.panel}><div className={styles.panelHeader}><h2>Today&apos;s Team Board</h2>{!full&&<Link prefetch={false} className={styles.textLink} href="/team-board">View Full Board</Link>}</div>{data&&<p className={styles.muted}>{data.organization.name} · {data.month}</p>}{error&&<p className={styles.notice} role="alert">{error}</p>}<div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Consultant","Projected","Weekly Goal",...BOARD_DAYS,"Monthly Objective","90-Day Average","MTD","On Pace"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data?.roster.map(person=>{const row=data.board.rows[person.id]||emptyRow();return <tr key={person.id}><td><span className={styles.consultantName}><OrganizationBadge name={data.organization.name} iconUrl={data.organization.iconUrl} hidden={data.organization.hideIcon}/>{person.name}</span></td><td>{row.projection??data.proposals[person.id]?.value??"—"}</td><td>{row.weeklyGoal}</td>{BOARD_DAYS.map((day,index)=><td key={day}>{row.days[index]||0}</td>)}<td>{row.objective||"—"}</td><td>{row.avg90}</td><td>{row.mtd}</td><td>{pace(row)===null?"—":`${pace(row)}%`}</td></tr>;})}{data?.roster.length===0&&<tr><td colSpan={14}>No consultants assigned to this organization yet.</td></tr>}</tbody></table></div>{data?.board.weeklyUpdate&&<p className={`${styles.muted} mt-3`}>{data.board.weeklyUpdate}</p>}{data?.board.publishedAt&&<p className={`${styles.muted} mt-3`}>Updated {new Date(data.board.publishedAt).toLocaleString()}</p>}</section>;
}
const BOARD_DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
