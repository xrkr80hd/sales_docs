"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceIdentity } from "@/components/command-center/workspace-context";
import type { ConsultantLink } from "@/lib/consultant-links";
import type { NativeBrowserState } from "@/lib/walker-browser";
import styles from "./links.module.css";
export function NativeTool({ link }: { link: ConsultantLink }) {
 const identity=useWorkspaceIdentity();
 const promptInput=useRef<HTMLInputElement>(null);
 const root=useRef<HTMLDivElement>(null);
 const [state,setState]=useState<NativeBrowserState>({depth:1});
 useEffect(()=>{
  const bridge=window.walkerBrowser, element=root.current;
  if(!bridge||!element||!identity?.id)return;
  let active=true,frame=0;
  const unsubscribe=bridge.onState(value=>{if(active)setState(value);});
  const update=()=>{
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    const rect=element.getBoundingClientRect();
    const covered=Boolean(document.querySelector("header details[open],dialog[open],button[aria-label='Open navigation'][aria-expanded='true']"));
    void bridge.bounds({x:rect.x,y:rect.y,width:covered?0:rect.width,height:covered?0:rect.height}).catch(error=>{if(active)setState({depth:1,error:error.message});});
   });
  };
  void bridge.open(link.url,identity.id).then(update).catch(error=>{if(active)setState({depth:0,error:error.message});});
  const resize=new ResizeObserver(update);resize.observe(element);
  const overlays=new MutationObserver(update);overlays.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','aria-expanded']});
  window.addEventListener('resize',update);
  return()=>{active=false;cancelAnimationFrame(frame);unsubscribe();resize.disconnect();overlays.disconnect();window.removeEventListener('resize',update);void bridge.close().catch(()=>{});};
 },[link.url,identity?.id]);
 return <div className={styles.nativeTool}>
  {state.depth>1&&<button className={styles.popupReturn} type="button" onClick={()=>void window.walkerBrowser?.back()}>← Return to previous page</button>}
  {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}
  {state.dialog&&<div className={styles.containedDialog} role="dialog" aria-modal="true" aria-label="Website confirmation">
    <form onSubmit={event=>{event.preventDefault();void window.walkerBrowser?.answerDialog(state.dialog!.id,true,promptInput.current?.value||'');}}>
      <small>{state.dialog.origin}</small><p>{state.dialog.message}</p>
      {state.dialog.type==='prompt'&&<input ref={promptInput} autoFocus aria-label="Your response" defaultValue={state.dialog.defaultPrompt}/>}
      <div>{state.dialog.type!=='alert'&&<button type="button" onClick={()=>void window.walkerBrowser?.answerDialog(state.dialog!.id,false)}>Cancel</button>}<button type="submit">OK</button></div>
    </form>
  </div>}
  <div ref={root} className={styles.nativeSurface} aria-label={`${link.name} browser area`}/>
 </div>;
}
