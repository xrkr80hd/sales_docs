"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { useWorkspaceIdentity } from "./workspace-context";
import dynamic from "next/dynamic";
const SaleCommander=dynamic(()=>import("./sale-commander").then(module=>module.SaleCommander));
const ManagerBoard=dynamic(()=>import("./team-board").then(module=>module.ManagerBoard));
import { useSession } from "@/components/auth/supabase-session-gate";
import { requestJson } from "@/lib/request-json";
import { loadDealFromServer, setLocalDealId, consumeStartFreshDeal, claimSmDeal, claimFniDeal } from "@/lib/deals";
import { saveWorkflow, saveSignatures } from "@/lib/walker-workflow";
import { ROLE_LABELS, validWorkspaceRole, type WorkspaceRole } from "@/lib/workspace-roles";
import { OrganizationBadge } from "./organization-badge";
import { organizationThemeStyle } from "@/lib/organization-theme";
import type { MonthBoard, ProjectionEvent } from "@/lib/manager-board";
import { boardRequest } from "./use-shared-board";
import styles from "./workspace.module.css";

type QueueItem = { id: string; deal_number?: string; workflow_data: Record<string,string>; claimer?: {display_name:string}; sm_sent_at?:string; fni_sent_at?:string };
type Directory = { organizations: {id:string;name:string;iconUrl?:string;theme?:string;hideIcon?:boolean}[]; memberships:{organization_id:string;user_id:string}[]; users:{id:string;display_name:string;role:string}[] };
export function RoleView({ role }: {role:string}) {
  const identity = useWorkspaceIdentity();
  const {accessToken}=useSession();
  const identityId=identity?.id;
  const router = useRouter();
  const [queue,setQueue] = useState<QueueItem[]>([]);
  const [directory,setDirectory] = useState<Directory | null>(null);
  const [stores,setStores] = useState<Record<string,MonthBoard>>({});
  const [notifications,setNotifications] = useState<(ProjectionEvent & {organizationId:string;month?:string;version?:string})[]>([]);
  const [toast,setToast] = useState("");
  const seenUpdates = useRef<Set<string>>(new Set());
  const updatesLoaded = useRef(false);
  const [organization,setOrganization] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const admin = identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const allowed = admin || identity?.workspaceRole === role || identity?.role === role;
  useEffect(() => {
    if (!identityId || !allowed || !accessToken || role === "user" || role === "bdm") return;
    let active = true, pending = false;
    async function load() {
      if(pending)return;pending=true;
      setLoading(true); setError("");
      try {
        if (role === "user" || role === "bdm") return;
        const path = role === "district_manager" ? "/api/workspace/directory" : role === "fni" ? "/api/workspace/queue?type=fni" : "/api/workspace/queue?type=sm";
        const headers={Authorization:`Bearer ${accessToken}`};
        const [result,boards]=await Promise.all([
          requestJson<Directory & {deals?:QueueItem[]}>(path,{headers}),
          role === "district_manager" ? requestJson<{stores:Record<string,MonthBoard>;notifications:(ProjectionEvent & {organizationId:string;month?:string;version?:string})[]}>("/api/manager-board?district=1",{headers}) : Promise.resolve(null),
        ]);
        if (!active) return;
        if (role === "district_manager" && boards) {
          setDirectory(result);
          window.dispatchEvent(new CustomEvent("district-notifications-updated",{detail:boards.notifications.length}));
          if(active){
            setStores(boards.stores);setNotifications(boards.notifications);
            const fresh=boards.notifications.filter((event:ProjectionEvent)=>!seenUpdates.current.has(event.id));
            if(updatesLoaded.current&&fresh.length){const newest=fresh[fresh.length-1];const store=result.organizations.find((org:{id:string})=>org.id===newest.organizationId)?.name||"Dealership";setToast(`${store}: ${newest.type==="sale-update"?`${newest.consultantName} sold count updated to ${newest.next}`:newest.type==="weekly-update"?"New weekly update":`${newest.consultantName}'s projection changed to ${newest.next}`}`);}
            seenUpdates.current=new Set(boards.notifications.map((event:ProjectionEvent)=>event.id));updatesLoaded.current=true;
          }
        } else setQueue(result.deals || []);
      } catch (failure) { if(active) setError(failure instanceof Error ? failure.message : "Could not load this view."); }
      finally { pending=false;if(active) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => {if(document.visibilityState==="visible")void load();},60000);
    return () => {active=false;window.clearInterval(timer);};
  },[role,identityId,allowed,accessToken]);
  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(""),7000);return()=>window.clearTimeout(timer);},[toast]);
  async function openDeal(id:string) {
    setBusy(id);setError("");
    try {
      const deal=await loadDealFromServer(id);
      if(!deal) throw new Error("Could not open this deal. Try again.");
      consumeStartFreshDeal();saveWorkflow(deal.workflow_data);saveSignatures(deal.signatures);setLocalDealId(deal.id);
      router.push(deal.workflow_data.dealType === "new" ? "/deal-sheet/new" : "/deal-sheet");
    } catch(failure) {setError(failure instanceof Error?failure.message:"Could not open this deal.");}
    finally {setBusy("");}
  }
  async function claim(id:string) {
    setBusy(id);setError("");
    const ok=await (role==="fni"?claimFniDeal(id):claimSmDeal(id));
    if(ok) await openDeal(id);else {setError("Could not claim this deal. It may already be assigned.");setBusy("");}
  }
  if(!validWorkspaceRole(role) || role === "admin") return <p className={styles.notice}>Unknown role view.</p>;
  if(!identity) return <p className={styles.notice}>Checking your access…</p>;
  if(!allowed) return <p className={styles.notice}>You do not have access to this role view.</p>;
  if(role==="user") return <><p className={styles.notice}>Consultant view{admin ? " · Master Admin access retained" : ""}</p><SaleCommander /></>;
  if(role==="bdm") return <><header><h1 className={styles.pageTitle}>BDM</h1><p>Read-only manager board statistics for your assigned organization.</p></header><ManagerBoard /></>;
  const selected=directory?.organizations.find(org=>org.id===organization);
  const assigned=directory?.memberships.filter(member=>member.organization_id===organization).map(member=>directory.users.find(user=>user.id===member.user_id)).filter(Boolean) || [];
  return <div className="grid gap-5">
    <header><p className={styles.eyebrow}>{admin ? "MASTER ADMIN · ROLE VIEWS" : "YOUR WORKSPACE"}</p><h1 className={styles.pageTitle}>{ROLE_LABELS[role as WorkspaceRole]}</h1><div className={styles.underline}/><p className={styles.subtitle}>{role==="district_manager" ? "All organizations at a glance." : role==="fni" ? "Deals ready for finance." : "Your active review queue."}</p></header>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {role==="district_manager" ? <>
      {notifications.length > 0 && <section className={styles.panel}><div className={styles.panelHeader}><h2>Updates · {notifications.length} unread</h2></div>{notifications.map(event => <article key={event.id} className={styles.weeklyUpdate}><strong>{event.type === "weekly-update" ? "Weekly update" : event.type === "sale-update" ? `${event.consultantName}: sold count ${event.previous} → ${event.next}` : `${event.consultantName}: projection ${event.previous} → ${event.next}`}</strong><p>{directory?.organizations.find(org=>org.id===event.organizationId)?.name} · {event.by} · {new Date(event.at).toLocaleString()}</p><p>{event.type === "projection-change" ? "Reason: " : ""}{event.reason}</p><button className={styles.textLink} disabled={Boolean(busy)} onClick={()=>{setBusy(event.id);void boardRequest(event.organizationId,{action:"read-notification",eventId:event.id,version:event.version||stores[event.organizationId]?.publishedAt},event.month).then(result=>{setNotifications(current=>current.filter(item=>item.id!==event.id).map(item=>item.organizationId===event.organizationId&&item.month===event.month?{...item,version:result.version}:item));setStores(current=>({...current,[event.organizationId]:{...current[event.organizationId],publishedAt:result.version}}));window.dispatchEvent(new Event("manager-board-updated"));}).catch(failure=>setError(failure.message)).finally(()=>setBusy(""));}}>Mark read</button></article>)}</section>}
      <div className={styles.storeGrid}>{directory?.organizations.map(org=><button key={org.id} style={organizationThemeStyle(org.name,org.theme)} className={`${styles.storeCard} ${organization===org.id?styles.selectedStore:""}`} onClick={()=>setOrganization(org.id)}><OrganizationBadge name={org.name} iconUrl={org.iconUrl} hidden={org.hideIcon}/><strong>{org.name}</strong><span><Users size={16}/>{directory.memberships.filter(member=>member.organization_id===org.id).length} team members</span><ArrowRight/>{stores[org.id]&&<span className="col-span-2">New {stores[org.id].newGoal} · Used {stores[org.id].usedGoal} · MTD {Object.values(stores[org.id].rows).reduce((sum,row)=>sum+row.mtd,0)}</span>}</button>)}</div>
      {!loading && directory?.organizations.length===0 && <p className={styles.notice}>No organizations yet. Add one in People & Organizations.</p>}
      {selected && <section style={organizationThemeStyle(selected.name,selected.theme)} className={styles.panel}><div className={styles.panelHeader}><h2><OrganizationBadge name={selected.name} iconUrl={selected.iconUrl} hidden={selected.hideIcon}/>{selected.name}</h2><Link prefetch={false} href={`/manager-board?organization=${selected.id}`} className={styles.textLink}>Open store board</Link>{admin && <Link prefetch={false} href="/admin" className={styles.textLink}>Manage team</Link>}</div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Team member</th><th>Role</th></tr></thead><tbody>{assigned.map(user=>user&&<tr key={user.id}><td>{user.display_name || "Unnamed account"}</td><td>{ROLE_LABELS[user.role as WorkspaceRole] || user.role}</td></tr>)}{assigned.length===0&&<tr><td colSpan={2}>No team members assigned.</td></tr>}</tbody></table></div><p className={`${styles.muted} mt-4`}>{stores[selected.id] ? `Monthly gross objective: ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(stores[selected.id].monthlyGross)} · Yearly gross objective: ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(stores[selected.id].yearlyGross)}` : "No objectives published for this month yet."}</p></section>}
    </> : <section className={styles.panel}><div className={styles.panelHeader}><h2>{role==="fni"?"F&I":"Manager"} Queue</h2><span className={styles.muted}>{queue.length} deals</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Customer / deal</th><th>Vehicle</th><th>Assigned to</th><th>Action</th></tr></thead><tbody>{queue.map(deal=><tr key={deal.id}><td>{deal.workflow_data.customerName || deal.deal_number || "Deal"}</td><td>{[deal.workflow_data.vehicleYear,deal.workflow_data.vehicleMake,deal.workflow_data.vehicleModel].filter(Boolean).join(" ")}</td><td>{deal.claimer?.display_name || "Unassigned"}</td><td><button disabled={Boolean(busy)} className={styles.textLink} onClick={()=>void openDeal(deal.id)}>Open</button>{!deal.claimer && <button disabled={Boolean(busy)} className={`${styles.textLink} ml-4`} onClick={()=>void claim(deal.id)}>Claim & open</button>}</td></tr>)}{!loading&&queue.length===0&&<tr><td colSpan={4}>{error ? "Queue unavailable." : "No deals waiting for review."}</td></tr>}</tbody></table></div></section>}
    {toast && <div className={styles.updateToast} role="status"><strong>District update</strong><p>{toast}</p><button aria-label="Dismiss update notification" onClick={()=>setToast("")}>Dismiss</button></div>}
    {loading && <p className={styles.muted}>Loading current data…</p>}
    {role==="sales_manager"&&<ManagerBoard/>}
  </div>;
}
