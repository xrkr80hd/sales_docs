"use client";
import {useCallback,useEffect,useState} from "react";
import styles from "./sales-commander-stats.module.css";
import {getSupabaseBrowserClient} from "@/lib/supabase-browser";
type Counts={calls:number;talks:number;appts:number;shows:number;sold:number};
type Entry={userId:string;name:string;organization:string;organizationId:string;goal:number;rates?:{contact?:number;set?:number;show?:number;sold?:number;buffer?:number};workdays:number;today:Counts;monthly:Counts;updatedAt:string|null};
type Result={entries:Entry[];organizations:{id:string;name:string}[];scope:string;date:string};
function targets(e:Entry){const r=e.rates||{};const sold=Math.max(1,r.sold||40)/100,show=Math.max(1,r.show||59)/100,set=Math.max(1,r.set||40)/100,contact=Math.max(1,r.contact||22)/100,buffer=1+(r.buffer??2)/100;const appts=Math.ceil(e.goal/(show*sold));const talks=Math.ceil(appts/set),calls=Math.ceil(talks/contact);const monthly={calls:Math.ceil(calls*buffer),talks:Math.ceil(talks*buffer),appts:Math.ceil(appts*buffer),shows:Math.ceil(e.goal/sold),sold:e.goal};return monthly;}
const fields=[["calls","Calls"],["talks","Real conversations"],["appts","Appointments set"],["shows","Appointments shown"],["sold","Sales"]] as const;
export function SalesCommanderStats(){
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(""),[org,setOrg]=useState(""),[selected,setSelected]=useState(""),[date,setDate]=useState(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
 const [view,setView]=useState<"today"|"month">("today");
 const load=useCallback(async()=>{try{const {data}=await getSupabaseBrowserClient().auth.getSession();if(!data.session)throw Error("Sign in required.");const params=new URLSearchParams({date,...(org?{organization:org}:{})});const response=await fetch("/api/manager/sale-commander?"+params.toString(),{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});const body=await response.json();if(!response.ok)throw Error(body.error||"Unable to load statistics.");setResult(body);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load statistics.");}},[org,date]);
 useEffect(()=>{void load();const id=window.setInterval(()=>void load(),5000);const refresh=()=>void load();window.addEventListener("focus",refresh);return()=>{window.clearInterval(id);window.removeEventListener("focus",refresh);};},[load]);
 const entries=(result?.entries||[]).filter(e=>!selected||e.userId===selected);
 const totals=entries.reduce((t,e)=>{for(const [field]of fields)t[field]+=(e[view==="today"?"today":"monthly"][field]||0);return t;},{calls:0,talks:0,appts:0,shows:0,sold:0});
 return <section className={styles.page}>
 <header className={styles.header}><small>MANAGER COACHING</small><h1>Sales Commander Stats</h1><p>Track saved activity and compare each consultant’s progress with their goals.</p></header>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 <div className={styles.filters}>
 <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 {result?.scope==="district"&&<label>Dealership<select value={org} onChange={e=>{setOrg(e.target.value);setSelected("");}}><option value="">All dealerships</option>{result.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
 <label>Consultant<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Entire team</option>{result?.entries.map(e=><option key={e.userId} value={e.userId}>{e.name}</option>)}</select></label>
 </div>
 <div className={styles.period} aria-label="Reporting period"><button type="button" aria-pressed={view==="today"} onClick={()=>setView("today")}>Selected day</button><button type="button" aria-pressed={view==="month"} onClick={()=>setView("month")}>Month to date</button></div>
 {!result&&!error&&<p role="status">Loading team activity…</p>}
 {result&&<>
 <div className={styles.totals}>{fields.map(([k,label])=><div key={k}><span>{label}</span><strong>{totals[k].toLocaleString()}</strong></div>)}</div>
 <div className={styles.sectionTitle}><h2>Consultant activity</h2><span>Actual / planning target</span></div>
 <div className={styles.people}>{entries.map(e=><article key={e.userId} className={styles.person}>
 <header><div><h3>{e.name}</h3><p>{e.organization}</p></div><span className={styles.goal}>{e.goal} monthly sales goal</span></header>
 <dl>{fields.map(([k,label])=>{const actual=e[view==="today"?"today":"monthly"][k]||0;const target=view==="today"?Math.ceil(targets(e)[k]/Math.max(1,e.workdays)):targets(e)[k];return <div key={k}><dt>{label}</dt><dd><strong>{actual.toLocaleString()}</strong><span> / {target.toLocaleString()}</span></dd><progress aria-label={`${label}: ${actual} of ${target}`} value={Math.min(actual,Math.max(1,target))} max={Math.max(1,target)}/></div>;})}</dl>
 <footer>{e.updatedAt?`Last saved ${new Date(e.updatedAt).toLocaleString()}`:"No activity saved yet"}</footer>
 </article>)}</div>
 {!entries.length&&<p className={styles.empty}>No consultants match these filters.</p>}
 </>}
 <details className={styles.notes}><summary>How to read these numbers</summary><p>Actuals are activity saved by consultants. Planning targets use each consultant’s sales goal and conversion settings; daily targets divide that plan across their workdays. These are coaching estimates, not verified phone-system records. Activity refreshes automatically.</p></details>
 </section>;
}
