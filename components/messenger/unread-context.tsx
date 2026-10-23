"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {useSession} from "@/components/auth/supabase-session-gate";
import {getSupabaseBrowserClient,isSupabaseConfigured} from "@/lib/supabase-browser";
import {messengerRequest} from "@/lib/messenger-request";
type UnreadState={counts:Record<string,number>;total:number;refresh:()=>Promise<void>;markRead:(id:string)=>void};
const UnreadContext=createContext<UnreadState>({counts:{},total:0,refresh:async()=>{},markRead:()=>{}});
export function useMessengerUnread(){return useContext(UnreadContext);}
export function MessengerUnreadProvider({children}:{children:ReactNode}){
 const {accessToken}=useSession();
 const [loaded,setLoaded]=useState<{token:string;counts:Record<string,number>}|null>(null);
 const tokenRef=useRef(accessToken);tokenRef.current=accessToken;
 const pending=useRef<{token:string;ticket:number}|null>(null),generation=useRef(0);
 const refresh=useCallback(async()=>{
  if(!accessToken||pending.current?.token===accessToken)return;
  const ticket=++generation.current;pending.current={token:accessToken,ticket};
  try{const result=await messengerRequest(accessToken,"/api/messenger?summary=1");if(tokenRef.current===accessToken&&ticket===generation.current)setLoaded({token:accessToken,counts:Object.fromEntries((result.conversations||[]).map((c:{id:string;unread:number})=>[c.id,Math.max(0,Number(c.unread)||0)]))});}
  catch{/* An unavailable badge must never block any workspace page. */}
  finally{if(pending.current?.ticket===ticket)pending.current=null;}
 },[accessToken]);
 const markRead=useCallback((id:string)=>{++generation.current;setLoaded(previous=>previous&&previous.token===tokenRef.current?{...previous,counts:{...previous.counts,[id]:0}}:previous);},[]);
 useEffect(()=>{
  if(!accessToken||!isSupabaseConfigured())return;
  void refresh();let debounce:ReturnType<typeof setTimeout>|undefined;
  const visible=()=>{if(document.visibilityState==="visible")void refresh();};
  const changed=()=>{if(debounce)clearTimeout(debounce);debounce=setTimeout(visible,350);};
  const interval=setInterval(visible,60000);
  window.addEventListener("focus",visible);document.addEventListener("visibilitychange",visible);
  const client=getSupabaseBrowserClient();
  // Database RLS controls event delivery. No directory/history is loaded here.
  const channel=client.channel("messenger-unread-badge").on("postgres_changes",{event:"*",schema:"public",table:"messenger_messages"},changed).subscribe();
  return()=>{++generation.current;pending.current=null;clearInterval(interval);if(debounce)clearTimeout(debounce);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);void client.removeChannel(channel);};
 },[refresh]);
 const value=useMemo(()=>{const counts=loaded&&loaded.token===accessToken?loaded.counts:{};return {counts,total:Object.values(counts).reduce((n,c)=>n+c,0),refresh,markRead};},[loaded,accessToken,refresh,markRead]);
 return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
