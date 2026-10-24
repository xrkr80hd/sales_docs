"use client";
import {useEffect} from "react";
import Link from "next/link";
import {ExternalLink} from "lucide-react";
import {useCommandCenter} from "./command-center-context";
import styles from "./links.module.css";
export function LinksWorkspace({selectedId}:{selectedId?:string}){
 const {collection,busy,error,load}=useCommandCenter();useEffect(()=>{void load();},[load]);
 const selected=collection?.links.find(link=>link.id===selectedId);
 return <div className={styles.workspace}><header className={styles.heading}><p>WALKER BROWSER</p><h1>{selected?.name||"Command Center"}</h1><span>Your saved business tools, inside your workspace.</span></header>
 {error&&<p className={styles.error} role="alert">{error}<button disabled={busy} onClick={()=>void load(true)}>Reload links</button></p>}
 {selected?<section className={styles.portal}><header><div><strong>{selected.name}</strong><small>{new URL(selected.url).hostname}</small></div><a href={selected.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Open in browser</a></header><p>Some websites require a separate browser tab for sign-in. If this panel stays blank, choose Open in browser.</p><iframe key={selected.url} src={selected.url} title={`${selected.name} portal`} loading="lazy" referrerPolicy="no-referrer" allow="clipboard-write"/></section>:!busy&&<section><p>{selectedId?"This shortcut is unavailable in your current collection.":"Choose a saved shortcut in the Command Center sidebar."}</p><Link prefetch={false} href="/consultant-links/settings" className={styles.settingsLink}>Manage your shortcuts</Link></section>}
 {busy&&!collection&&<p role="status">Loading your links…</p>}
 </div>;
}
