"use client";

import { SoftwareLogo } from "@/components/branding/software-logo";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Home, FilePlus2, Files, Wrench, MessageCircle, Settings, Table2, Monitor, CalendarDays, Menu, X, ChevronDown, Shield, LogOut, GraduationCap } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { ROLE_LABELS, validWorkspaceRole } from "@/lib/workspace-roles";
import { OrganizationBadge } from "./organization-badge";
import { CustomerCopyPanel } from "./customer-copy-panel";
import { ConsultantLinksNav } from "@/components/consultant-links/links-nav";
import { useMessengerUnread } from "@/components/messenger/unread-context";
import styles from "./workspace.module.css";


function subscribeView(callback: () => void) {
  window.addEventListener("workspace-view-changed", callback);
  return () => window.removeEventListener("workspace-view-changed", callback);
}
function readView(key: string) {
  try { const value = window.sessionStorage.getItem(key); return validWorkspaceRole(value) ? value : "user"; } catch { return "user"; }
}
function writeView(key: string, value: string) {
  try { if (window.sessionStorage.getItem(key) === value) return; window.sessionStorage.setItem(key, value); } catch { return; }
  window.dispatchEvent(new Event("workspace-view-changed"));
}

function subscribeMobile(callback:()=>void){const media=window.matchMedia("(max-width: 680px)");media.addEventListener("change",callback);return()=>media.removeEventListener("change",callback);}
function mobileSnapshot(){return window.matchMedia("(max-width: 680px)").matches;}
function serverMobileSnapshot(){return false;}

function WorkspaceClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { let timer=window.setTimeout(function tick(){setNow(new Date());timer=window.setTimeout(tick,60000-Date.now()%60000);},0);return()=>window.clearTimeout(timer); }, []);
  return <div className={styles.clock}><small>{now?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) || ""}</small><strong>{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) || ""}</strong></div>;
}

