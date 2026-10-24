// One navigation handoff; form and signature data remain in existing workflow storage.
let pending: "new" | "used" | null = null;
export function markDealTypeTransfer(type: "new" | "used") { pending = type; }
export function consumeDealTypeTransfer(type: "new" | "used") { const matches=pending===type; pending=null; return matches; }
