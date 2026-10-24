"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DisclosureGate } from "@/components/auth/disclosure-gate";
import { SupabaseSessionGate, useSession } from "@/components/auth/supabase-session-gate";
import { SaveToastHost } from "@/components/ui/save-toast-host";
import { NotificationPrompt } from "@/components/ui/notification-prompt";
import {
  DocumentDrawer,
} from "@/components/workflow/document-drawer";
import { CommandCenterProvider } from "@/components/consultant-links/command-center-context";
import { fetchServerSettings, saveConsultant, saveDealer } from "@/lib/dealer-consultant";
import { WorkspaceProvider } from "@/components/command-center/workspace-context";
import { MessengerUnreadProvider } from "@/components/messenger/unread-context";
import { WorkspaceShell } from "@/components/command-center/workspace-shell";

function SessionSettingsSync() {
  const { accessToken } = useSession();
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void fetchServerSettings(accessToken).then(settings => {
      if (!active || !settings) return;
      saveDealer(settings.dealer); saveConsultant(settings.consultant);
    }).catch(() => { /* A local storage failure must not block the workspace. */ });
    return () => { active = false; };
  }, [accessToken]);
  return null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router=useRouter();

  useEffect(() => {
    const handler = () => router.push("/consultant-setup");
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, [router]);


  const drawerDealType: "new" | "used" = (() => {
    if (typeof window === "undefined") return "used";
    try {
      const raw = window.sessionStorage.getItem("walker.workflow.view.v1");
      if (!raw) return "used";
      const parsed = JSON.parse(raw);
      return parsed.returnPath === "/deal-sheet/new" ? "new" : "used";
    } catch { return "used"; }
  })();

  return (
    <SupabaseSessionGate surface="app" renderBar={false}>
      {(pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet")) && <SessionSettingsSync />}
      <DisclosureGate>
        <div className="nxt-ui"><WorkspaceProvider>{pathname === "/office-display" ? children : <CommandCenterProvider><MessengerUnreadProvider>
          <WorkspaceShell onSettings={() => router.push("/consultant-setup")} onDocuments={() => setDrawerOpen(true)}>
            {children}
          </WorkspaceShell>
          {(pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet")) && (
            <DocumentDrawer dealType={drawerDealType} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          )}
        </MessengerUnreadProvider></CommandCenterProvider>}</WorkspaceProvider></div>
      </DisclosureGate>
      <SaveToastHost />
      {pathname !== "/office-display" && <NotificationPrompt />}
    </SupabaseSessionGate>
  );
}
