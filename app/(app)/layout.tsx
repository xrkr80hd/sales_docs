"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DisclosureGate } from "@/components/auth/disclosure-gate";
import { SupabaseSessionGate } from "@/components/auth/supabase-session-gate";
import { NotificationPrompt } from "@/components/ui/notification-prompt";
import {
  DocumentDrawer,
} from "@/components/workflow/document-drawer";
import { SettingsDrawer } from "@/components/workflow/settings-drawer";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  useEffect(() => setNavigationOpen(false), [pathname]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.role === "admin") setIsAdmin(true);
        });
    });
  }, []);

  const isDocumentRoute = pathname.startsWith("/documents");
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname === "/dashboard";
  const isWorkflowRoute = pathname.startsWith("/deal-sheet");
  const appShellClass = isDashboardRoute
    ? "mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-3 pt-2 sm:px-6 lg:px-8"
    : "mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8";
  const mainClass = isDashboardRoute ? "flex-1 py-2 md:py-3" : "flex-1 py-6";

  // Derive dealType for document drawer from workflow return path
  const drawerDealType: "new" | "used" = (() => {
    if (typeof window === "undefined") return "used";
    try {
      const raw = window.sessionStorage.getItem("walker.workflow.view.v1");
      if (!raw) return "used";
      const parsed = JSON.parse(raw);
      return parsed.returnPath === "/deal-sheet/new" ? "new" : "used";
    } catch {
      return "used";
    }
  })();

  return (
    <SupabaseSessionGate surface="app" renderBar={!isDocumentRoute}>
      <DisclosureGate>
        <div className="min-h-screen">
          <div className={appShellClass}>
            <header className="sticky top-0 z-40 -mx-4 border-b border-white/10 bg-[#111113]/95 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
                <Link href="/dashboard" className="flex items-baseline gap-2 text-white">
                  <span className="text-sm font-black tracking-[0.08em]">NXTDox</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Walker Automotive</span>
                </Link>
                <button type="button" onClick={() => setNavigationOpen(true)} aria-label="Open navigation" aria-expanded={navigationOpen} className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-white/5 text-2xl leading-none text-white">
                  ☰
                </button>
              </div>
            </header>

            {navigationOpen && <div className="fixed inset-0 z-50">
              <button type="button" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} className="absolute inset-0 bg-black/70" />
              <aside className="absolute right-0 top-0 flex h-full w-[min(86vw,340px)] flex-col bg-[#171719] text-white shadow-2xl">
                <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
                  <div><p className="text-sm font-black tracking-wider">NXTDox</p><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Navigation</p></div>
                  <button type="button" onClick={() => setNavigationOpen(false)} aria-label="Close navigation" className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-xl">×</button>
                </div>
                <nav className="grid gap-1 p-3">
                  {[
                    ["Dashboard", "/dashboard"], ["Documents", "/documents"], ["Business Card", "/business-card"], ["NXTDox Messenger", "/messenger"], ["Previous Deals", "/deals"]
                  ].map(([label, href]) => <Link key={href} href={href} className={`rounded-md px-4 py-3 text-sm font-bold ${pathname === href || (href !== "/dashboard" && pathname.startsWith(href)) ? "bg-[var(--accent)]" : "hover:bg-white/5"}`}>{label}</Link>)}
                  {isWorkflowRoute && <button type="button" onClick={() => { setNavigationOpen(false); setDrawerOpen(true); }} className="rounded-md px-4 py-3 text-left text-sm font-bold hover:bg-white/5">Deal Documents</button>}
                  {isAdmin && <><div className="my-2 border-t border-white/10"/><Link href="/admin" className={`rounded-md px-4 py-3 text-sm font-bold ${isAdminRoute ? "bg-[var(--accent)]" : "hover:bg-white/5"}`}>Admin Console</Link><Link href="/admin/messenger" className="rounded-md px-4 py-3 text-sm font-bold hover:bg-white/5">Messenger Permissions</Link></>}
                </nav>
                <button type="button" onClick={() => { setNavigationOpen(false); setSettingsOpen(true); }} className="mt-auto border-t border-white/10 px-7 py-5 text-left text-sm font-bold text-white/70">Settings</button>
              </aside>
            </div>}

            {(isDocumentRoute || isWorkflowRoute) && (
              <>
                <DocumentDrawer
                  dealType={drawerDealType}
                  open={drawerOpen}
                  onClose={() => setDrawerOpen(false)}
                />
              </>
            )}

            <main className={mainClass}>{children}</main>
          </div>
        </div>
      </DisclosureGate>
      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
      <NotificationPrompt />
    </SupabaseSessionGate>
  );
}
