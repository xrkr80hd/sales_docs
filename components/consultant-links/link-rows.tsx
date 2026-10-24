"use client";
import Link from "next/link";
import {useRef,useState,type PointerEvent} from "react";
import {GripVertical,ArrowUp,ArrowDown,Pencil,Trash2,MoreVertical,ExternalLink} from "lucide-react";
import {moveConsultantLink,type ConsultantLink} from "@/lib/consultant-links";
import styles from "./links.module.css";
export function LinkRows({links,busy,onReorder,onNavigate,onEdit,onDelete,compact=false}:{links:ConsultantLink[];busy:boolean;onReorder:(links:ConsultantLink[])=>void;onNavigate?:()=>void;onEdit?:(link:ConsultantLink)=>void;onDelete?:(link:ConsultantLink)=>void;compact?:boolean}){
 const root=useRef<HTMLUListElement>(null),drag=useRef<{id:string;x:number;y:number;target:string;moving:boolean}|null>(null);const [over,setOver]=useState("");
 const finish=(event:PointerEvent<HTMLButtonElement>,cancel=false)=>{const value=drag.current;drag.current=null;setOver("");if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(!cancel&&value?.moving&&value.target!==value.id)onReorder(moveConsultantLink(links,value.id,value.target));};
 return <ul ref={root} className={`${styles.rows} ${compact?styles.compact:""}`} aria-label={compact?"Command Center shortcuts":"Saved Command Center links"}>{links.map((link,index)=><li key={link.id} data-link-id={link.id} className={`${styles.row} ${over===link.id?styles.dropTarget:""}`}>
  <button type="button" className={styles.grip} aria-label={`Reorder ${link.name}`} title="Drag this handle, or use the Move Up and Move Down actions" disabled={busy} onPointerDown={event=>{if(event.button!==0||busy)return;drag.current={id:link.id,target:link.id,x:event.clientX,y:event.clientY,moving:false};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const value=drag.current;if(!value)return;if(Math.hypot(event.clientX-value.x,event.clientY-value.y)<6&&!value.moving)return;value.moving=true;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-link-id]");if(target&&root.current?.contains(target)){value.target=target.dataset.linkId||value.id;setOver(previous=>previous===value.target?previous:value.target);}}} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)}><GripVertical size={15}/></button>
  <Link prefetch={false} href={`/consultant-links/${encodeURIComponent(link.id)}`} onClick={onNavigate} className={styles.linkLabel} aria-label={link.name} title={`${link.name} — ${link.url}`}><span>{link.name}</span>{!compact&&<small>{new URL(link.url).hostname}</small>}</Link>
  <details className={styles.rowActions}><summary aria-label={`Actions for ${link.name}`} title="Link actions"><MoreVertical size={16}/></summary><div className={styles.actionMenu} onClick={event=>{if((event.target as HTMLElement).closest("button,a"))event.currentTarget.parentElement?.removeAttribute("open");}}>
   <button type="button" disabled={busy||index===0} aria-label={`Move Up ${link.name}`} onClick={()=>onReorder(moveConsultantLink(links,link.id,links[index-1].id))}><ArrowUp size={14}/>Move Up</button>
   <button type="button" disabled={busy||index===links.length-1} aria-label={`Move Down ${link.name}`} onClick={()=>onReorder(moveConsultantLink(links,link.id,links[index+1].id))}><ArrowDown size={14}/>Move Down</button>
   {onEdit&&<button type="button" disabled={busy} onClick={()=>onEdit(link)}><Pencil size={14}/>Edit</button>}
   {onDelete&&<button type="button" disabled={busy} onClick={()=>onDelete(link)}><Trash2 size={14}/>Delete</button>}
   <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Open in browser</a>
  </div></details>
 </li>)}</ul>;
}
