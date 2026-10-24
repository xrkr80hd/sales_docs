"use client";

import { SoftwareLogo } from "@/components/branding/software-logo";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Home, FilePlus2, Files, Wrench, MessageCircle, Settings, Table2, Monitor, CalendarDays, Menu, X, ChevronDown, Shield, LogOut, GraduationCap } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { ROLE_LABELS } from "@/lib/workspace-roles";
import { OrganizationBadge } from "./organization-badge";
import { CustomerCopyPanel } from "./customer-copy-panel";
import { ConsultantLinksNav } from "@/components/consultant-links/links-nav";
import { useMessengerUnread } from "@/components/messenger/unread-context";
import styles from "./workspace.module.css";


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
  const {total:messageUnread}=useMessengerUnread();
  const mobile = useSyncExternalStore(subscribeMobile,mobileSnapshot,serverMobileSnapshot);
  const identity = useWorkspaceIdentity();
  const session = useSession();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [districtUnread, setDistrictUnread] = useState(0);
  const manager = identity?.workspaceRole === "bdm" || identity?.role === "sales_manager" || identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const admin = identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const display = pathname === "/office-display";
  useEffect(() => {
    const updated = (event: Event) => setDistrictUnread(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener("district-notifications-updated", updated);
    return () => window.removeEventListener("district-notifications-updated", updated);
  }, []);

  const links = manager && (pathname.startsWith("/manager-board") || pathname === "/office-display" || (pathname.startsWith("/role-views/") && pathname !== "/role-views/user")) ? [
    { label: "Deal Commander", href: "/dashboard", icon: Home },
        { label: "Sales Commander Stats", href: "/manager-board/sale-commander", icon: Table2 },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ] : [
    { label: "Deal Commander", href: "/dashboard", icon: Home },
    { label: "Start a Deal", href: "/dashboard#start-deal", icon: FilePlus2 },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ];
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
          <details><summary><span className={styles.profilePhoto}><span className={styles.avatar}>{identity?.profileImageUrl ? <Image src={identity.profileImageUrl} alt="Your profile" width={54} height={54} unoptimized /> : identity?.displayName?.charAt(0) || "—"}</span>{identity?.dealership&&<OrganizationBadge name={identity.dealership} iconUrl={identity.organizationIconUrl} hidden={identity.organizationHideIcon}/>}</span><div><small>Signed in as</small><strong>{identity?.displayName || session.sessionLabel || "Checking session"}</strong><small>{admin ? "Master Admin" : manager ? "Sales Manager" : identity?.role === "fni" ? "Finance" : "Sales Consultant"}</small></div><ChevronDown size={18} /></summary><div className={styles.accountMenu}><button onClick={onSettings}>Consultant Setup</button><button onClick={session.signOut}>Sign Out</button></div></details>
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
            <Link prefetch={false} href="/consultant-setup" onClick={close} className={`${styles.navLink} ${pathname === "/consultant-setup" ? styles.active : ""}`}><Settings />Consultant Setup</Link>
            {links.map(({ label, href, icon: Icon }) => <Fragment key={href}><Link prefetch={false} href={href} onClick={close} className={`${styles.navLink} ${pathname === href ? styles.active : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon />{label}</Link>{href === "/dashboard"&&<><ConsultantLinksNav onNavigate={close}/><CustomerCopyPanel/></>}</Fragment>)}
            {manager&&<details open={pathname.startsWith("/manager-board")}><summary><Table2/>Manager Board</summary><div className={styles.subnav}><Link prefetch={false} href="/manager-board" onClick={close} aria-current={pathname==="/manager-board"?"page":undefined}>Setup</Link><Link prefetch={false} href="/manager-board/display" onClick={close} aria-current={pathname==="/manager-board/display"?"page":undefined}>Performance Display</Link></div></details>}
            <details open={pathname === "/business-card" || pathname === "/vehicle-collage" || pathname.startsWith("/consultant-links") || pathname.startsWith("/sale-commander")}><summary><Wrench />Consultant Tools</summary><div className={styles.subnav}>{[["Business Card", "/business-card"], ["Vehicle Collage", "/vehicle-collage"], ["Sale Commander", "/sale-commander"], ["Fun Facts · Sales Numbers", "/sale-commander/fun-facts"]].map(([label, href]) => <Link prefetch={false} key={href} href={href} onClick={close}>{label}</Link>)}</div></details>
            <Link prefetch={false} href="/training" onClick={close} className={`${styles.navLink} ${pathname === "/training" ? styles.active : ""}`}><GraduationCap />Training</Link>
            <Link prefetch={false} href="/messenger" onClick={close} className={`${styles.navLink} ${pathname === "/messenger" ? styles.active : ""}`}><MessageCircle />Messenger</Link>
            <Link prefetch={false} href="/documents" onClick={close} className={`${styles.navLink} ${pathname === "/documents" ? styles.active : ""}`}><Files />Documents</Link>
            {pathname.startsWith("/deal-sheet") && <button onClick={() => { close(); onDocuments(); }} className={styles.navButton}><FilePlus2 />Deal Documents</button>}
            {manager && <Link prefetch={false} href="/manager-board#team-schedule" onClick={close} className={styles.navLink}><CalendarDays />Team Schedule</Link>}
            <button onClick={() => { close(); session.signOut(); }} className={styles.navButton}><LogOut />Sign Out</button>
            {admin && <details open={pathname.startsWith("/role-views/")}><summary><Shield />Role Views</summary><div className={styles.subnav}>{(["user", "floor_manager", "sales_manager", "fni", "district_manager", "bdm"] as const).map(role => <Link prefetch={false} key={role} href={`/role-views/${role}`} onClick={close} aria-current={pathname === `/role-views/${role}` ? "page" : undefined}>{ROLE_LABELS[role]}{role === "district_manager" && districtUnread > 0 && <span className={styles.roleUnread}>{districtUnread}</span>}</Link>)}</div></details>}
            {!admin && identity?.workspaceRole && identity.workspaceRole !== "user" && <Link prefetch={false} href={`/role-views/${identity.workspaceRole}`} onClick={close} className={styles.navLink}><Table2 />My Role View{identity.workspaceRole === "district_manager" && districtUnread > 0 && <span className={styles.roleUnread}>{districtUnread}</span>}</Link>}
            {admin && <details><summary><Shield />Administration</summary><div className={styles.subnav}><Link prefetch={false} href="/admin" onClick={close}>People &amp; Organizations</Link><Link prefetch={false} href="/admin/messenger" onClick={close}>Messenger Permissions</Link></div></details>}
          </nav>
        </aside>
      </>}
      <main className={`${styles.main} ${pathname === "/messenger" ? styles.messengerMain : ""} ${pathname === "/manager-board/display" ? styles.performanceMain : ""} ${pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet") ? styles.formMain : ""}`}>{children}</main>
    </div>
  </div>;
}
