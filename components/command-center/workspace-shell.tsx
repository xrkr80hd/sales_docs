"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Home, FilePlus2, Files, Wrench, MessageCircle, Settings, Table2, Monitor, CalendarDays, Menu, X, ChevronDown, Shield, LogOut } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import styles from "./workspace.module.css";

export function WorkspaceShell({ children, onSettings, onDocuments }: { children: ReactNode; onSettings: () => void; onDocuments: () => void }) {
  const pathname = usePathname();
  const identity = useWorkspaceIdentity();
  const session = useSession();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const manager = identity?.role === "sales_manager" || identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const admin = identity?.role === "admin" || identity?.email.toLowerCase() === "xrkr80hd@gmail.com";
  const display = pathname === "/office-display";
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const links = manager ? [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Manager Board", href: "/manager-board", icon: Table2 },
    { label: "Office Display", href: "/office-display", icon: Monitor },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ] : [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Start a Deal", href: "/dashboard#start-deal", icon: FilePlus2 },
    { label: "Previous Deals", href: "/deals", icon: Files },
  ];
  const close = () => setNavigationOpen(false);
  return <div className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.brands}>
        <Link href="/dashboard" className={styles.wordmark} aria-label="NXTDox home"><span>N</span>XTD<span>o</span>x</Link>
        <Image src="/walker-red-graphic-v2.png" alt="Walker Automotive" width={320} height={116} className={styles.dealerLogo} priority />
      </div>
      {display ? <div className={styles.displayLabel}><Monitor /><div>Office Display Board<small>Read only · awaiting shared board</small></div></div> : <>
        <div className={styles.identity}>
          <details><summary><span className={styles.avatar}>{identity?.displayName?.charAt(0) || "—"}</span><div><small>Signed in as</small><strong>{identity?.displayName || session.sessionLabel || "Checking session"}</strong><small>{admin ? "Master Admin" : manager ? "Sales Manager" : identity?.role === "fni" ? "Finance" : "Sales Consultant"}</small></div><ChevronDown size={18} /></summary><div className={styles.accountMenu}><button onClick={onSettings}>Settings</button><button onClick={session.signOut}>Sign Out</button></div></details>
          <div className={styles.clock}><small>{now?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) || ""}</small><strong>{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) || ""}</strong></div>
        </div>
        <button className={styles.menuButton} aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu /></button>
      </>}
    </header>
    <div className={`${styles.body} ${display ? styles.displayBody : ""}`}>
      {!display && <>
        {navigationOpen && <button className={styles.scrim} onClick={close} aria-label="Close navigation" />}
        <aside className={`${styles.sidebar} ${navigationOpen ? styles.sidebarOpen : ""}`} aria-label="Application navigation">
          <button className={styles.closeButton} onClick={close} aria-label="Close navigation"><X /></button>
          <nav>
            {links.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`${styles.navLink} ${pathname === href ? styles.active : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon />{label}</Link>)}
            <details open={pathname === "/business-card" || pathname === "/vehicle-collage" || pathname === "/documents/cheat-sheet"}><summary><Wrench />Consultant Tools</summary><div className={styles.subnav}>{[["Cheat Sheet", "/documents/cheat-sheet"], ["Business Card", "/business-card"], ["Vehicle Collage", "/vehicle-collage"]].map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}</Link>)}</div></details>
            <Link href="/messenger" onClick={close} className={`${styles.navLink} ${pathname === "/messenger" ? styles.active : ""}`}><MessageCircle />Messenger</Link>
            <Link href="/documents" onClick={close} className={`${styles.navLink} ${pathname === "/documents" ? styles.active : ""}`}><Files />Documents</Link>
            {pathname.startsWith("/deal-sheet") && <button onClick={() => { close(); onDocuments(); }} className={styles.navButton}><FilePlus2 />Deal Documents</button>}
            {manager && <Link href="/manager-board#team-schedule" onClick={close} className={styles.navLink}><CalendarDays />Team Schedule</Link>}
            <button onClick={() => { close(); onSettings(); }} className={styles.navButton}><Settings />Settings</button>
            <button onClick={() => { close(); session.signOut(); }} className={styles.navButton}><LogOut />Sign Out</button>
            {admin && <details><summary><Shield />Administration</summary><div className={styles.subnav}><Link href="/admin" onClick={close}>Users &amp; Roles</Link><Link href="/admin/messenger" onClick={close}>Messenger Permissions</Link></div></details>}
          </nav>
        </aside>
      </>}
      <main className={`${styles.main} ${pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet") ? styles.formMain : ""}`}>{children}</main>
    </div>
  </div>;
}
