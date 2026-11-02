import type { WorkspaceIdentity } from "@/components/command-center/workspace-context";
import type { SharedBoard } from "@/components/command-center/use-shared-board";

// A short-lived UI snapshot copied directly into an app-owned popup. This is
// never an authorization source: board reads and writes still use server access checks.
const KEY = "walker.display-handoff.v1";
type Handoff = { account: WorkspaceIdentity; board: SharedBoard; expiresAt: number };
export function readDisplayHandoff(userId: string): Handoff | null {
  if (typeof window === "undefined" || window.location.pathname !== "/office-display") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null") as Handoff | null;
    if (!value || value.account.id !== userId || value.expiresAt < Date.now() || value.expiresAt > Date.now() + 15000) return null;
    return value;
  } catch { return null; }
}
export function clearDisplayHandoff() { try { sessionStorage.removeItem(KEY); } catch {} }
export function openDisplayWindow(target: string, account: WorkspaceIdentity, board: SharedBoard) {
  // Start on our own origin so only this popup receives the snapshot. Detach the
  // opener before navigation; the resulting display works independently.
  const popup = window.open("about:blank", "_blank", "popup=yes,width=1040,height=640");
  if (!popup) return;
  try {
    popup.sessionStorage.setItem(KEY, JSON.stringify({ account, board, expiresAt: Date.now() + 15000 } satisfies Handoff));
  } catch { /* Storage restrictions fall back to the normal signed-in startup. */ }
  popup.opener = null;
  popup.location.replace(target);
}
