"use client";
import { useWorkspaceIdentity } from "./workspace-context";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { notifySave } from "@/components/ui/save-toast-host";
import { NumberInput } from "@/components/ui/number-input";
import {useRouter} from "next/navigation";
import {installWorkspaceExitGuard,requestWorkspaceExit} from "@/lib/workspace-exit";
import {cachedResource,loadResource,primeResource} from "@/lib/client-resource-cache";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {RoutinePlanner} from "@/components/command-center/routine-planner";
import {useSession} from "@/components/auth/supabase-session-gate";
import { defaults, blank, round, number, normalize, projection, type State, type Counts } from "@/lib/sales-commander-model";
import { publishSalesTargets } from "@/lib/sales-target-reminder";
import {requestJson,withDeadline} from "@/lib/request-json";

const style={panel:{background:"#121a25",border:"1px solid #344152",padding:16,borderRadius:9},input:{background:"#09111c",color:"#fff",border:"1px solid #526072",padding:10,borderRadius:5,width:"100%"},button:{background:"#ac2028",color:"#fff",border:"none",padding:"9px 12px",borderRadius:5,cursor:"pointer"}} as const;
const keys=["calls","talks","appts","shows","sold"] as const;
const names:{[K in keyof Counts]:string}={calls:"Calls made",talks:"Real conversations",appts:"Appointments set",shows:"Appointments shown",sold:"Vehicles sold"};
export function SaleCommander(){
 const router=useRouter();
 const baseline=useRef(""),leave=useRef<{promise:Promise<boolean>;resolve:(allowed:boolean)=>void}|null>(null),dialog=useRef<HTMLDialogElement>(null);
 const [leaving,setLeaving]=useState(false);
 const {accessToken}=useSession();const identity=useWorkspaceIdentity();const accountId=identity?.id;const tokenRef=useRef(accessToken);tokenRef.current=accessToken;const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<State>(defaults);const latest=useRef<State>(defaults);const [assignedGoal,setAssignedGoal]=useState<number|null>(()=>cachedResource<number|null>(accessToken||"","sales-commander-assigned-goal")??null);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [win,setWin]=useState("");
 const day=new Date().toLocaleDateString("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"});
 const [month,setMonth]=useState(()=>new Date().toLocaleDateString("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit"}).slice(0,7));
 const request=useCallback(async(method:"GET"|"PUT",body?:State)=>{
  let token=tokenRef.current;
  if(method==="PUT"){
   const {data,error}=await withDeadline(getSupabaseBrowserClient().auth.getSession(),"Your connection is taking too long. Your changes are still here.",5000);
   if(error||!data.session||data.session.user.id!==accountId)throw Error("Your session ended. Keep this page open and sign in again before saving.");
   token=data.session.access_token;
  }
  if(!token)throw Error("Sign in to use Sales Commander.");
  const value=await requestJson<{commander:unknown;assignedGoal?:number}>("/api/me/sale-commander",{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(!value.commander||typeof value.commander!=="object"||Array.isArray(value.commander))throw Error("Save could not be confirmed. Your changes are still here.");
  if(method==="GET"){const goal=typeof value.assignedGoal==="number"?value.assignedGoal:null;setAssignedGoal(goal);primeResource(token,"sales-commander-assigned-goal",goal);}
  const saved=normalize(value.commander);publishSalesTargets(token,saved);return saved;
 },[accountId]);
 useEffect(()=>{let alive=true;const token=tokenRef.current;setReady(false);setNotice("");loadResource(token||"","sales-commander",()=>request("GET"),300000).then(v=>{if(alive){baseline.current=JSON.stringify(v);latest.current=v;setState(v);publishSalesTargets(token||"",v);setReady(true);}}).catch(e=>{if(alive)setNotice(e.message);});return()=>{alive=false;};},[request,attempt]);


 const proj=useMemo(()=>projection(state),[state]);const today=state.days[day]||blank();
 const monthTotals=useMemo(()=>Object.entries(state.days).filter(([date])=>date.startsWith(month)).reduce((out,[,v])=>{for(const k of keys)out[k]+=v[k]||0;return out;},blank()),[state.days,month]);
 const dirty=ready&&JSON.stringify(state)!==baseline.current;
 const change=(fn:(s:State)=>State)=>{if(!ready||busy)return;const next=fn(latest.current);latest.current=next;setState(next);publishSalesTargets(accessToken||"",next);};
 useEffect(()=>{
  if(!dirty)return;
  const ask=()=>{if(leave.current)return leave.current.promise;let resolve!:(value:boolean)=>void;const promise=new Promise<boolean>(done=>{resolve=done;});leave.current={promise,resolve};setLeaving(true);return promise;};
  const cleanup=installWorkspaceExitGuard(ask);
  const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  const click=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
   const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;
   event.preventDefault();event.stopImmediatePropagation();
   void requestWorkspaceExit().then(allowed=>{if(allowed){document.querySelector<HTMLButtonElement>('aside button[aria-label="Close navigation"]')?.click();router.push(url.pathname+url.search+url.hash);}});
  };
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);
  return()=>{cleanup();document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);};
 },[dirty,router]);
 useEffect(()=>{if(leaving)dialog.current?.showModal();else dialog.current?.close();},[leaving]);
 useEffect(()=>()=>{leave.current?.resolve(false);leave.current=null;},[]);
 function finishLeave(allowed:boolean){dialog.current?.close();setLeaving(false);leave.current?.resolve(allowed);leave.current=null;}
 async function saveAndExit(){
  if(busy)return;setBusy(true);setNotice("");
  try{const saved=await request("PUT",latest.current);baseline.current=JSON.stringify(saved);latest.current=saved;setState(saved);primeResource(accessToken||"","sales-commander",saved);primeResource(accessToken||"","sales-commander-assigned-goal",assignedGoal);notifySave("success","Saved");finishLeave(true);}
  catch(error){setNotice(error instanceof Error?error.message:"Could not save. Your changes are still here.");}
  finally{setBusy(false);}
 }
 function discardAndExit(){const saved=normalize(JSON.parse(baseline.current));latest.current=saved;setState(saved);publishSalesTargets(accessToken||"",saved);primeResource(accessToken||"","sales-commander-assigned-goal",assignedGoal);notifySave("success","Saved");finishLeave(true);}
 const tile=(key:keyof Counts,target:number)=><div key={key} style={style.panel}><small style={{color:"#aebdcd"}}>{names[key]}</small><h2 style={{margin:"8px 0"}}>{today[key]} <small style={{fontSize:13,color:"#9caabd"}}>/ {target} today</small></h2><div style={{display:"flex",gap:8}}><button type="button" disabled={!ready} style={style.button} onClick={()=>change(s=>({...s,days:{...s.days,[day]:{...(s.days[day]||blank()),[key]:Math.max(0,(s.days[day]?.[key]||0)-1)}}}))}>−</button><button type="button" disabled={busy} style={style.button} onClick={()=>change(s=>({...s,days:{...s.days,[day]:{...(s.days[day]||blank()),[key]:(s.days[day]?.[key]||0)+1}}}))}>+</button></div></div>;
 return <div style={{maxWidth:980,margin:"auto",padding:"16px 14px 90px",color:"#f4f7fa"}}>
  <dialog ref={dialog} onCancel={event=>{event.preventDefault();if(!busy)finishLeave(false);}} style={{margin:"auto",width:"min(420px,calc(100vw - 32px))",padding:22,background:"#121a25",color:"#f4f7fa",border:"1px solid #526072",borderRadius:8}} aria-labelledby="sales-leave-title">
    <h2 id="sales-leave-title">Unsaved Sales Commander changes</h2><p style={{margin:"12px 0"}}>Your changes are going to be lost. Are you sure you want to exit?</p>
    {notice&&<p role="alert">{notice}</p>}<div className="sales-leave-actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={style.button} disabled={busy} onClick={()=>void saveAndExit()}>{busy?"Saving…":"Save & Exit"}</button><button style={style.button} disabled={busy} onClick={discardAndExit}>Discard & Exit</button><button style={style.button} disabled={busy} onClick={()=>finishLeave(false)}>Stay Here</button></div>
  </dialog>
  <header><p style={{color:"#fa6969",fontWeight:800,letterSpacing:2}}>WALKER AUTOMOTIVE · CONSULTANT DASHBOARD</p><h1 style={{fontSize:32,margin:"5px 0"}}>Sales Commander</h1><p style={{color:"#aebdcd"}}>Sales goals converted into measurable daily activity. Projections are estimates, never guaranteed sales.</p></header>
  {notice&&<div role="alert" style={{color:"#f9c06e"}}><p>{notice}</p>{!ready&&<button type="button" style={style.button} onClick={()=>setAttempt(value=>value+1)}>Retry saved activity</button>}</div>}
  {!ready?<p>{notice?"Saved activity is unavailable. Retry before making changes.":"Loading your saved command center…"}</p>:<>
  <section style={{...style.panel,marginBottom:12}}><label htmlFor="sales-goal">Monthly sales objective</label><NumberInput id="sales-goal" aria-label="Monthly sales goal" type="number" min={1} max={250} style={{...style.input,fontSize:23,maxWidth:160,display:"block",margin:"9px 0"}} value={state.goal} disabled={busy||assignedGoal!==null} onChange={e=>change(current=>({...current,goal:number(Number(e.target.value),5,1,250)}))} /><p style={{fontSize:12,color:"#aebdcd"}}>{assignedGoal!==null?"Your manager sets this monthly objective. Sales Commander automatically calculates your required activity.":"Changes stay local while you work. You can save them when you leave this page."}</p></section>
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:15}}>{tile("calls",proj.daily.calls)}{tile("talks",proj.daily.talks)}{tile("appts",proj.daily.appts)}{tile("shows",round(proj.adjusted.shows/state.rates.workdays))}{tile("sold",round(state.goal/state.rates.workdays))}</section>
  <section style={style.panel}><h2>Monthly activity required</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:10}}>{keys.map(k=><div key={k}><small>{names[k]}</small><h2>{proj.adjusted[k]}</h2></div>)}</div><p style={{color:"#aebdcd"}}>Based on {state.rates.workdays} selling days and a {state.rates.buffer}% activity cushion.</p></section>
  <RoutinePlanner earlyDays={state.earlyDays} onEarlyDays={earlyDays=>change(current=>({...current,earlyDays}))} schedule={state.schedule} weekendAnchor={state.weekendAnchor} onWeekendAnchor={weekendAnchor=>change(current=>({...current,weekendAnchor}))} disabled={busy} onSave={schedule=>change(current=>({...current,schedule}))}/>
  <section style={{...style.panel,marginTop:12}}><h2>Monthly scoreboard</h2><label>Month <input type="month" style={{...style.input,maxWidth:210,marginLeft:8}} value={month} onChange={e=>setMonth(e.target.value)} /></label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:15}}>{keys.map(k=><div key={k}><small>{names[k]}</small><h2>{monthTotals[k]}</h2></div>)}</div></section>
  <section style={{...style.panel,marginTop:12}}><h2>Win log</h2><form onSubmit={e=>{e.preventDefault();if(!win.trim())return;change(s=>({...s,wins:[...s.wins,`${day}: ${win.trim()}`].slice(-100)}));setWin("");}} style={{display:"flex",gap:8}}><input aria-label="Record a win" style={style.input} value={win} onChange={e=>setWin(e.target.value)} placeholder="Appointment, customer follow-up, delivery…" /><button disabled={busy} style={style.button}>Add</button></form>{state.wins.slice().reverse().map((w,i)=><p key={i} style={{borderBottom:"1px solid #344152",paddingBottom:8}}>{w}</p>)}</section>
  </>}
 </div>;
}