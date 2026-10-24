"use client";
import {useEffect} from "react";
import Link from "next/link";
import {ExternalLink} from "lucide-react";
import {useCommandCenter} from "./command-center-context";
import styles from "./links.module.css";
export function LinksWorkspace({selectedId}:{selectedId?:string}){
 const {collection,busy,error,load}=useCommandCenter();useEffect(()=>{void load();},[load]);
 const selected=collection?.links.find(link=>link.id===selectedId);
 return <div className={selectedId ? styles.browserWorkspace : styles.workspace}>
 {error&&<p className={styles.error} role="alert">{error}<button disabled={busy} onClick={()=>void load(true)}>Reload links</button></p>}
 {selected?<section className={styles.portal} aria-label={selected.name}><a className={styles.externalFallback} href={selected.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${selected.name} in browser`} title="Open in browser if this website blocks embedded display or sign-in"><ExternalLink size={16}/></a><iframe key={selected.url} src={selected.url} title={`${selected.name} portal`} referrerPolicy="no-referrer" allow="clipboard-write"/></section>:!busy&&<section><p>{selectedId?"This shortcut is unavailable in your current collection.":"Choose a saved shortcut in the Command Center sidebar."}</p><Link prefetch={false} href="/consultant-links/settings" className={styles.settingsLink}>Manage your shortcuts</Link></section>}
 {busy&&!collection&&<p role="status">Loading your links…</p>}
 </div>;
}
