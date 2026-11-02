// Session-memory UI preferences only; no form values or credentials.
const pages = new Map<string, Record<string, boolean>>();
export function readPageAccordions(key: string) { return { ...pages.get(key) }; }
export function writePageAccordions(key: string, value: Record<string, boolean>) { pages.set(key, { ...value }); }
export function clearPageAccordions(key?: string) { if (key) pages.delete(key); else pages.clear(); }
