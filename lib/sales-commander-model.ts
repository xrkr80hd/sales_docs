import { normalizeEarlyDays, type EarlyDays } from "@/lib/routine-schedule";

type Rates={contact:number;set:number;show:number;sold:number;buffer:number;workdays:number};
export type Counts={calls:number;talks:number;appts:number;shows:number;sold:number};
type RoutineItem={id:string;time:string;name:string;done?:boolean};
type PlanDay={kind:"short"|"long"|"friday"|"off";items:RoutineItem[]};
export type State={goal:number;rates:Rates;days:Record<string,Counts>;wins:string[];weekendAnchor:string;earlyDays:EarlyDays;schedule:Record<string,PlanDay>};
export const defaults:State={goal:5,rates:{contact:22,set:40,show:59,sold:40,buffer:2,workdays:22},days:{},wins:[],weekendAnchor:"2026-08-08",earlyDays:"mon-wed",schedule:{}};
export const blank=():Counts=>({calls:0,talks:0,appts:0,shows:0,sold:0});
export const round=(n:number)=>Math.ceil(n-1e-9);
export const number=(value:unknown,fallback:number,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export function normalize(value:unknown):State{
 const v=value&&typeof value==="object"?value as Partial<State>:{};
 const r=v.rates||defaults.rates;
 const days:Record<string,Counts>={};
 if(v.days&&typeof v.days==="object")for(const [date,counts] of Object.entries(v.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!counts||typeof counts!=="object")continue;days[date]=Object.fromEntries((Object.keys(blank()) as (keyof Counts)[]).map(k=>[k,number(counts[k],0,0,100000)])) as unknown as Counts;}
 return {goal:number(v.goal,5,1,250),rates:{contact:number(r.contact,22,1,100),set:number(r.set,40,1,100),show:number(r.show,59,1,100),sold:number(r.sold,40,1,100),buffer:number(r.buffer,2,0,50),workdays:number(r.workdays,22,1,31)},days,wins:Array.isArray(v.wins)?v.wins.filter(x=>typeof x==="string").slice(-100):[],weekendAnchor:typeof v.weekendAnchor==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v.weekendAnchor)?v.weekendAnchor:"2026-08-08",earlyDays:normalizeEarlyDays(v.earlyDays),schedule:v.schedule&&typeof v.schedule==="object"?v.schedule:{}};
}
export function projection(s:State){
 const {contact,set,show,sold,buffer,workdays}=s.rates;
 const appts=round(s.goal/((show/100)*(sold/100)));
 const talks=round(appts/(set/100));
 const calls=round(talks/(contact/100));
 // 2% is a conservative activity-volume cushion, not fabricated conversion improvement.
 const adjusted={calls:round(calls*(1+buffer/100)),talks:round(talks*(1+buffer/100)),appts:round(appts*(1+buffer/100)),shows:round(s.goal/(sold/100)),sold:s.goal};
 return {adjusted,raw:{calls,talks,appts},daily:{calls:round(adjusted.calls/workdays),talks:round(adjusted.talks/workdays),appts:round(adjusted.appts/workdays)}};
}
