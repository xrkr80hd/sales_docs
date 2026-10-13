"use client";

import { SoftwareLogo } from "@/components/branding/software-logo";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Home, FilePlus2, Files, Wrench, MessageCircle, Settings, Table2, Monitor, CalendarDays, Menu, X, ChevronDown, Shield, LogOut, GraduationCap } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { ROLE_LABELS } from "@/lib/workspace-roles";
import { OrganizationBadge } from "./organization-badge";
import { ConsultantLinksNav } from "@/components/consultant-links/links-nav";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import styles from "./workspace.module.css";


function subscribeMobile(callback:()=>void){const media=window.matchMedia("(max-width: 680px)");media.addEventListener("change",callback);return()=>media.removeEventListener("change",callback);}
function mobileSnapshot(){return window.matchMedia("(max-width: 680px)").matches;}
function serverMobileSnapshot(){return false;}

export function WorkspaceShell({ children, onSettings, onDocuments }: { children: ReactNode; onSettings: () => void; onDocuments: () => void }) {
  const pathname = usePathname();
  const mobile = useSyncExternalStore(subscribeMobile,mobileSnapshot,serverMobileSnapshot);
  const identity = useWorkspaceIdentity();
  const session = useSession();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [districtUnread, setDistrictUnread] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const manager = identity?.workspaceRole === "bdm" || identity?.role === "sales_manager" || identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const admin = identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const display = pathname === "/office-display";
  useEffect(() => {
    if (!admin && identity?.workspaceRole !== "district_manager") return;
    let active = true;
    async function loadNotifications() {
      try {
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        const response = await fetch("/api/manager-board?district=1", { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` }, cache: "no-store" });
        if (response.ok && active) setDistrictUnread((await response.json()).notifications?.length || 0);
      } catch { /* The role view provides detailed errors. */ }
    }
    const refresh = () => { void loadNotifications(); };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("manager-board-updated", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("manager-board-updated", refresh); };
  }, [admin, identity?.workspaceRole]);

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const links = manager ? [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Manager Board", href: "/manager-board", icon: Table2 },
    { label: "Sales Commander Stats", href: "/manager-board/sale-commander", icon: Table2 },
    { label: "Office Display", href: "/office-display", icon: Monitor },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ] : [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Start a Deal", href: "/dashboard#start-deal", icon: FilePlus2 },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ];
  const close = () => setNavigationOpen(false);
  return <div className={`nxt-ui ${styles.shell}`}>
    <header className={styles.header}>
      <div className={styles.brands}>
        <Link href="/dashboard" className={styles.wordmark} aria-label="NXTDOX home"><SoftwareLogo /></Link>
        <Image src="/branding/walker-automotive.png" alt="Walker Automotive" width={320} height={116} className={styles.dealerLogo} priority />
      </div>
      {display ? <div className={styles.displayLabel}><Monitor /><div>Office Display Board<small>Read only · Live updates</small></div></div> : <>
        <div className={styles.identity}>
          <details><summary><span className={styles.profilePhoto}><span className={styles.avatar}>{identity?.profileImageUrl ? <Image src={identity.profileImageUrl} alt="Your profile" width={54} height={54} unoptimized /> : identity?.displayName?.charAt(0) || "—"}</span>{identity?.dealership&&<OrganizationBadge name={identity.dealership} iconUrl={identity.organizationIconUrl} hidden={identity.organizationHideIcon}/>}</span><div><small>Signed in as</small><strong>{identity?.displayName || session.sessionLabel || "Checking session"}</strong><small>{admin ? "Master Admin" : manager ? "Sales Manager" : identity?.role === "fni" ? "Finance" : "Sales Consultant"}</small></div><ChevronDown size={18} /></summary><div className={styles.accountMenu}><button onClick={onSettings}>Consultant Setup</button><button onClick={session.signOut}>Sign Out</button></div></details>
          <div className={styles.clock}><small>{now?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) || ""}</small><strong>{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) || ""}</strong></div>
        </div>
        <button className={styles.menuButton} aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu /></button>
      </>}
    </header>
    <div className={`${styles.body} ${display ? styles.displayBody : ""}`}>
      {!display && <>
        {navigationOpen && <button className={styles.scrim} onClick={close} aria-label="Close navigation" />}
        <aside className={`${styles.sidebar} ${navigationOpen ? styles.sidebarOpen : ""}`} aria-label="Application navigation" inert={mobile && !navigationOpen}>
          <button className={styles.closeButton} onClick={close} aria-label="Close navigation"><X /></button>
          <nav>
            {links.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`${styles.navLink} ${pathname === href ? styles.active : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon />{label}</Link>)}
            <details open={pathname === "/business-card" || pathname === "/vehicle-collage" || pathname.startsWith("/consultant-links") || pathname.startsWith("/sale-commander")}><summary><Wrench />Consultant Tools</summary><div className={styles.subnav}><ConsultantLinksNav onNavigate={close} />{[["Business Card", "/business-card"], ["Vehicle Collage", "/vehicle-collage"], ["Sale Commander", "/sale-commander"], ["Fun Facts · Sales Numbers", "/sale-commander/fun-facts"]].map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}</Link>)}</div></details>
            <Link href="/training" onClick={close} className={`${styles.navLink} ${pathname === "/training" ? styles.active : ""}`}><GraduationCap />Training</Link>
            <Link href="/messenger" onClick={close} className={`${styles.navLink} ${pathname === "/messenger" ? styles.active : ""}`}><MessageCircle />Messenger</Link>
            <Link href="/documents" onClick={close} className={`${styles.navLink} ${pathname === "/documents" ? styles.active : ""}`}><Files />Documents</Link>
            {pathname.startsWith("/deal-sheet") && <button onClick={() => { close(); onDocuments(); }} className={styles.navButton}><FilePlus2 />Deal Documents</button>}
            {manager && <Link href="/manager-board#team-schedule" onClick={close} className={styles.navLink}><CalendarDays />Team Schedule</Link>}
            <button onClick={() => { close(); onSettings(); }} className={styles.navButton}><Settings />Consultant Setup</button>
            <button onClick={() => { close(); session.signOut(); }} className={styles.navButton}><LogOut />Sign Out</button>
            {admin && <details open><summary><Shield />Role Views</summary><div className={styles.subnav}>{(["user", "floor_manager", "sales_manager", "fni", "district_manager", "bdm"] as const).map(role => <Link key={role} href={`/role-views/${role}`} onClick={close} aria-current={pathname === `/role-views/${role}` ? "page" : undefined}>{ROLE_LABELS[role]}{role === "district_manager" && districtUnread > 0 && <span className={styles.roleUnread}>{districtUnread}</span>}</Link>)}</div></details>}
            {!admin && identity?.workspaceRole && identity.workspaceRole !== "user" && <Link href={`/role-views/${identity.workspaceRole}`} onClick={close} className={styles.navLink}><Table2 />My Role View{identity.workspaceRole === "district_manager" && districtUnread > 0 && <span className={styles.roleUnread}>{districtUnread}</span>}</Link>}
            {admin && <details><summary><Shield />Administration</summary><div className={styles.subnav}><Link href="/admin" onClick={close}>People &amp; Organizations</Link><Link href="/admin/messenger" onClick={close}>Messenger Permissions</Link></div></details>}
          </nav>
        </aside>
      </>}
      <main className={`${styles.main} ${pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet") ? styles.formMain : ""}`}>{children}</main>
    </div>
  </div>;
}
