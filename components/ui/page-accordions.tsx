"use client";
import {useEffect,useRef,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {useWorkspaceIdentity} from "@/components/command-center/workspace-context";
import {readPageAccordions,writePageAccordions} from "@/lib/page-accordion-state";
export function PageAccordions({children}:{children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const path=usePathname();const identity=useWorkspaceIdentity();const userId=identity?.id;
 useEffect(()=>{
  const root=ref.current;if(!root||!userId)return;
  const key=`${userId}:${path}:${window.location.search}`;const state=readPageAccordions(key);const seen=new WeakMap<HTMLDetailsElement,string>();
  const restore=(node:Element)=>{
   const details=[...(node.matches("details")?[node as HTMLDetailsElement]:[]),...node.querySelectorAll<HTMLDetailsElement>("details")];
   for(const item of details){if(seen.has(item)||item.closest("dialog"))continue;const name=item.id||item.querySelector(":scope > summary")?.textContent?.trim()||String(seen);seen.set(item,name);item.open=state[name]===true;}
  };
  restore(root);
  const reset=()=>{for(const name of Object.keys(state))delete state[name];writePageAccordions(key,state);for(const item of root.querySelectorAll<HTMLDetailsElement>("details"))item.open=false;};
  window.addEventListener("page-accordions-reset",reset);
  const toggle=(event:Event)=>{const item=event.target as HTMLDetailsElement;const name=seen.get(item);if(name){state[name]=item.open;writePageAccordions(key,state);}};
  root.addEventListener("toggle",toggle,true);
  const observer=new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node instanceof Element)restore(node);});observer.observe(root,{childList:true,subtree:true});
  return()=>{root.removeEventListener("toggle",toggle,true);observer.disconnect();window.removeEventListener("page-accordions-reset",reset);};
 },[userId,path]);
 return <div ref={ref} style={{display:"contents"}}>{children}</div>;
}
