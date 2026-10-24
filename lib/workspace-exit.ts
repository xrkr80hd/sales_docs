let guard: (() => Promise<boolean>) | null = null;
export function installWorkspaceExitGuard(next: () => Promise<boolean>) { guard=next;return()=>{if(guard===next)guard=null;}; }
export function requestWorkspaceExit() { return guard?guard():Promise.resolve(true); }
