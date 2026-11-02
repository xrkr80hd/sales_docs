"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import {useWorkspaceIdentity} from "./workspace-context";
import {getLocalDealId,loadDealFromServer} from "@/lib/deals";
import {clearCustomerCopy,customerCopySnapshot,emptyCustomerCopySnapshot,subscribeCustomerCopy,type CopyField} from "@/lib/customer-copy";
import {subscribeToWorkflowSessionClear,clearWorkflowSession,loadWorkflow} from "@/lib/walker-workflow";
import {Copy,ContactRound,ChevronDown} from "lucide-react";
import styles from "./customer-copy.module.css";
export function CustomerCopyPanel(){
 const identity=useWorkspaceIdentity();const snapshot=useSyncExternalStore(subscribeCustomerCopy,customerCopySnapshot,emptyCustomerCopySnapshot);
 const [open,setOpen]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState("");
 useEffect(()=>{const id=getLocalDealId();if(customerCopySnapshot().dealId!==id)clearCustomerCopy(id);return subscribeToWorkflowSessionClear(()=>{clearWorkflowSession({broadcast:false});clearCustomerCopy();});},[identity?.id]);
 useEffect(()=>{if(!open)return;loadWorkflow();const id=getLocalDealId();if(!id||(snapshot.dealId&&snapshot.dealId!==id)||snapshot.data&&snapshot.dealId===id)return;let active=true;void loadDealFromServer(id,{copyOnly:true}).catch(()=>{if(active)setError("Saved customer information could not be loaded. Close and reopen to retry.");});return()=>{active=false;};},[open,snapshot.dealId,snapshot.data]);
 async function copy(field:CopyField){try{await navigator.clipboard.writeText(field.value);setCopied(field.label);setError("");}catch{setError("Copy was unavailable. Select the saved value and copy it manually.");}}
 useEffect(()=>{if(!open)return;const created=Number(window.sessionStorage.getItem("walker.workflow.created-at.v1"));if(!created)return;const timer=window.setTimeout(()=>{loadWorkflow();if(!getLocalDealId())clearCustomerCopy();},Math.max(0,created+24*60*60*1000-Date.now()));return()=>window.clearTimeout(timer);},[open,snapshot.dealId]);
 const group=(name:string,fields:CopyField[])=>fields.length>0&&<section><h3>{name}</h3>{fields.map(field=><div className={styles.field} key={field.label}><div><small>{field.label}</small><span>{field.value}</span></div><button type="button" aria-label={`Copy ${name} ${field.label}`} title={`Copy ${field.label}`} onClick={()=>void copy(field)}><Copy size={14}/></button></div>)}</section>;
 return <details className={styles.panel} open={open} onToggle={event=>{setOpen(event.currentTarget.open);setError("");setCopied("");}}><summary data-consultant-tour="customer" className={styles.summary}><ContactRound size={20}/><span className={styles.label}>Customer Information</span><ChevronDown className={styles.chevron} size={14} aria-hidden="true"/></summary>{open&&<div className={styles.content}>
  <p>Saved contact details only. Copy individual values into your separate dealership system.</p>
  {snapshot.data&&snapshot.dealId===getLocalDealId()?<>{group("Buyer",snapshot.data.buyer)}{group("Co-Buyer",snapshot.data.coBuyer)}{!snapshot.data.buyer.length&&!snapshot.data.coBuyer.length&&<p>No contact details saved for this deal yet.</p>}</>:<p>{getLocalDealId()?"Loading saved deal details…":"Open and save a deal to see its contact details."}</p>}
  {copied&&<p role="status">Copied {copied}.</p>}{error&&<p role="alert">{error}</p>}
 </div>}</details>;
}
