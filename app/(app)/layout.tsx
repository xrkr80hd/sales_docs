"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DisclosureGate } from "@/components/auth/disclosure-gate";
import { SupabaseSessionGate } from "@/components/auth/supabase-session-gate";
import { NotificationPrompt } from "@/components/ui/notification-prompt";
import {
  DocumentDrawer,
  DocumentDrawerTrigger,
} from "@/components/workflow/document-drawer";
import { SettingsDrawer } from "@/components/workflow/settings-drawer";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

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
            {!isDashboardRoute && !isWorkflowRoute && !isDocumentRoute && (
              <header className="border border-white/10 bg-[#2a2a2e] bg-[url('/bg-card-3x2.jpg')] bg-cover bg-center shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/50">
                        Walker Automotive
                      </p>
                      <h1 className="text-2xl font-extrabold tracking-[0.01em] text-white">
                        Walker Docs
                      </h1>
                    </div>
                    <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                      Beta
                    </div>
                  </div>

                  <nav className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard"
                      className={`inline-flex min-h-11 items-center justify-center border px-4 text-sm font-bold uppercase tracking-[0.08em] ${!isAdminRoute
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/documents"
                      className="inline-flex min-h-11 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
                    >
                      Documents
                    </Link>
                    <Link
                      href="/business-card"
                      className="inline-flex min-h-11 items-center justify-center border border-white/20 bg-white/10 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
                    >
                      Business Card
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className={`inline-flex min-h-11 items-center justify-center border px-4 text-sm font-bold uppercase tracking-[0.08em] ${isAdminRoute
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                          }`}
                      >
                        Admin
                      </Link>
                    )}
                  </nav>
                </div>
              </header>
            )}

            {(isDocumentRoute || isWorkflowRoute || isAdminRoute) && (
              <>
                <DocumentDrawerTrigger onClick={() => setDrawerOpen(true)} />
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
