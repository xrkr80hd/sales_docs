"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {Plus} from "lucide-react";
import type {ConsultantLink} from "@/lib/consultant-links";
import {useWorkspaceIdentity} from "@/components/command-center/workspace-context";
import {useCommandCenter} from "./command-center-context";
import {LinkRows} from "./link-rows";
import {LinkDialog} from "./link-dialog";
import styles from "./links.module.css";
export function LinksEditor(){const identity=useWorkspaceIdentity();return <Editor key={`${identity?.id}:${identity?.organizationId}`}/>;}
function Editor(){
 const {collection,busy,error,notice,load,save}=useCommandCenter();const [dialog,setDialog]=useState<{link?:ConsultantLink;deleting?:boolean}|null>(null);
 useEffect(()=>{void load();},[load]);
 const links=collection?.links||[];
 return <section className={styles.workspace}><header className={styles.heading}><p>COMMAND CENTER</p><h1>Command Center Settings</h1><span>Your shortcuts for {collection?.organization.name||"your organization"}. Saved only to your account.</span></header>
 <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||!collection||links.length>=20} onClick={()=>setDialog({})}><Plus size={16}/>Add Link</button><button type="button" disabled={busy} onClick={()=>void load(true)}>Reload links</button><Link prefetch={false} href="/consultant-links">Close settings</Link></div>
 {busy&&!collection&&<p role="status">Loading your links…</p>}{error&&!dialog&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {collection&&<LinkRows links={links} busy={busy} onReorder={next=>void save(next,true)} onEdit={link=>setDialog({link})} onDelete={link=>setDialog({link,deleting:true})}/>}
 {collection&&!links.length&&<p>No shortcuts saved. Choose Add Link to create your first one.</p>}
 <details className={styles.tutorial}><summary>How to use Command Center</summary><ol><li>Choose Add Link, enter its name and website address, then Save Link.</li><li>Open Command Center in the sidebar and select your saved shortcut.</li><li>Drag its handle to reorder. Link actions also offer Move Up and Move Down for keyboard use.</li><li>Use Edit or Delete here to manage links. If a website blocks the embedded view, choose Open in browser.</li></ol><p>Links are kept separately for your account and organization. Changing organizations keeps your previous collection for when you return.</p></details>
 {dialog&&<LinkDialog link={dialog.link} deleting={dialog.deleting} busy={busy} error={error} onCancel={()=>setDialog(null)} onSave={async link=>{const next=dialog.link?links.map(item=>item.id===link.id?link:item):[...links,link];if(await save(next))setDialog(null);}} onDelete={async()=>{if(await save(links.filter(item=>item.id!==dialog.link?.id)))setDialog(null);}}/>}
 </section>;
}
