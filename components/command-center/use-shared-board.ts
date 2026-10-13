"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { MonthBoard } from "@/lib/manager-board";
export type SharedBoard = { organization:{id:string;name:string;iconUrl?:string;theme?:string;hideIcon?:boolean};month:string;board:MonthBoard;roster:{id:string;name:string}[];proposals:Record<string,{value:number;submittedAt:string}|undefined>;me:string;canManage:boolean;canViewStats?:boolean;grossYtd?:number;version:string };
export async function boardRequest(organization="",body?:unknown,month=""){
 const {data}=await getSupabaseBrowserClient().auth.getSession();
 const query=new URLSearchParams();if(organization)query.set("organization",organization);if(month)query.set("month",month);
 const response=await fetch(`/api/manager-board${query.size?`?${query}`:""}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${data.session?.access_token||""}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not load the board.");return result;
}
export function useSharedBoard(organization=""){
 const [data,setData]=useState<SharedBoard|null>(null);const [error,setError]=useState("");const [saving,setSaving]=useState(false);
 const live=useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]>|null>(null);
 const load=useCallback(async()=>{try{setData(await boardRequest(organization));setError("");}catch(failure){setError(failure instanceof Error?failure.message:"Could not load the board.");}},[organization]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15000);const refresh=()=>void load();window.addEventListener("focus",refresh);window.addEventListener("manager-board-updated",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("manager-board-updated",refresh);};},[load]);
 useEffect(()=>{if(!data?.organization.id)return;let client;try{client=getSupabaseBrowserClient();}catch{return;}const channel=client.channel(`board-updates:${data.organization.id}`).on("broadcast",{event:"updated"},()=>void load()).subscribe();live.current=channel;return()=>{live.current=null;void client.removeChannel(channel);};},[data?.organization.id,load]);
 async function save(body:Record<string,unknown>){setSaving(true);setError("");try{await boardRequest(organization,{...body,version:data?.version||"",month:data?.month});window.dispatchEvent(new Event("manager-board-updated"));void live.current?.send({type:"broadcast",event:"updated",payload:{}});await load();return true;}catch(failure){setError(failure instanceof Error?failure.message:"Could not save the board.");return false;}finally{setSaving(false);}}
 return {data,error,saving,save,reload:load};
}
