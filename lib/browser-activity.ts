const stayKey='walker.auth.stay-signed-in.v1';
export function staySignedInEnabled(){try{return localStorage.getItem(stayKey)==='1';}catch{return false;}}
export function preferredStaySignedIn(){try{return localStorage.getItem(stayKey)!=='0';}catch{return true;}}
export function setStaySignedIn(value:boolean){try{localStorage.setItem(stayKey,value?'1':'0');}catch{}}
export const BROWSER_IDLE_MS = 8 * 60 * 60 * 1000;
const activityKey = 'walker.auth.activity.v1';
type Activity = { userId: string; lastActiveAt: number };
function read(): Activity | null {
  try { return JSON.parse(localStorage.getItem(activityKey) || 'null'); } catch { return null; }
}
export function browserLastActiveAt(userId: string): number | undefined { const value=read();return value?.userId===userId&&Number.isFinite(value.lastActiveAt)?value.lastActiveAt:undefined; }
export function browserSessionExpired(userId: string, now = Date.now()) {
  if(staySignedInEnabled())return false;
  const value = read();
  return value?.userId === userId && (!Number.isFinite(value.lastActiveAt) || value.lastActiveAt > now || now - value.lastActiveAt >= BROWSER_IDLE_MS);
}
export function recordBrowserActivity(userId: string, force = false, now = Date.now()) {
  const previous = read();
  if (!force && previous?.userId === userId && now - previous.lastActiveAt < 60000) return;
  try { localStorage.setItem(activityKey, JSON.stringify({ userId, lastActiveAt: now })); } catch { /* In-memory session gate still tracks activity when storage is unavailable. */ }
}
