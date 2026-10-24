"use client";

import Link from "next/link";
import {ExternalLink} from "lucide-react";
import {emptyRow} from "@/lib/manager-board";
import {attainment, displayPace, performanceSummary} from "@/lib/performance-display";
import {OrganizationBadge} from "./organization-badge";
import {useSharedBoard} from "./use-shared-board";
import styles from "./performance-display.module.css";

const currency=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1});
const fullCurrency=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
const number=new Intl.NumberFormat("en-US");

export function PerformanceDisplay({organization="",month="",standalone=false}:{organization?:string;month?:string;standalone?:boolean}) {
  const {data,error,reload}=useSharedBoard(organization,"display",month);
  if(!data)return <section className={styles.status} role={error?"alert":"status"}>{error||"Loading performance…"}{error&&<button onClick={()=>void reload()}>Retry display</button>}</section>;
  if(!data.canViewStats)return <p className={styles.status}>Manager statistics access required.</p>;
  const query=new URLSearchParams({organization:data.organization.id,month:data.month});
  const target=`/office-display?${query}`;
  const people=data.roster;
  const totals=people.reduce((sum,person)=>{
    const row=data.board.rows[person.id]||emptyRow();
    return {projection:sum.projection+(row.projection??data.proposals[person.id]?.value??0),weeklyGoal:sum.weeklyGoal+row.weeklyGoal,objective:sum.objective+row.objective,avg90:sum.avg90+row.avg90,mtd:sum.mtd+row.mtd};
  },{projection:0,weeklyGoal:0,objective:0,avg90:0,mtd:0});
  function popOut(){
    // noopener prevents dependence on (or access to) the originating app window.
    // Keep a regular link visible: noopener windows may return null even on success.
    window.open(target,"_blank","popup=yes,noopener,noreferrer,width=1040,height=640");
  }
  return <section className={`${styles.display} ${standalone?styles.standalone:""}`} aria-label="Performance Display">
    <header className={styles.heading}>
      <div className={styles.identity}><OrganizationBadge name={data.organization.name} iconUrl={data.organization.iconUrl} hidden={data.organization.hideIcon}/><div><p>{data.organization.name} · {data.month}</p><h1>Performance Display</h1></div></div>
      <div className={styles.actions}>
        {!standalone&&<><Link prefetch={false} href={`/manager-board?${query}`}>Setup</Link><button onClick={popOut}><ExternalLink size={15}/>Pop Out Display</button><a href={target} target="_blank" rel="noopener noreferrer">Open in new tab</a></>}
        {standalone&&<Link prefetch={false} href={`/manager-board/display?${query}`}>Return to Manager Board</Link>}
      </div>
    </header>
    {error&&<p className={styles.error} role="alert">Showing previously loaded data. {error} <button onClick={()=>void reload()}>Retry</button></p>}
    <div className={styles.summary}>
      {performanceSummary(data.board,data.roster).map(group=><section className={styles.group} key={group.label} aria-label={`${group.label} monthly performance`}>
        <h2>{group.label}</h2>
        <dl><div><dt>Goal</dt><dd>{number.format(group.goal)}</dd></div><div><dt>Sold</dt><dd>{number.format(group.sold)}</dd></div><div><dt>Gross goal</dt><dd title={fullCurrency.format(group.grossGoal)}>{currency.format(group.grossGoal)}</dd></div><div><dt>Gross actual</dt><dd title={fullCurrency.format(group.grossActual)}>{currency.format(group.grossActual)}</dd></div></dl>
        <p><strong>{attainment(group.sold,group.goal)}</strong> of unit objective</p>
      </section>)}
    </div>
    <div className={styles.tableArea}>
      <table className={styles.table}>
        <caption className={styles.caption}>Consultant performance · {data.month}</caption>
        <colgroup><col className={styles.nameColumn}/>{Array.from({length:6},(_,i)=><col key={i}/>)}</colgroup>
        <thead><tr><th scope="col">Consultant</th><th scope="col">Projected</th><th scope="col">Weekly<br/>Goal</th><th scope="col">Monthly<br/>Objective</th><th scope="col">90-Day<br/>Average</th><th scope="col">Month-to-<br/>Date</th><th scope="col">On<br/>Pace</th></tr></thead>
        <tbody>{people.map(person=>{const row=data.board.rows[person.id]||emptyRow(),onPace=displayPace(row);return <tr key={person.id}>
          <th scope="row" title={person.name}>{person.name}</th>
          <td>{row.projection===undefined&&data.proposals[person.id]?.value===undefined?"—":number.format(row.projection??data.proposals[person.id]?.value??0)}</td>
          <td>{number.format(row.weeklyGoal)}</td><td>{number.format(row.objective)}</td><td>{number.format(row.avg90)}</td><td>{number.format(row.mtd)}</td><td>{onPace===null?"N/A":`${onPace}%`}</td>
        </tr>;})}{!people.length&&<tr><td colSpan={7}>No consultants assigned to this organization.</td></tr>}</tbody>
        <tfoot><tr><th scope="row">Totals · {people.length} consultants</th><td>{number.format(totals.projection)}</td><td>{number.format(totals.weeklyGoal)}</td><td>{number.format(totals.objective)}</td><td>{number.format(totals.avg90)}</td><td>{number.format(totals.mtd)}</td><td>{attainment(totals.mtd,totals.objective)}</td></tr></tfoot>
      </table>
    </div>
    <footer className={styles.footer}><span>{data.version?`Saved ${new Date(data.version).toLocaleString()}`:"No objectives published yet"} · Read only · Live updates</span></footer>
  </section>;
}
