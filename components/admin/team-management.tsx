"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Plus, Search, Users, ChevronDown } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ROLE_LABELS, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/workspace-roles";
import styles from "./team-management.module.css";

type Organization = { id: string; name: string };
type User = { id: string; display_name: string; email: string; role: string; workspace_role?: WorkspaceRole; card_enabled?: boolean; card_slug?: string };
type Membership = { user_id: string; organization_id: string; chat_enabled: boolean; can_dm: boolean; can_org_chat: boolean };
type Invite = { id: string; email: string; role: string; accepted_at?: string };
async function api(path: string, init?: RequestInit) {
  let token = "";
  try { token = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token || ""; } catch { /* The server owns authorization. */ }
  const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
export function TeamManagement() {
  const [organizations,setOrganizations] = useState<Organization[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [memberships,setMemberships] = useState<Membership[]>([]);
  const [invites,setInvites] = useState<Invite[]>([]);
  const [search,setSearch] = useState("");
  const [organization,setOrganization] = useState("");
  const [error,setError] = useState("");
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [newOrg,setNewOrg] = useState("");
  const [newUser,setNewUser] = useState({ name: "", email: "", role: "user" as WorkspaceRole, organizationId: "", cardEnabled: true, chatEnabled: true, canDm: true, canOrgChat: true });
  const load = useCallback(async () => {
    try {
      const [team,directory,invitations] = await Promise.all([api("/api/admin/users"),api("/api/admin/messenger"),api("/api/admin/invites")]);
      setUsers(team.users); setOrganizations(directory.organizations); setMemberships(directory.memberships); setInvites(invitations.invites); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load users."); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); },[load]);
  async function perform(operation: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setStatus("");
    try { await operation(); await load(); setStatus(message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); }
    finally { setBusy(false); }
  }
  const shown = users.filter(user => `${user.display_name} ${user.email}`.toLowerCase().includes(search.toLowerCase()) && (!organization || memberships.some(member => member.user_id === user.id && member.organization_id === organization)));
  return <div className={styles.page}>
    <header className={styles.heading}><p>MASTER ADMIN</p><h1>People & Organizations</h1><span>Manage your team, access, and dealership assignments.</span></header>
    {error && <p className={styles.error} role="alert">{error}</p>}{status && <p className={styles.status} role="status">{status}</p>}
    <div className={styles.topGrid}>
      <details className={styles.panel}><summary><Users size={20} />Add a user<Plus size={18} /></summary><form onSubmit={(event: FormEvent) => { event.preventDefault(); void perform(async () => { await api("/api/admin/workspace", { method: "POST", body: JSON.stringify({ action: "create-user", ...newUser }) }); setNewUser(current => ({ ...current, name: "", email: "" })); }, "User created, storage bucket provisioned, and invitation sent."); }}>
        <label>Name<input required value={newUser.name} onChange={event => setNewUser(current => ({ ...current,name:event.target.value }))} /></label>
        <label>Email<input required type="email" value={newUser.email} onChange={event => setNewUser(current => ({ ...current,email:event.target.value }))} /></label>
        <label>Role<select value={newUser.role} onChange={event => setNewUser(current => ({ ...current,role:event.target.value as WorkspaceRole }))}>{WORKSPACE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <label>Organization<select required value={newUser.organizationId} onChange={event => setNewUser(current => ({ ...current,organizationId:event.target.value }))}><option value="">Choose a dealership</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        {([['cardEnabled','Consultant card'],['chatEnabled','Messenger'],['canDm','Direct messages'],['canOrgChat','Team chat']] as const).map(([field,label]) => <label className={styles.check} key={field}><input type="checkbox" checked={newUser[field]} onChange={event => setNewUser(current => ({ ...current,[field]:event.target.checked }))} />{label}</label>)}
        <p>Creates the account and its media bucket, then emails a sign-in invitation.</p><button disabled={busy} className={styles.primary}>Add user & send invitation</button>
      </form></details>
      <details className={styles.panel}><summary><Building2 size={20} />Add an organization<Plus size={18} /></summary><form onSubmit={event => { event.preventDefault(); void perform(async () => { await api("/api/admin/workspace", { method: "POST",body:JSON.stringify({action:"create-organization",name:newOrg}) }); setNewOrg(""); }, "Organization created."); }}><label>Organization name<input required value={newOrg} onChange={event => setNewOrg(event.target.value)} /></label><button className={styles.primary} disabled={busy}>Create organization</button></form></details>
    </div>
    <section className={styles.panel}><div className={styles.filters}><label><Search size={16} /><input placeholder="Find a team member" aria-label="Find a team member" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filter organization" value={organization} onChange={event => setOrganization(event.target.value)}><option value="">All organizations</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
      <div className={styles.listHeading}><h2>Your team</h2><span>{loading ? "Loading…" : `${shown.length} people`}</span></div>
      {shown.map(user => <Member key={`${user.id}:${user.workspace_role || user.role}:${user.card_enabled}:${JSON.stringify(memberships.find(member => member.user_id === user.id))}`} user={user} member={memberships.find(member => member.user_id === user.id)} organizations={organizations} busy={busy} onSave={(role,cardEnabled,member) => perform(async () => { await api(`/api/admin/users/${user.id}`,{method:"PATCH",body:JSON.stringify({...(user.email.toLowerCase() === "xrkr80hd@gmail.com" || role === (user.workspace_role || user.role) ? {} : {role}),card_enabled:cardEnabled})}); if (member.organization_id) await api("/api/admin/messenger",{method:"POST",body:JSON.stringify({userId:user.id,organizationId:member.organization_id,chatEnabled:member.chat_enabled,canDm:member.can_dm,canOrgChat:member.can_org_chat})}); }, "Role, permissions, and organization saved.")} onRemove={() => { if (window.confirm(`Remove ${user.email}? This deletes their account.`)) void perform(() => api(`/api/admin/users/${user.id}`, { method:"DELETE" }), "Account removed."); }} />)}
      {!loading && shown.length === 0 && <p className={styles.empty}>No matching users.</p>}
    </section>
    <details className={styles.panel}><summary>Invitations<ChevronDown size={18} /></summary><div className={styles.invites}>{invites.map(invite => <div key={invite.id}><span>{invite.email}</span><small>{invite.accepted_at ? "Accepted" : "Pending"}</small>{!invite.accepted_at && <button disabled={busy} onClick={() => { if (window.confirm(`Revoke ${invite.email}'s invitation?`)) void perform(() => api(`/api/admin/invites/${invite.id}`,{method:"DELETE"}),"Invitation revoked."); }}>Revoke</button>}</div>)}{invites.length === 0 && <p>No invitations.</p>}</div></details>
  </div>;
}
function Member({user,member,organizations,busy,onSave,onRemove}:{user:User;member?:Membership;organizations:Organization[];busy:boolean;onSave:(role:WorkspaceRole,card:boolean,member:Membership)=>Promise<void>;onRemove:()=>void}) {
  const [role,setRole] = useState<WorkspaceRole>(user.workspace_role || user.role as WorkspaceRole);
  const [card,setCard] = useState(Boolean(user.card_enabled));
  const [assignment,setAssignment] = useState<Membership>(member || {user_id:user.id,organization_id:"",chat_enabled:false,can_dm:false,can_org_chat:false});
  const owner = user.email.toLowerCase() === "xrkr80hd@gmail.com";
  return <details className={styles.member}><summary><div><strong>{user.display_name || user.email}</strong><small>{user.email}</small></div><div><span>{ROLE_LABELS[role]}</span><small>{organizations.find(org => org.id === member?.organization_id)?.name || "Unassigned"}</small></div><ChevronDown size={18} /></summary><form onSubmit={event => {event.preventDefault(); void onSave(role,card,assignment);}}><fieldset disabled={busy}><div className={styles.editGrid}><label>Role<select disabled={owner} value={role} onChange={event=>setRole(event.target.value as WorkspaceRole)}>{WORKSPACE_ROLES.map(role=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><label>Organization<select required value={assignment.organization_id} onChange={event=>setAssignment(current=>({...current,organization_id:event.target.value}))}><option value="">Choose a dealership</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label></div><label className={styles.check}><input type="checkbox" checked={card} onChange={event=>setCard(event.target.checked)} />Consultant card</label>{([['chat_enabled','Messenger'],['can_dm','Direct messages'],['can_org_chat','Team chat']] as const).map(([field,label])=><label className={styles.check} key={field}><input type="checkbox" disabled={owner} checked={assignment[field]} onChange={event=>setAssignment(current=>({...current,[field]:event.target.checked}))} />{label}</label>)}<div className={styles.actions}><button className={styles.primary}>Save access</button>{user.card_slug && <><Link href={`/card/${user.card_slug}`} target="_blank">View card</Link><button type="button" onClick={()=>{ void navigator.clipboard.writeText(`${window.location.origin}/card/${user.card_slug}`); }}>Copy card link</button></>}{!owner && <button type="button" onClick={onRemove}>Remove user</button>}</div></fieldset></form></details>;
}
