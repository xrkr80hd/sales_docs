"use client";
import {createContext,useCallback,useContext,useRef,useState,type ReactNode} from "react";
import {useSession} from "@/components/auth/supabase-session-gate";
import {useWorkspaceIdentity} from "@/components/command-center/workspace-context";
import {validateConsultantLinks,type ConsultantLink} from "@/lib/consultant-links";
import {requestLinks,type LinkCollection} from "./link-data";
type State={collection:LinkCollection|null;busy:boolean;error:string;notice:string;load:(force?:boolean)=>Promise<void>;save:(links:ConsultantLink[],optimistic?:boolean)=>Promise<boolean>};
const Context=createContext<State|null>(null);
export function useCommandCenter(){const context=useContext(Context);if(!context)throw Error("Command Center provider required");return context;}
export function CommandCenterProvider({children}:{children:ReactNode}){
 const {accessToken}=useSession();const identity=useWorkspaceIdentity();const scope=`${accessToken}:${identity?.id}:${identity?.organizationId}`;
 const currentScope=useRef(scope);currentScope.current=scope;
 const [saved,setSaved]=useState<{scope:string;value:LinkCollection}|null>(null);const collection=saved?.scope===scope?saved.value:null;
 const [state,setState]=useState({scope,busy:false,error:"",notice:""});
 const flight=useRef<{scope:string;promise:Promise<void>}|null>(null),writing=useRef(false);
 const load=useCallback((force=false):Promise<void>=>{
  if(!accessToken)return Promise.resolve();
  if(!identity?.organizationId){setState({scope,busy:false,error:"Your account needs an organization assignment before saving links.",notice:""});return Promise.resolve();}
  if(flight.current?.scope===scope)return flight.current.promise;
  if(!force&&collection)return Promise.resolve();
  setState({scope,busy:true,error:"",notice:""});
  const promise=requestLinks(accessToken).then(value=>{if(currentScope.current===scope){if(value.organization.id!==identity.organizationId)throw Error("Your organization changed. Reload this page.");setSaved({scope,value});}}).catch(error=>{if(currentScope.current===scope)setState({scope,busy:false,error:error.message,notice:""});}).finally(()=>{if(flight.current?.scope===scope)flight.current=null;if(currentScope.current===scope)setState(previous=>({...previous,busy:false}));});
  flight.current={scope,promise};return promise;
 },[accessToken,identity?.organizationId,scope,collection]);
 const save=async(input:ConsultantLink[],optimistic=false)=>{
  if(writing.current||!collection||!accessToken||state.busy)return false;
  let links:ConsultantLink[];try{links=validateConsultantLinks(input);}catch(error){setState({scope,busy:false,error:error instanceof Error?error.message:"Invalid links.",notice:""});return false;}
  const previous=collection;writing.current=true;setState({scope,busy:true,error:"",notice:""});
  if(optimistic)setSaved({scope,value:{...previous,links}});
  try{const value=await requestLinks(accessToken,{links,version:previous.version,organizationId:previous.organization.id});if(currentScope.current===scope){setSaved({scope,value});setState({scope,busy:false,error:"",notice:"Command Center saved."});}return true;}
  catch(error){if(currentScope.current===scope){setSaved({scope,value:previous});setState({scope,busy:false,error:error instanceof Error?error.message:"Could not save links.",notice:""});}return false;}
  finally{writing.current=false;}
 };
 const scoped=state.scope===scope?state:{scope,busy:false,error:"",notice:""};
 return <Context.Provider value={{collection,...scoped,load,save}}>{children}</Context.Provider>;
}
