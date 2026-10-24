"use client";

import {useEffect, useRef, useState} from "react";
import styles from "./consultant-tour.module.css";

const steps = [
  {target:"commander", title:"Sales Commander", text:"Plan your daily calls, conversations, appointments, and sales. Save your changes when you leave."},
  {target:"setup", title:"Consultant Set Up", text:"Save your consultant details here so your paperwork can fill them in for you."},
  {target:"command-center", title:"Command Center", text:"Open your saved business websites here. Use Command Center Settings to add or change shortcuts."},
  {target:"start-deal", title:"Start a Deal", text:"Choose New or Used, then enter the customer and vehicle details once to fill your forms."},
  {target:"resume-deal", title:"Resume Deal", text:"Find a saved deal and continue where you left off."},
  {target:"customer", title:"Customer Information", text:"Copy saved customer contact details into your dealership system without retyping them."},
  {target:"tools", title:"Consultant Tools", text:"Build your business card, create a vehicle collage, or see how the sales targets are calculated."},
  {target:"messenger", title:"Messenger", text:"Message coworkers and open the team conversations available to you."},
];

export function ConsultantTour({onClose}:{onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index,setIndex] = useState(0);
  const [bounds,setBounds] = useState<{left:number;top:number;width:number;height:number;cardAtTop:boolean}|null>(null);
  const step = steps[index];
  useEffect(()=>{
    const element=dialog.current;
    element?.showModal();
    return()=>element?.close();
  },[]);
  useEffect(()=>{
    const target=document.querySelector<HTMLElement>(`[data-consultant-tour="${step.target}"]`);
    if(!target)return;
    target.scrollIntoView({block:"center",behavior:"instant"});
    let frame=0;
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const rect=target.getBoundingClientRect();
      setBounds({left:Math.max(4,rect.left),top:Math.max(4,rect.top),width:Math.min(rect.width,innerWidth-8),height:rect.height,cardAtTop:rect.top+rect.height/2>innerHeight/2});
    });};
    measure();
    window.addEventListener("resize",measure);
    window.addEventListener("scroll",measure,true);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",measure);window.removeEventListener("scroll",measure,true);};
  },[step]);
  return <dialog ref={dialog} className={styles.dialog} aria-label="Consultant quick tour" onCancel={event=>{event.preventDefault();onClose();}}>
    {bounds&&<div aria-hidden="true" className={styles.spotlight} style={{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}}/>}
    <section className={`${styles.card} ${bounds?.cardAtTop?styles.top:styles.bottom}`}>
      <div className={styles.progress}><span>{index+1} of {steps.length}</span><button type="button" onClick={onClose}>Skip tour</button></div>
      <div aria-live="polite" aria-atomic="true"><h2>{step.title}</h2><p>{step.text}</p></div>
      <div className={styles.actions}><button type="button" disabled={index===0} onClick={()=>setIndex(value=>value-1)}>Back</button><button type="button" autoFocus className={styles.next} onClick={()=>index===steps.length-1?onClose():setIndex(value=>value+1)}>{index===steps.length-1?"Done":"Next"}</button></div>
    </section>
  </dialog>;
}
