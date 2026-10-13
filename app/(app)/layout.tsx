"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DisclosureGate } from "@/components/auth/disclosure-gate";
import { SupabaseSessionGate } from "@/components/auth/supabase-session-gate";
import { SaveToastHost } from "@/components/ui/save-toast-host";
import { NotificationPrompt } from "@/components/ui/notification-prompt";
import {
  DocumentDrawer,
} from "@/components/workflow/document-drawer";
import { SettingsDrawer } from "@/components/workflow/settings-drawer";
import { fetchServerSettings, saveConsultant, saveDealer } from "@/lib/dealer-consultant";
import { WorkspaceProvider } from "@/components/command-center/workspace-context";
import { WorkspaceShell } from "@/components/command-center/workspace-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  useEffect(() => {
    void fetchServerSettings().then((settings) => {
      if (!settings) return;
      saveDealer(settings.dealer);
      saveConsultant(settings.consultant);
    });
  }, []);

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
      <DisclosureGate>
        <div className="nxt-ui"><WorkspaceProvider>
          <WorkspaceShell onSettings={() => setSettingsOpen(true)} onDocuments={() => setDrawerOpen(true)}>
            {children}
          </WorkspaceShell>
          {(pathname.startsWith("/documents") || pathname.startsWith("/deal-sheet")) && (
            <DocumentDrawer dealType={drawerDealType} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          )}
          {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
        </WorkspaceProvider></div>
      </DisclosureGate>
      <SaveToastHost />
      <NotificationPrompt />
    </SupabaseSessionGate>
  );
}
