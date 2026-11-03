"use client";

import {useEffect, useRef, useState} from "react";
import styles from "./consultant-tour.module.css";

// Walks the left menu top to bottom. Plain words: what it is, what to do there.
const steps = [
  {target:"home", title:"Welcome to NXTDOX", text:"NXTDOX is an optional helper that fills in dealership paperwork for you. You type the deal once and it fills every form. It is not a credit application: it never runs credit or sends anything to lenders. Home shows your why, your photos and your month at a glance."},
  {target:"planner", title:"Daily Planner", text:"Your day in one place: tap the counters as you make calls, set appointments and sell, check off your routine, and write tomorrow's to-dos. Press Save any time; your manager sees what you save."},
  {target:"setup", title:"Consultant Set Up", text:"Do this first. Add your name, phone and salesperson number so your paperwork fills them in, then write Your Why and add photos for your Home page."},
  {target:"command-center", title:"Command Center", text:"Your work tools in one tab: Sales Commander at the top, then your saved websites like DriveCentric. Add or reorder websites in Command Center Settings."},
  {target:"commander", fallback:"command-center", title:"Sales Commander", text:"Set your monthly goal and ratios, build your daily routine, and set seasonal hours. It turns your goal into the calls and appointments you need each day. Press Save when you change something."},
  {target:"start-deal", fallback:"deal-folder", title:"Deal Folder", text:"Start a Deal: choose New or Used, enter the customer, vehicle and trade once, and review the filled forms before you print. Resume Deal picks up a saved deal. Documents has the blank forms."},
  {target:"customer", title:"Customer Information", text:"Copy a saved customer's contact details into your dealership system without retyping them."},
  {target:"tools", title:"Consultant Tools", text:"Build your public business card, make a vehicle collage for social media, and see the sales numbers behind your targets."},
  {target:"messenger", title:"Messenger", text:"Message your team and open the channels your organization allows. Keep customer paperwork and sensitive information out of messages."},
  {target:"ticket", title:"Submit a Ticket", text:"Something not working, a question, or an idea? Send a ticket from anywhere in the app. It goes straight to the NXTDOX admin, and you'll see the reply on your ticket."},
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
    const visible=(name?:string)=>{const el=name?document.querySelector<HTMLElement>(`[data-consultant-tour="${name}"]`):null;return el&&el.getClientRects().length>0?el:null;};
    const target=visible(step.target)||visible("fallback" in step?step.fallback:undefined);
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
