"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {Radar,ChevronDown} from "lucide-react";
import {useCommandCenter} from "./command-center-context";
const LinkRows=dynamic(()=>import("./link-rows").then(module=>module.LinkRows));
import styles from "./links.module.css";
export function ConsultantLinksNav({onNavigate}:{onNavigate:()=>void}){
 const pathname=usePathname();const [open,setOpen]=useState(pathname.startsWith("/consultant-links"));const {collection,busy,error,notice,load,save}=useCommandCenter();
 useEffect(()=>{if(open)void load();},[open,load]);
 return <details className={styles.commandNav} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary data-consultant-tour="command-center"><Radar size={20}/><span>Command Center</span><ChevronDown size={15}/></summary>{open&&<div className={styles.branches}>
  {collection&&<LinkRows compact links={collection.links} busy={busy} onNavigate={onNavigate} onReorder={links=>void save(links,true)}/>}
  {busy&&!collection&&<p role="status">Loading links…</p>}{collection?.links.length===0&&<p>No shortcuts yet.</p>}
  {error&&<p role="alert">{error}<button type="button" disabled={busy} onClick={()=>void load(true)}>Reload links</button></p>}
  {notice&&<span className={styles.srOnly} role="status">{notice}</span>}
  <Link prefetch={false} href="/consultant-links/settings" onClick={onNavigate} className={styles.settingsLink}>Command Center Settings</Link>
 </div>}</details>;
}
