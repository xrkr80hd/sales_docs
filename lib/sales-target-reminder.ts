import { projection, round, type State } from "@/lib/sales-commander-model";
export type SalesTargets = { calls: number; talks: number; appts: number; sold: number };
let current: { scope: string; targets: SalesTargets } | null = null;
const listeners = new Set<() => void>();
export function subscribeSalesTargets(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function readSalesTargets(scope: string): SalesTargets | null {
  return current?.scope === scope ? current.targets : null;
}
// Receives the existing successful Sales Commander response. No fetch or disk storage.
export function publishSalesTargets(scope: string, state: State) {
  const daily = projection(state).daily;
  current = { scope, targets: { ...daily, sold: round(state.goal / state.rates.workdays) } };
  for (const listener of listeners) listener();
}
