"use client";
import { readDisplayHandoff, clearDisplayHandoff } from "@/lib/display-handoff";
import { useCallback,useEffect,useRef,useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useWorkspaceIdentity } from "./workspace-context";
import { useSession } from "@/components/auth/supabase-session-gate";
import { requestJson, withDeadline } from "@/lib/request-json";
import { cachedResource, primeResource, loadResource, invalidateResource, invalidateResourceGroup } from "@/lib/client-resource-cache";
import type { MonthBoard } from "@/lib/manager-board";
export type SharedBoard = { organization:{id:string;name:string;iconUrl?:string;theme?:string;hideIcon?:boolean};month:string;board:MonthBoard;roster:{id:string;name:string}[];proposals:Record<string,{value:number;submittedAt:string}|undefined>;me:string;canManage:boolean;canViewStats?:boolean;grossYtd?:number;version:string };
export async function boardRequest(organization="",body?:unknown,month="",accessToken?:string,view:"consultant"|"management"|"display"="management"):Promise<SharedBoard>{
 const token=accessToken || (await withDeadline(getSupabaseBrowserClient().auth.getSession(),"Your session took too long to load. Please retry.")).data.session?.access_token;
 if(!token)throw new Error("Sign in to load the board.");
 const query=new URLSearchParams();if(view!=="management")query.set("view",view);if(organization)query.set("organization",organization);if(month)query.set("month",month);
 return requestJson<SharedBoard>(`/api/manager-board${query.size?`?${query}`:""}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
}
export function useSharedBoard(organization="",view:"consultant"|"management"|"display"="management",month=""){
 const {accessToken}=useSession();
 const identity=useWorkspaceIdentity();
 const scope=`${accessToken||""}:${identity?.id}:${identity?.organizationId}:${identity?.role}:${identity?.workspaceRole}`;
 const resource=`board:${organization}:${view}${month?`:${month}`:""}`;
 const key=`${resource}:${scope}`;
 const currentKey=useRef(key);currentKey.current=key;
 const [loaded,setLoaded]=useState<{key:string;data:SharedBoard}|null>(()=>{let data=cachedResource<SharedBoard>(scope,resource);const handoff=identity?.id&&view==="display"?readDisplayHandoff(identity.id):null;if(!data&&handoff&&handoff.board.organization.id===organization&&handoff.board.month===month){data=handoff.board;primeResource(scope,resource,data,30000);}return data?{key,data}:null;});const data=loaded?.key===key?loaded.data:null;
 const [error,setError]=useState("");const [saving,setSaving]=useState(false);
 const live=useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]>|null>(null);
 const inFlight=useRef<{key:string;promise:Promise<void>}|null>(null);
 const sequence=useRef(0);
 const load=useCallback((force=false):Promise<void>=>{
  if(inFlight.current?.key===key)return inFlight.current.promise;
  const ticket=++sequence.current;
  const promise=(async()=>{try{const result=await loadResource(scope,resource,()=>boardRequest(organization,undefined,month,accessToken,view),30000,force);if(currentKey.current===key&&ticket===sequence.current){setLoaded({key,data:result});setError("");}}catch(failure){if(currentKey.current===key&&ticket===sequence.current)setError(failure instanceof Error?failure.message:"Could not load the board.");}finally{if(ticket===sequence.current)inFlight.current=null;}})();
  inFlight.current={key,promise};return promise;
 },[organization,accessToken,key,resource,view,scope,month]);
 useEffect(()=>{if(view==="display")clearDisplayHandoff();setError("");void load();const refresh=()=>{if(document.visibilityState==="visible")void load(true);};const timer=window.setInterval(refresh,60000+Math.floor(Math.random()*10000));window.addEventListener("focus",refresh);window.addEventListener("online",refresh);document.addEventListener("visibilitychange",refresh);window.addEventListener("manager-board-updated",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("manager-board-updated",refresh);};},[load,view]);
 useEffect(()=>{if(!data?.organization.id)return;const client=getSupabaseBrowserClient();let joined=false;const channel=client.channel(`board-updates:${data.organization.id}`).on("broadcast",{event:"updated"},()=>void load(true)).subscribe(status=>{if(status==="SUBSCRIBED"){if(joined)void load(true);joined=true;}});live.current=channel;return()=>{live.current=null;void client.removeChannel(channel);};},[data?.organization.id,load]);
 async function save(body:Record<string,unknown>){if(!data||saving||view==="display")return false;setSaving(true);setError("");try{invalidateResource(scope,resource);await boardRequest(organization,{...body,version:data.version,month:data.month},data.month,accessToken);invalidateResourceGroup(scope,"board:");inFlight.current=null;window.dispatchEvent(new Event("manager-board-updated"));void live.current?.send({type:"broadcast",event:"updated",payload:{}});await load(true);return true;}catch(failure){setError(failure instanceof Error?failure.message:"Could not save the board.");return false;}finally{setSaving(false);}}
 return {data,error,saving,save,reload:()=>load(true)};
}
