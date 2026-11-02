// The only persistent response cache: allowlisted visual metadata, never access
// permissions, tokens, customer forms, messages or performance records.
export type WorkspaceAppearance = { profileImageUrl?: string; organizationIconUrl?: string; organizationHideIcon?: boolean };
const prefix = 'walker.appearance.v1:';
const lifetime = 5 * 60 * 1000;
export function appearanceOnly(value: WorkspaceAppearance): WorkspaceAppearance {
  return { profileImageUrl: typeof value.profileImageUrl === 'string' ? value.profileImageUrl : '', organizationIconUrl: typeof value.organizationIconUrl === 'string' ? value.organizationIconUrl : '', organizationHideIcon: value.organizationHideIcon === true };
}
export function readAppearance(scope: string): WorkspaceAppearance | undefined {
  try {
    const key = prefix + scope, saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!saved || !Number.isFinite(saved.savedAt) || saved.savedAt > Date.now() || Date.now() - saved.savedAt >= lifetime) { sessionStorage.removeItem(key); return undefined; }
    return appearanceOnly(saved.value || {});
  } catch { return undefined; }
}
export function saveAppearance(scope: string, value: WorkspaceAppearance) {
  try { sessionStorage.setItem(prefix + scope, JSON.stringify({ savedAt: Date.now(), value: appearanceOnly(value) })); } catch { /* Storage is optional. */ }
}
export function invalidateAppearance(scope: string) { try { sessionStorage.removeItem(prefix + scope); } catch { /* Storage is optional. */ } }
