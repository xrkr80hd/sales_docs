import { validateConsultantLinks } from "@/lib/consultant-links";
import type { LinkCollection } from "@/components/consultant-links/link-data";
const PREFIX = "nextdocs.shortcuts.v1:";
const MAX_AGE = 24 * 60 * 60 * 1000;
const FRESH_FOR = 60 * 1000;
export function readLinksCache(scope: string, now = Date.now()): { value: LinkCollection; fresh: boolean } | null {
  if (typeof window === "undefined" || !scope) return null;
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(PREFIX + scope) || "null");
    if (!raw || !Number.isFinite(raw.savedAt) || raw.savedAt > now || now - raw.savedAt >= MAX_AGE) return null;
    const value = raw.value as LinkCollection;
    if (!value || typeof value.organization?.id !== "string" || typeof value.organization.name !== "string" || typeof value.version !== "string") return null;
    return { value: { links: validateConsultantLinks(value.links), organization: value.organization, version: value.version }, fresh: now - raw.savedAt < FRESH_FOR };
  } catch { return null; }
}
export function writeLinksCache(scope: string, value: LinkCollection) {
  if (typeof window === "undefined" || !scope) return;
  try { window.sessionStorage.setItem(PREFIX + scope, JSON.stringify({ savedAt: Date.now(), value: { links: validateConsultantLinks(value.links), organization: value.organization, version: value.version } })); } catch { /* A full or unavailable cache never prevents a server save. */ }
}
export function clearLinksCache() {
  if (typeof window === "undefined") return;
  try { for (let i = window.sessionStorage.length - 1; i >= 0; i--) { const key = window.sessionStorage.key(i); if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key); } } catch { /* Storage may be unavailable. */ }
}