export function WorkspaceShell({ children, onSettings, onDocuments }: { children: ReactNode; onSettings: () => void; onDocuments: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const {total:messageUnread}=useMessengerUnread();
  const mobile = useSyncExternalStore(subscribeMobile,mobileSnapshot,serverMobileSnapshot);
  const identity = useWorkspaceIdentity();
  const session = useSession();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const manager = identity?.workspaceRole === "bdm" || identity?.role === "sales_manager" || identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const admin = identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const display = pathname === "/office-display";
  const viewKey = `nextdocs.workspace-view.v1:${identity?.id || ""}`;
  const storedView = useSyncExternalStore(subscribeView, () => readView(viewKey), () => "user");
  const routeRole = pathname.startsWith("/role-views/") ? pathname.split("/")[2] : null;
  const consultantPage = ["/dashboard", "/sale-commander", "/consultant-setup", "/deal-commander", "/deals", "/business-card", "/vehicle-collage", "/training"].includes(pathname) || pathname.startsWith("/consultant-links");
  const activeView = routeRole && validWorkspaceRole(routeRole) ? routeRole
    : pathname.startsWith("/admin") ? "admin"
    : pathname.startsWith("/manager-board") ? (["sales_manager", "floor_manager", "district_manager", "bdm"].includes(storedView) ? storedView : "sales_manager")
    : consultantPage ? "user" : storedView;
  const consultantView = activeView === "user";
  const managementView = manager && ["sales_manager", "floor_manager", "district_manager", "bdm"].includes(activeView);
  const availableViews = admin ? ["user", "floor_manager", "sales_manager", "district_manager", "bdm", "fni", "admin"] : ["user", ...(identity?.workspaceRole && identity.workspaceRole !== "user" ? [identity.workspaceRole] : identity?.role && identity.role !== "user" ? [identity.role] : [])];
  useEffect(() => { writeView(viewKey, activeView); }, [viewKey, activeView]);
  function switchView(role: string) {
    if (!availableViews.includes(role)) return;
    writeView(viewKey, role);
    router.push(role === "user" ? "/dashboard" : role === "admin" ? "/admin" : `/role-views/${role}`);
    setNavigationOpen(false);
  }
  const close = () => setNavigationOpen(false);
  if(display)return <div className="nxt-ui">{children}</div>;
  return <div className={`nxt-ui ${styles.shell}`}>
    <header className={styles.header}>
      <div className={styles.brands}>
        <Link prefetch={false} href="/dashboard" className={styles.wordmark} aria-label="NXTDOX home"><SoftwareLogo /></Link>
        <Image src="/branding/walker-automotive.png" alt="Walker Automotive" width={320} height={116} className={styles.dealerLogo} priority />
      </div>
      {display ? <div className={styles.displayActions}><div className={styles.displayLabel}><Monitor /><div>Performance Display<small>Read only · Live updates</small></div></div><Link prefetch={false} href="/manager-board" className={styles.exitDisplay} aria-label="Close Performance Display and return to Manager Board"><X size={22}/><span>Close</span></Link></div> : <>
        <Link prefetch={false} href="/messenger" className={styles.messageIndicator} aria-label={messageUnread ? `${messageUnread} unread messages. Open Messenger` : "Open Messenger. No unread messages"}><MessageCircle aria-hidden="true"/>{messageUnread>0&&<span aria-hidden="true">{messageUnread>99?"99+":messageUnread}</span>}</Link>
        <div className={styles.identity}>
          <details><summary><span className={styles.profilePhoto}><span className={styles.avatar}>{identity?.profileImageUrl ? <Image src={identity.profileImageUrl} alt="Your profile" width={54} height={54} unoptimized /> : identity?.displayName?.charAt(0) || "—"}</span>{identity?.dealership&&<OrganizationBadge name={identity.dealership} iconUrl={identity.organizationIconUrl} hidden={identity.organizationHideIcon}/>}</span><div><small>Signed in as</small><strong>{identity?.displayName || session.sessionLabel || "Checking session"}</strong><small>{admin ? "Master Admin" : manager ? "Sales Manager" : identity?.role === "fni" ? "Finance" : "Sales Consultant"}</small></div><ChevronDown size={18} /></summary><div className={styles.accountMenu}>{(admin || availableViews.length > 1) && <label className={styles.viewPicker}>Workspace view <select aria-label="Workspace view" value={activeView} onChange={event => switchView(event.target.value)}>{availableViews.filter(validWorkspaceRole).map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>}<button onClick={onSettings}>Consultant Setup</button><button onClick={session.signOut}>Sign Out</button></div></details>

          <WorkspaceClock />
        </div>
        <button className={styles.menuButton} aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu /></button>
      </>}
    </header>
    <div className={`${styles.body} ${display ? styles.displayBody : !mobile&&sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
      {!display && <>
        {!mobile&&<button type="button" className={`${styles.sidebarToggle} ${sidebarCollapsed?styles.toggleClosed:""}`} aria-label={sidebarCollapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!sidebarCollapsed} aria-controls="workspace-navigation" onClick={()=>setSidebarCollapsed(value=>!value)}><span className={styles.toggleTriangle}/></button>}
        {navigationOpen && <button className={styles.scrim} onClick={close} aria-label="Close navigation" />}
        <aside id="workspace-navigation" className={`${styles.sidebar} ${navigationOpen ? styles.sidebarOpen : ""} ${!mobile&&sidebarCollapsed?styles.collapsedSidebar:""}`} aria-label="Application navigation" inert={mobile ? !navigationOpen : sidebarCollapsed}>
          <button className={styles.closeButton} onClick={close} aria-label="Close navigation"><X /></button>
          <nav>
            {consultantView && <>
            <div role="group" aria-label="Sales Commander">
              <Link prefetch={false} href="/dashboard" onClick={close} className={`${styles.navLink} ${pathname === "/dashboard" || pathname === "/role-views/user" ? styles.active : ""}`}><Home />Sales Commander</Link>
              <div className={styles.subnav}>
                <details open={pathname === "/consultant-setup" || pathname === "/consultant-links/settings"}><summary><Settings />Setup</summary><div className={styles.subnav}><Link prefetch={false} href="/consultant-setup" onClick={close}>Consultant Setup</Link><Link prefetch={false} href="/consultant-links/settings" onClick={close}>Command Center Settings</Link></div></details>
                <ConsultantLinksNav onNavigate={close}/>
              </div>
            </div>
            <Link prefetch={false} href="/deal-commander" onClick={close} className={`${styles.navLink} ${pathname === "/deal-commander" ? styles.active : ""}`}><FilePlus2 />Start a Deal</Link>
            <Link prefetch={false} href="/deals" onClick={close} className={`${styles.navLink} ${pathname === "/deals" ? styles.active : ""}`}><Files />Resume Deal</Link>
            <CustomerCopyPanel/>
            <details open={pathname === "/business-card" || pathname === "/vehicle-collage" || pathname === "/sale-commander/fun-facts"}><summary><Wrench />Consultant Tools</summary><div className={styles.subnav}>{[["Business Card", "/business-card"], ["Vehicle Collage", "/vehicle-collage"], ["Fun Facts · Sales Numbers", "/sale-commander/fun-facts"]].map(([label, href]) => <Link prefetch={false} key={href} href={href} onClick={close}>{label}</Link>)}</div></details>
            <Link prefetch={false} href="/training" onClick={close} className={`${styles.navLink} ${pathname === "/training" ? styles.active : ""}`}><GraduationCap />Training</Link>
            </>}
            {managementView && <><Link prefetch={false} href={`/role-views/${activeView}`} onClick={close} className={styles.navLink}><Home />{validWorkspaceRole(activeView) ? ROLE_LABELS[activeView] : "Workspace"}</Link>{activeView !== "district_manager" && <details open={pathname.startsWith("/manager-board")}><summary><Table2 />Manager Board</summary><div className={styles.subnav}><Link prefetch={false} href="/manager-board" onClick={close}>Setup</Link><Link prefetch={false} href="/manager-board/display" onClick={close}>Performance Display</Link><Link prefetch={false} href="/manager-board/sale-commander" onClick={close}>Sales Commander Stats</Link><Link prefetch={false} href="/manager-board#team-schedule" onClick={close}><CalendarDays />Team Schedule</Link></div></details>}</>}
            {activeView === "fni" && <Link prefetch={false} href="/role-views/fni" onClick={close} className={styles.navLink}><Home />F&amp;I</Link>}
            <Link prefetch={false} href="/messenger" onClick={close} className={`${styles.navLink} ${pathname === "/messenger" ? styles.active : ""}`}><MessageCircle />Messenger</Link>
            <Link prefetch={false} href="/documents" onClick={close} className={`${styles.navLink} ${pathname === "/documents" ? styles.active : ""}`}><Files />Documents</Link>
            {pathname.startsWith("/deal-sheet") && <button onClick={() => { close(); onDocuments(); }} className={styles.navButton}><FilePlus2 />Deal Documents</button>}
            <button onClick={() => { close(); session.signOut(); }} className={styles.navButton}><LogOut />Sign Out</button>
            {admin && activeView === "admin" && <details open><summary><Shield />Administration</summary><div className={styles.subnav}><Link prefetch={false} href="/admin" onClick={close}>People &amp; Organizations</Link><Link prefetch={false} href="/admin/messenger" onClick={close}>Messenger Permissions</Link></div></details>}
          </nav>
        </aside>
      </>}
      <main className={`${styles.main} ${pathname === "/messenger" ? styles.messengerMain : ""} ${pathname === "/manager-board/display" ? styles.performanceMain : ""} ${pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet") ? styles.formMain : ""}`}>{children}</main>
    </div>
  </div>;
}
