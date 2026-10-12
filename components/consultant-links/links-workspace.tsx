"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ExternalLink,Link2,ArrowRight } from "lucide-react";
import type { ConsultantLink } from "@/lib/consultant-links";
import { requestLinks } from "./link-data";
import styles from "./links.module.css";
export function LinksWorkspace({selectedId}:{selectedId?:string}) {
  const [links,setLinks]=useState<ConsultantLink[]>([]);const [organization,setOrganization]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;void requestLinks().then(result=>{if(active){setLinks(result.links);setOrganization(result.organization.name);}}).catch(failure=>{if(active)setError(failure.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const selected=links.find(link=>link.id===selectedId);
  return <div className={styles.workspace}><header className={styles.heading}><p>{organization||"DEALERSHIP TOOLS"}</p><h1>{selected?.name||"Consultant Links"}</h1><span>Your portals, together in your workspace.</span></header>
    <nav className={styles.tabs} aria-label="Consultant links">{links.map(link=><Link key={link.id} href={`/consultant-links/${link.id}`} aria-current={selected?.id===link.id?"page":undefined}>{link.name}</Link>)}</nav>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {selected?<section className={styles.portal}><header><div><strong>{selected.name}</strong><small>{new URL(selected.url).hostname}</small></div><a href={selected.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Open in new tab</a></header><p>Some portals require a separate tab for secure sign-in. If the panel stays blank, use “Open in new tab.”</p><iframe key={selected.url} src={selected.url} title={`${selected.name} portal`} referrerPolicy="no-referrer" allow="clipboard-write" /></section>:<section className={styles.linkCards}>{links.map(link=><Link className={styles.linkCard} key={link.id} href={`/consultant-links/${link.id}`}><Link2/><strong>{link.name}</strong><small>{new URL(link.url).hostname}</small><ArrowRight/></Link>)}{!loading&&links.length===0&&<p>Open Consultant Setup to add your dealership links.</p>}{selectedId&&!loading&&!selected&&links.length>0&&<p>That link is no longer available. Choose a portal above.</p>}</section>}
    {loading&&<p>Loading your links…</p>}
  </div>;
}
