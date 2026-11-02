"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useVerifiedAccount } from "@/components/auth/required-password-change";
import { useSession } from "@/components/auth/supabase-session-gate";
import { requestJson } from "@/lib/request-json";
import { appearanceOnly, readAppearance, saveAppearance, invalidateAppearance, type WorkspaceAppearance } from "@/lib/workspace-appearance-cache";
export type WorkspaceIdentity = { id: string; displayName: string; role: string; email: string; profileImageUrl?: string; dealership?: string; workspaceRole?: string; organizationHideIcon?:boolean; organizationId?:string; organizationIconUrl?:string; organizationTheme?:string };
const WorkspaceContext = createContext<WorkspaceIdentity | null>(null);
export function useWorkspaceIdentity() { return useContext(WorkspaceContext); }
export function WorkspaceProvider({ children }: { children: ReactNode }) {
 const {accessToken}=useSession();const verified=useVerifiedAccount();
 const scope=verified?`${verified.id}:${verified.organizationId||""}:${verified.role}:${verified.workspaceRole||""}`:"";
 const [loaded,setLoaded]=useState<{scope:string;value:WorkspaceAppearance}|null>(()=>{const value=scope?readAppearance(scope):undefined;return value?{scope,value}:null;});
 useEffect(()=>{
  if(!accessToken||!verified)return;
  let active=true,pending=false;
  const load=async(force=false)=>{
   const cached=!force?readAppearance(scope):undefined;
   if(cached){setLoaded({scope,value:cached});return;}
   if(pending)return;pending=true;
   try{const result=await requestJson<WorkspaceIdentity>("/api/me",{headers:{Authorization:`Bearer ${accessToken}`}});if(active&&result.id===verified.id){const value=appearanceOnly(result);saveAppearance(scope,value);setLoaded({scope,value});}}
   catch{/* Optional appearance never blocks a verified workspace. */}finally{pending=false;}
  };
  const refresh=()=>{invalidateAppearance(scope);void load(true);};
  const timer=window.setTimeout(()=>void load(),1000);
  window.addEventListener("consultant-profile-updated",refresh);
  return()=>{active=false;window.clearTimeout(timer);window.removeEventListener("consultant-profile-updated",refresh);};
 },[accessToken,scope,verified]);
 const identity=process.env.NEXT_PUBLIC_DISABLE_AUTH==="1"?{id:"local-preview",displayName:"Local interface preview",role:"admin",email:""}:verified?{...verified,...(loaded?.scope===scope?loaded.value:{})}:null;
 if(!identity)return <p className="p-6" role="status">Checking your access…</p>;
 return <WorkspaceContext.Provider value={identity}><div className="organization-theme" data-mode="dark">{children}</div></WorkspaceContext.Provider>;
}
