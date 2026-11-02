"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { notifySave } from "@/components/ui/save-toast-host";
import { OrganizationBadge } from "@/components/command-center/organization-badge";
import { ORGANIZATION_THEMES } from "@/lib/organization-theme";
import { Building2, Plus, Search, Users, ChevronDown, Eye, EyeOff, Copy } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestJson, withDeadline } from "@/lib/request-json";
import { ROLE_LABELS, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/workspace-roles";
import styles from "./team-management.module.css";

type Address = {street:string;city:string;state:string;zip:string};
const emptyAddress=():Address=>({street:"",city:"",state:"",zip:""});
type Organization = { id: string; name: string; iconUrl?:string; theme?:string; hideIcon?:boolean;address?:Address };
type User = { id: string; display_name: string; email: string; role: string; workspace_role?: WorkspaceRole; card_enabled?: boolean; card_slug?: string; email_verified?: boolean; must_change_password?: boolean };
type Membership = { user_id: string; organization_id: string; chat_enabled: boolean; can_dm: boolean; can_org_chat: boolean };
type Invite = { id: string; email: string; role: string; accepted_at?: string };
type TeamResponse = { users?: User[]; organizations?: Organization[]; memberships?: Membership[]; invites?: Invite[]; warnings?: string[]; organization: Organization };
async function api(path: string, init?: RequestInit) {
  let token = "";
  token = (await withDeadline(getSupabaseBrowserClient().auth.getSession(), "Your session took too long to load. Please retry.")).data.session?.access_token || "";
  return requestJson<TeamResponse>(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
}
async function saveBranding(organizationId:string,theme:string,file?:File|null,removeIcon=false,address?:Address){
 const form=new FormData();form.set("organizationId",organizationId);form.set("theme",theme);if(file)form.set("file",file);if(removeIcon)form.set("removeIcon","1");if(address)for(const [key,value] of Object.entries(address))form.set(key,value);
 const {data}=await getSupabaseBrowserClient().auth.getSession();const response=await fetch("/api/admin/organization-branding",{method:"POST",headers:{Authorization:`Bearer ${data.session?.access_token||""}`},body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not save branding.");window.dispatchEvent(new Event("consultant-profile-updated"));return result;
}
function ThemeChoices(){return <><option value="">Automatic from organization name</option>{Object.entries(ORGANIZATION_THEMES).map(([id,theme])=><option key={id} value={id}>{theme.label}</option>)}</>;}
export function TeamManagement() {
  const [organizations,setOrganizations] = useState<Organization[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [memberships,setMemberships] = useState<Membership[]>([]);
  const [invites,setInvites] = useState<Invite[]>([]);
  const [search,setSearch] = useState("");
  const [teamView,setTeamView] = useState<"list"|"grid">("list");
  const [selectedTeamOrg,setSelectedTeamOrg]=useState<string|null>(null);
  useEffect(()=>{try{if(window.localStorage.getItem("nxtdox.team-view")==="grid")setTeamView("grid");}catch{}},[]);
  const selectTeamView=(view:"list"|"grid")=>{setTeamView(view);try{window.localStorage.setItem("nxtdox.team-view",view);}catch{}};
  const [organization,setOrganization] = useState("");
  const [error,setError] = useState("");
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [directoryReady,setDirectoryReady] = useState(false);
  const [newOrgFile,setNewOrgFile]=useState<File|null>(null);
  const [newOrgTheme,setNewOrgTheme]=useState("");
  const [newOrg,setNewOrg] = useState("");
  const [newOrgAddress,setNewOrgAddress]=useState<Address>(emptyAddress);
  const [showNewPassword,setShowNewPassword] = useState(false);
  const [newUser,setNewUser] = useState({ name: "", email: "", role: "user" as WorkspaceRole, organizationId: "", cardEnabled: true, chatEnabled: true, canDm: true, canOrgChat: true, createMode: "direct", password: "", forceChange: true });
  const load = useCallback(async () => {
    setLoading(true);
    const [team,directory,invitations] = await Promise.allSettled([api("/api/admin/users"),api("/api/workspace/directory"),api("/api/admin/invites")]);
    const errors:string[]=[];
    if(team.status==="fulfilled"){setUsers(team.value.users||[]);errors.push(...(team.value.warnings||[]));}else errors.push("Registered user accounts: "+String(team.reason instanceof Error?team.reason.message:team.reason));
    setDirectoryReady(directory.status==="fulfilled");
    if(directory.status==="fulfilled"){setOrganizations(directory.value.organizations||[]);setMemberships(directory.value.memberships||[]);}else errors.push("Dealership directory: "+String(directory.reason instanceof Error?directory.reason.message:directory.reason));
    if(invitations.status==="fulfilled")setInvites(invitations.value.invites||[]);else errors.push("Invitations: "+String(invitations.reason instanceof Error?invitations.reason.message:invitations.reason));
    setError(errors.join(" | "));setLoading(false);
    if(team.status==="rejected")throw new Error("Registered account list could not be loaded.");
  },[]);
  useEffect(() => { void load().catch(()=>{}); },[load]);
  async function perform(operation: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setStatus(""); notifySave("saving","Saving changes…");
    try { await operation(); await load(); window.dispatchEvent(new Event("consultant-profile-updated")); setStatus(message); notifySave("success",message); }
    catch (failure) { const msg=failure instanceof Error ? failure.message : "Could not save."; setError(msg); notifySave("error",msg); }
    finally { setBusy(false); }
  }
  const shown = users.filter(user => `${user.display_name} ${user.email}`.toLowerCase().includes(search.toLowerCase()) && (!organization || memberships.some(member => member.user_id === user.id && member.organization_id === organization)));
  const unassigned = shown.filter(user => !memberships.some(member => member.user_id === user.id && organizations.some(org => org.id === member.organization_id)));
  return <div className={styles.page}>
    <header className={styles.heading}><p>MASTER ADMIN</p><h1>People & Organizations</h1><span>Manage your team, access, and dealership assignments.</span></header>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={loading || busy} onClick={()=>void load().catch(()=>{})}>{loading ? "Reloading…" : "Retry loading team & organizations"}</button></div>}{status && <p className={styles.status} role="status">{status}</p>}
    <div className={styles.topGrid}>
      <details className={styles.panel}><summary><Users size={20} />Add a user<Plus size={18} /></summary><form onSubmit={(event: FormEvent) => { event.preventDefault(); void perform(async () => { await api("/api/admin/workspace", { method: "POST", body: JSON.stringify({ action: "create-user", ...newUser }) }); setNewUser(current => ({ ...current, name: "", email: "", password: "" })); }, "User created."); }}>
        <label>Name<input required value={newUser.name} onChange={event => setNewUser(current => ({ ...current,name:event.target.value }))} /></label>
        <label>Email<input required type="email" value={newUser.email} onChange={event => setNewUser(current => ({ ...current,email:event.target.value }))} /></label>
        <label>Account setup<select value={newUser.createMode} onChange={event=>setNewUser(current=>({...current,createMode:event.target.value,password:""}))}><option value="direct">Create & verify in app</option><option value="invite">Send email invitation</option></select></label>
        {newUser.createMode === "direct" && <><label>Temporary password<PasswordControl value={newUser.password} onChange={value=>setNewUser(current=>({...current,password:value}))} visible={showNewPassword} onToggle={()=>setShowNewPassword(v=>!v)}/></label><p>Minimum 8 characters, one uppercase letter, and one special character. The user can sign in immediately.</p></>}
        <label>Role<select value={newUser.role} onChange={event => setNewUser(current => ({ ...current,role:event.target.value as WorkspaceRole }))}>{WORKSPACE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <label>Organization<select required disabled={loading || !directoryReady} value={newUser.organizationId} onChange={event => setNewUser(current => ({ ...current,organizationId:event.target.value }))}><option value="">{loading ? "Loading dealerships…" : directoryReady ? "Choose a dealership" : "Dealerships unavailable — retry above"}</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        {([['cardEnabled','Consultant card'],['chatEnabled','Messenger'],['canDm','Direct messages'],['canOrgChat','Team chat']] as const).map(([field,label]) => <label className={styles.check} key={field}><input type="checkbox" checked={newUser[field]} onChange={event => setNewUser(current => ({ ...current,[field]:event.target.checked }))} />{label}</label>)}
        <p>Direct creation verifies the email administratively without sending an invitation. Use this for users whose identity you have confirmed.</p><button type="submit" disabled={busy || loading || !directoryReady || !newUser.organizationId} className={styles.primary}>{newUser.createMode === "direct" ? "Create verified user" : "Add user & send invitation"}</button>
      </form></details>
      <details className={styles.panel}><summary><Building2 size={20} />Add an organization<Plus size={18} /></summary><form onSubmit={event => { event.preventDefault(); void perform(async () => { const result=await api("/api/admin/workspace", { method: "POST",body:JSON.stringify({action:"create-organization",name:newOrg}) }); setNewOrg("");try {await saveBranding(result.organization.id,newOrgTheme,newOrgFile,false,newOrgAddress);setNewOrgFile(null);setNewOrgAddress(emptyAddress());}catch(failure){throw new Error(`Organization created; branding needs attention. Use Organization branding below. ${failure instanceof Error?failure.message:""}`);} }, "Organization created."); }}><label>Organization name<input required value={newOrg} onChange={event => setNewOrg(event.target.value)} /></label><AddressFields value={newOrgAddress} onChange={setNewOrgAddress}/><label>Color scheme<select value={newOrgTheme} onChange={event=>setNewOrgTheme(event.target.value)}><ThemeChoices/></select></label><label>Organization icon<input aria-label="New organization icon" type="file" accept="image/png,image/webp" onChange={event=>setNewOrgFile(event.target.files?.[0]||null)}/></label><p>Transparent PNG or WebP, up to 3 MB. Recommended: 512 × 512. Displays as a 24 px badge.</p><button type="submit" className={styles.primary} disabled={busy}>Create organization</button></form></details>
    </div>
    <details className={styles.panel}><summary><Building2 size={20}/>Edit organizations<ChevronDown size={18}/></summary>{organizations.map(org=><BrandingEditor key={`${org.id}:${org.iconUrl}:${org.theme}`} organization={org} busy={busy} onSave={(name,theme,file,address)=>perform(async()=>{if(name!==org.name)await api(`/api/admin/organizations/${org.id}`,{method:"PATCH",body:JSON.stringify({name})});await saveBranding(org.id,theme,file,false,address);},"Organization saved.")} onRemoveIcon={()=>perform(()=>saveBranding(org.id,org.theme||"",null,true),"Organization icon removed.")} onDelete={()=>{if(window.confirm(`Delete ${org.name}? Assigned users will move to Walker Automotive. Accounts, roles, and existing history are preserved.`))void perform(()=>api(`/api/admin/organizations/${org.id}`,{method:"DELETE"}),"Organization deleted. Assigned users moved to Walker Automotive.");}}/>)}</details>
    <section className={styles.panel}><div className={styles.filters}><label><Search size={16} /><input placeholder="Find a team member" aria-label="Find a team member" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filter organization" value={organization} onChange={event => setOrganization(event.target.value)}><option value="">All organizations</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
      <div className={styles.listHeading}><h2>Your team</h2><span>{loading ? "Loading…" : `${shown.length} people`}</span><div className={styles.viewSwitcher} role="group" aria-label="Organization layout"><button type="button" aria-pressed={teamView==="list"} onClick={()=>selectTeamView("list")}>List</button><button type="button" aria-pressed={teamView==="grid"} onClick={()=>selectTeamView("grid")}>Grid</button></div></div>
      {teamView==="grid" ? <>
        <div className={styles.teamGrid}>
          {organizations.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(org=>{
            const count=shown.filter(user=>memberships.some(m=>m.user_id===user.id&&m.organization_id===org.id)).length;
            return <button key={org.id} type="button" aria-pressed={selectedTeamOrg===org.id} className={styles.teamGridCard} onClick={()=>setSelectedTeamOrg(current=>current===org.id?null:org.id)}>
              <span className={styles.teamGridArt}>{org.iconUrl&&!org.hideIcon?<img src={org.iconUrl} alt="" />:<Building2 size={26}/>}</span>
              <strong>{org.name}</strong><small>{count} {count===1?"person":"people"}</small>
            </button>;
          })}
        </div>
        {selectedTeamOrg&&organizations.filter(org=>org.id===selectedTeamOrg).map(activeOrg=>{
          const activeGroup=shown.filter(user=>memberships.some(m=>m.user_id===user.id&&m.organization_id===activeOrg.id)).sort((a,b)=>(a.display_name||a.email).localeCompare(b.display_name||b.email,undefined,{sensitivity:"base"}));
          return <section key={activeOrg.id} className={styles.selectedTeamPanel} aria-label={activeOrg.name+" personnel"}>
            <header><h3>{activeOrg.name} <small>({activeGroup.length})</small></h3><button type="button" onClick={()=>setSelectedTeamOrg(null)} aria-label="Close personnel">Close ×</button></header>
            <div className={styles.selectedTeamScroll}>
                  {activeGroup.map(user => <Member key={`${user.id}:${user.display_name}:${user.workspace_role || user.role}:${user.card_enabled}:${JSON.stringify(memberships.find(member => member.user_id === user.id))}`} user={user} member={memberships.find(member => member.user_id === user.id)} organizations={organizations} busy={busy} onSave={(role,cardEnabled,member,displayName) => perform(async () => { await api(`/api/admin/users/${user.id}`,{method:"PATCH",body:JSON.stringify({...(user.email.toLowerCase() === "xrkr80hd@gmail.com" || role === (user.workspace_role || user.role) ? {} : {role}),card_enabled:cardEnabled,display_name:displayName})}); if (member.organization_id) await api("/api/admin/messenger",{method:"POST",body:JSON.stringify({userId:user.id,organizationId:member.organization_id,chatEnabled:member.chat_enabled,canDm:member.can_dm,canOrgChat:member.can_org_chat})}); }, "Role, permissions, and organization saved.")} onRemove={() => { if (window.confirm(`Remove ${user.email}? This deletes their account.`)) void perform(() => api(`/api/admin/users/${user.id}`, { method:"DELETE" }), "Account removed."); }} />)}

            {activeGroup.length===0&&<p className={styles.empty}>No matching personnel.</p>}
            </div>
          </section>;
        })}
      </> : <div className={styles.teamList}>
      {organizations.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(org=>{const group=shown.filter(user=>memberships.some(m=>m.user_id===user.id&&m.organization_id===org.id)).sort((a,b)=>(a.display_name||a.email).localeCompare(b.display_name||b.email,undefined,{sensitivity:"base"}));return <details key={org.id} className={styles.teamGroup} open={Boolean(search.trim())&&group.length>0}><summary><span className={styles.teamOrgArt}>{org.iconUrl&&!org.hideIcon?<img src={org.iconUrl} alt="" />:<Building2 size={22}/>}</span><strong>{org.name}</strong><small>{group.length} {group.length===1?"person":"people"}</small><ChevronDown size={18}/></summary><div className={styles.teamMembers}>
            {group.map(user => <Member key={`${user.id}:${user.display_name}:${user.workspace_role || user.role}:${user.card_enabled}:${JSON.stringify(memberships.find(member => member.user_id === user.id))}`} user={user} member={memberships.find(member => member.user_id === user.id)} organizations={organizations} busy={busy} onSave={(role,cardEnabled,member,displayName) => perform(async () => { await api(`/api/admin/users/${user.id}`,{method:"PATCH",body:JSON.stringify({...(user.email.toLowerCase() === "xrkr80hd@gmail.com" || role === (user.workspace_role || user.role) ? {} : {role}),card_enabled:cardEnabled,display_name:displayName})}); if (member.organization_id) await api("/api/admin/messenger",{method:"POST",body:JSON.stringify({userId:user.id,organizationId:member.organization_id,chatEnabled:member.chat_enabled,canDm:member.can_dm,canOrgChat:member.can_org_chat})}); }, "Role, permissions, and organization saved.")} onRemove={() => { if (window.confirm(`Remove ${user.email}? This deletes their account.`)) void perform(() => api(`/api/admin/users/${user.id}`, { method:"DELETE" }), "Account removed."); }} />)}

      {group.length===0&&<p className={styles.empty}>No matching personnel.</p>}</div></details>;})}
      </div>}
      {unassigned.length > 0 && <section aria-label="Accounts awaiting organization assignment"><h3>{directoryReady ? "Unassigned accounts" : "Accounts — organization assignments unavailable"}</h3>{unassigned.map(user => <Member key={user.id} user={user} organizations={organizations} busy={busy || loading || !directoryReady} onSave={(role,cardEnabled,member,displayName)=>perform(async()=>{await api(`/api/admin/users/${user.id}`,{method:"PATCH",body:JSON.stringify({...(user.email.toLowerCase()==="xrkr80hd@gmail.com" || role===(user.workspace_role||user.role)?{}:{role}),card_enabled:cardEnabled,display_name:displayName})});await api("/api/admin/messenger",{method:"POST",body:JSON.stringify({userId:user.id,organizationId:member.organization_id,chatEnabled:member.chat_enabled,canDm:member.can_dm,canOrgChat:member.can_org_chat})});},"Role, permissions, and organization saved.")} onRemove={()=>{if(window.confirm(`Remove ${user.email}? This deletes their account.`))void perform(()=>api(`/api/admin/users/${user.id}`,{method:"DELETE"}),"Account removed.");}} />)}</section>}
      {!loading && shown.length === 0 && <p className={styles.empty}>No matching users.</p>}
    </section>
    <details className={styles.panel}><summary>Invitations<ChevronDown size={18} /></summary><div className={styles.invites}>{invites.map(invite => <div key={invite.id}><span>{invite.email}</span><small>{invite.accepted_at ? "Accepted" : "Pending"}</small>{!invite.accepted_at && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Revoke ${invite.email}'s invitation?`)) void perform(() => api(`/api/admin/invites/${invite.id}`,{method:"DELETE"}),"Invitation revoked."); }}>Revoke</button>}</div>)}{invites.length === 0 && <p>No invitations.</p>}</div></details>
  </div>;
}
function Member({user,member,organizations,busy,onSave,onRemove}:{user:User;member?:Membership;organizations:Organization[];busy:boolean;onSave:(role:WorkspaceRole,card:boolean,member:Membership,name:string)=>Promise<void>;onRemove:()=>void}) {
  const [displayName,setDisplayName] = useState(user.display_name || "");
  const [role,setRole] = useState<WorkspaceRole>(user.workspace_role || user.role as WorkspaceRole);
  const [card,setCard] = useState(Boolean(user.card_enabled));
  const [assignment,setAssignment] = useState<Membership>(member || {user_id:user.id,organization_id:"",chat_enabled:false,can_dm:false,can_org_chat:false});
  const owner = user.email.toLowerCase() === "xrkr80hd@gmail.com";
  return <details className={styles.member}><summary><div><strong>{user.display_name || user.email}</strong><small>{user.email}</small></div><div><span>{ROLE_LABELS[role]}</span><small>{organizations.find(org => org.id === member?.organization_id)?.name || "Unassigned"}</small></div><ChevronDown size={18} /></summary><form onSubmit={event => {event.preventDefault(); void onSave(role,card,assignment,displayName);}}><fieldset disabled={busy}><label>Display Name<input required maxLength={120} value={displayName} onChange={event=>setDisplayName(event.target.value)} /><small>Internal organization profile only. Your public business card is edited separately.</small></label><div className={styles.editGrid}><label>Role<select disabled={owner} value={role} onChange={event=>setRole(event.target.value as WorkspaceRole)}>{WORKSPACE_ROLES.map(role=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><label>Organization<select required value={assignment.organization_id} onChange={event=>setAssignment(current=>({...current,organization_id:event.target.value}))}><option value="">Choose a dealership</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label></div><label className={styles.check}><input type="checkbox" checked={card} onChange={event=>setCard(event.target.checked)} />Consultant card</label>{([['chat_enabled','Messenger'],['can_dm','Direct messages'],['can_org_chat','Team chat']] as const).map(([field,label])=><label className={styles.check} key={field}><input type="checkbox" disabled={owner} checked={assignment[field]} onChange={event=>setAssignment(current=>({...current,[field]:event.target.checked}))} />{label}</label>)}<div className={styles.actions}><button type="submit" className={styles.primary}>Save access</button>{user.card_slug && <><Link href={`/card/${user.card_slug}`} target="_blank">View card</Link><button type="button" onClick={()=>{ void navigator.clipboard.writeText(`${window.location.origin}/card/${user.card_slug}`); }}>Copy card link</button></>}{!owner && <button type="button" onClick={onRemove}>Remove user</button>}</div></fieldset></form><AccountSecurity user={user} /></details>;
}

function PasswordControl({value,onChange,visible,onToggle}:{value:string;onChange:(value:string)=>void;visible:boolean;onToggle:()=>void}) {
 const [copied,setCopied]=useState(false);
 return <div className={styles.passwordControl}>
   <input aria-label="Password" type={visible?"text":"password"} required minLength={8} maxLength={128} autoComplete="new-password" value={value} onChange={event=>{setCopied(false);onChange(event.target.value);}} />
   <div className={styles.passwordActions}>
     <button type="button" className={styles.passwordVisibility} aria-label={visible?"Hide password":"Show password"} onClick={onToggle}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}<span>{visible?"Hide":"Show"}</span></button>
     <button type="button" className={styles.passwordCopy} disabled={!value} aria-label="Copy password" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);}catch{setCopied(false);}}}><Copy size={18}/><span>{copied?"Copied":"Copy"}</span></button>
   </div>
 </div>;
}

function AccountSecurity({user}:{user:User}) {
 const [password,setPassword]=useState(""); const [showPassword,setShowPassword]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [verified,setVerified]=useState(Boolean(user.email_verified));
 async function run(action:string) { setBusy(true);setMessage("");try { await api(`/api/admin/users/${user.id}/security`,{method:"POST",body:JSON.stringify({action,...(action==="set-password"?{password}:{})})});setPassword("");if(action==="verify")setVerified(true);setMessage(action==="verify"?"Account verified.":action==="require-password-change"?"Password change required at next login.":"New password saved."); } catch(error){setMessage(error instanceof Error?error.message:"Could not update account.");}finally{setBusy(false);} }
 return <details className={styles.panel}><summary>Account verification & password<ChevronDown size={18}/></summary><div className={styles.invites}><p>{verified?"Verified account":"Email not yet verified"}{user.must_change_password?" · Password change required":""}</p>{message&&<p role="status">{message}</p>}{!verified&&<button type="button" disabled={busy} onClick={()=>void run("verify")}>Verify account</button>}<form onSubmit={event=>{event.preventDefault();void run("set-password");}}><label>Set new password<PasswordControl value={password} onChange={setPassword} visible={showPassword} onToggle={()=>setShowPassword(v=>!v)}/></label><p>Minimum 8 characters, one uppercase letter, and one special character. The new password works immediately.</p><button type="submit" className={styles.primary} disabled={busy}>Save new password</button></form></div></details>;
}

function AddressFields({value,onChange}:{value:Address;onChange:(address:Address)=>void}){return <><label>Street address<input autoComplete="street-address" maxLength={160} value={value.street} onChange={event=>onChange({...value,street:event.target.value})}/></label><label>City<input autoComplete="address-level2" maxLength={160} value={value.city} onChange={event=>onChange({...value,city:event.target.value})}/></label><label>State<input autoComplete="address-level1" maxLength={80} value={value.state} onChange={event=>onChange({...value,state:event.target.value})}/></label><label>ZIP code<input autoComplete="postal-code" maxLength={20} value={value.zip} onChange={event=>onChange({...value,zip:event.target.value})}/></label></>}
function BrandingEditor({organization,busy,onSave,onRemoveIcon,onDelete}:{organization:Organization;busy:boolean;onSave:(name:string,theme:string,file:File|null,address:Address)=>Promise<void>;onRemoveIcon:()=>Promise<void>;onDelete:()=>void}){
 const [name,setName]=useState(organization.name);const [theme,setTheme]=useState(organization.theme||"");const [file,setFile]=useState<File|null>(null);const [address,setAddress]=useState<Address>(organization.address||emptyAddress());
 return <details className={styles.member}><summary><OrganizationBadge name={organization.name} iconUrl={organization.iconUrl} hidden={organization.hideIcon}/><strong>{organization.name}</strong><ChevronDown size={18}/></summary><form onSubmit={event=>{event.preventDefault();void onSave(name,theme,file,address);}}><label>Organization name<input aria-label={`${organization.name} name`} required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><AddressFields value={address} onChange={setAddress}/><label>Color scheme<select value={theme} onChange={event=>setTheme(event.target.value)}><ThemeChoices/></select></label><label>Replace organization icon<input aria-label={`${organization.name} icon`} type="file" accept="image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)}/></label><p>Transparent PNG or WebP up to 3 MB. Recommended 512 × 512; full logo fits without cropping.</p><div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy}>Save organization</button><button type="button" disabled={busy||organization.hideIcon} onClick={()=>{setFile(null);void onRemoveIcon();}}>Remove icon</button><button type="button" disabled={busy||organization.name.trim().toLowerCase()==="walker automotive"} onClick={onDelete}>Delete organization</button></div></form></details>;
}
