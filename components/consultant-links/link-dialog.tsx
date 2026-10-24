"use client";
import {useEffect,useRef,useState} from "react";
import type {ConsultantLink} from "@/lib/consultant-links";
import styles from "./links.module.css";
export function LinkDialog({link,deleting=false,busy,error,onCancel,onSave,onDelete}:{link?:ConsultantLink;deleting?:boolean;busy:boolean;error:string;onCancel:()=>void;onSave:(link:ConsultantLink)=>Promise<void>;onDelete:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);const [name,setName]=useState(link?.name||""),[url,setUrl]=useState(link?.url||"");
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className={styles.dialog} aria-labelledby="link-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}><form onSubmit={event=>{event.preventDefault();if(!busy)void (deleting?onDelete():onSave({id:link?.id||crypto.randomUUID(),name,url}));}}>
  <h2 id="link-dialog-title">{deleting?"Delete link?":link?"Edit Link":"Add Link"}</h2>
  {deleting?<p>Remove “{link?.name}” from your Command Center?</p>:<><label>Link Name<input autoFocus required maxLength={60} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label><label>URL<input type="url" required maxLength={2048} placeholder="https://" value={url} onChange={event=>setUrl(event.target.value)} disabled={busy}/></label><p>Use an HTTP or HTTPS website address. Do not include passwords or customer information.</p></>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <div className={styles.actions}><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className={styles.primary} type="submit" disabled={busy}>{busy?"Saving…":deleting?"Delete Link":"Save Link"}</button></div>
 </form></dialog>;
}
