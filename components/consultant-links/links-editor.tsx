"use client";
import { useEffect,useState } from "react";
import { Plus,Trash2,ChevronDown } from "lucide-react";
import { CDJR_LINKS,type ConsultantLink } from "@/lib/consultant-links";
import { useWorkspaceIdentity } from "@/components/command-center/workspace-context";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestLinks } from "./link-data";
import styles from "./links.module.css";
export function LinksEditor() {
  const identity=useWorkspaceIdentity();
  const admin=identity?.role==="admin"||identity?.email==="xrkr80hd@gmail.com";
  const [organizations,setOrganizations]=useState<{id:string;name:string}[]>([]);
  const [organization,setOrganization]=useState("");
  const [links,setLinks]=useState<ConsultantLink[]>([]);
  const [notice,setNotice]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!admin)return;void (async()=>{try{const {data}=await getSupabaseBrowserClient().auth.getSession();const response=await fetch("/api/admin/messenger",{headers:{Authorization:`Bearer ${data.session?.access_token||""}`}});if(response.ok)setOrganizations((await response.json()).organizations);}catch{/* Links request shows any error. */}})();},[admin]);
  useEffect(()=>{let active=true;setBusy(true);setError("");void requestLinks(organization).then(result=>{if(active)setLinks(result.links);}).catch(failure=>{if(active){setLinks([]);setError(failure.message);}}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[organization]);
  async function save(){setBusy(true);setError("");setNotice("");try{await requestLinks(organization,links);window.dispatchEvent(new Event("consultant-links-updated"));setNotice(admin?"Dealership links saved for your team.":"Your links saved for this dealership.");}catch(failure){setError(failure instanceof Error?failure.message:"Could not save.");}finally{setBusy(false);}}
  return <details className={styles.editor}><summary><div><h3>Consultant Links</h3><p>{admin?"Dealership links shared with the team":"Your dealership portals and shortcuts"}</p></div><ChevronDown size={18}/></summary><div className={styles.editBody}>
    {admin&&<label>Organization<select value={organization} onChange={event=>setOrganization(event.target.value)}><option value="">My assigned organization</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    {links.map((link,index)=><div key={link.id} className={styles.linkFields}><label>Link {index+1} name<input value={link.name} maxLength={60} onChange={event=>setLinks(current=>current.map(item=>item.id===link.id?{...item,name:event.target.value}:item))}/></label><label>HTTPS address<input type="url" value={link.url} onChange={event=>setLinks(current=>current.map(item=>item.id===link.id?{...item,url:event.target.value}:item))}/></label><button type="button" aria-label={`Remove ${link.name||`link ${index+1}`}`} onClick={()=>setLinks(current=>current.filter(item=>item.id!==link.id))}><Trash2 size={16}/></button></div>)}
    <div className={styles.actions}><button type="button" disabled={busy||links.length>=20} onClick={()=>setLinks(current=>[...current,{id:crypto.randomUUID(),name:"",url:""}])}><Plus size={16}/>Add link</button><button type="button" disabled={busy} onClick={()=>setLinks(current=>[...current,...CDJR_LINKS.filter(link=>!current.some(item=>item.url===link.url)).map(link=>({...link,id:crypto.randomUUID()}))])}>Add CDJR portals</button></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}<button type="button" disabled={busy} onClick={()=>void save()} className={styles.primary}>{busy?"Loading…":"Save links"}</button>
  </div></details>;
}
