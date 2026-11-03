import { dateKey, normalizeEarlyDays, parseDay, planFor, type EarlyDays, type PlanDay } from "@/lib/routine-schedule";

/*
 * Rates are percentages. contact/set/show/sold describe the appointment funnel
 * (calls -> real conversations -> appointments set -> shown -> sold). walkin and
 * owner are the share of the monthly goal expected from walk-in ups and from
 * owners/repeat/referral/be-back customers, so outbound calls are not credited
 * with every sale. upClose is the close rate on walk-in ups.
 */
export type Rates = { contact: number; set: number; show: number; sold: number; buffer: number; workdays: number; walkin: number; upClose: number; owner: number };
export type Counts = { calls: number; talks: number; appts: number; shows: number; sold: number; ups: number };
export type Todo = { id: string; text: string; done: boolean };
export type DayLog = { checks: string[]; todos: Todo[] };
export type State = { goal: number; rates: Rates; days: Record<string, Counts>; wins: string[]; weekendAnchor: string; earlyDays: EarlyDays; schedule: Record<string, PlanDay>; log: Record<string, DayLog> };

export const defaultRates: Rates = { contact: 22, set: 40, show: 60, sold: 45, buffer: 2, workdays: 22, walkin: 40, upClose: 20, owner: 15 };
export const defaults: State = { goal: 5, rates: defaultRates, days: {}, wins: [], weekendAnchor: "2026-08-08", earlyDays: "mon-wed", schedule: {}, log: {} };
export const countKeys = ["calls", "talks", "appts", "shows", "ups", "sold"] as const;
export const countNames: { [K in keyof Counts]: string } = { calls: "Calls made", talks: "Real conversations", appts: "Appointments set", shows: "Appointments shown", ups: "Walk-in ups", sold: "Vehicles sold" };
export const blank = (): Counts => ({ calls: 0, talks: 0, appts: 0, shows: 0, sold: 0, ups: 0 });
export const round = (n: number) => Math.ceil(n - 1e-9);
export const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeRates(value: unknown): Rates {
  const r = value && typeof value === "object" ? value as Partial<Rates> : {};
  const d = defaultRates;
  const walkin = number(r.walkin, d.walkin, 0, 80);
  // At least 10% of the goal always comes from the appointment funnel.
  const owner = Math.min(number(r.owner, d.owner, 0, 50), 90 - walkin);
  return { contact: number(r.contact, d.contact, 1, 100), set: number(r.set, d.set, 1, 100), show: number(r.show, d.show, 1, 100), sold: number(r.sold, d.sold, 1, 100), buffer: number(r.buffer, d.buffer, 0, 50), workdays: number(r.workdays, d.workdays, 1, 31), walkin, upClose: number(r.upClose, d.upClose, 1, 100), owner };
}
function normalizeLog(value: unknown): Record<string, DayLog> {
  const out: Record<string, DayLog> = {};
  if (!value || typeof value !== "object") return out;
  // Keep about two months of checklists and to-dos so the saved record stays small.
  const dates = Object.keys(value).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().slice(-62);
  for (const date of dates) {
    const entry = (value as Record<string, Partial<DayLog>>)[date];
    if (!entry || typeof entry !== "object") continue;
    const checks = Array.isArray(entry.checks) ? entry.checks.filter((x): x is string => typeof x === "string").slice(0, 80) : [];
    const todos = Array.isArray(entry.todos) ? entry.todos.filter(t => t && typeof t.id === "string" && typeof t.text === "string").slice(0, 40).map(t => ({ id: t.id, text: t.text.slice(0, 200), done: t.done === true })) : [];
    if (checks.length || todos.length) out[date] = { checks, todos };
  }
  return out;
}
export function normalize(value: unknown): State {
  const v = value && typeof value === "object" ? value as Partial<State> : {};
  const days: Record<string, Counts> = {};
  if (v.days && typeof v.days === "object") for (const [date, counts] of Object.entries(v.days)) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !counts || typeof counts !== "object") continue; days[date] = Object.fromEntries((Object.keys(blank()) as (keyof Counts)[]).map(k => [k, number(counts[k], 0, 0, 100000)])) as unknown as Counts; }
  return { goal: number(v.goal, 5, 1, 250), rates: normalizeRates(v.rates), days, wins: Array.isArray(v.wins) ? v.wins.filter(x => typeof x === "string").slice(-100) : [], weekendAnchor: typeof v.weekendAnchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.weekendAnchor) ? v.weekendAnchor : "2026-08-08", earlyDays: normalizeEarlyDays(v.earlyDays), schedule: v.schedule && typeof v.schedule === "object" ? v.schedule : {}, log: normalizeLog(v.log) };
}

/** Monthly activity a goal requires, split by where the sales come from. */
export function projection(s: Pick<State, "goal" | "rates">) {
  const { contact, set, show, sold, buffer, workdays, walkin, upClose, owner } = s.rates;
  const cushion = 1 + buffer / 100;
  const sources = { walkin: s.goal * walkin / 100, owner: s.goal * owner / 100, appt: 0 };
  sources.appt = Math.max(0, s.goal - sources.walkin - sources.owner);
  const shows = round(sources.appt / (sold / 100));
  const appts = round(shows / (show / 100));
  const talks = round(appts / (set / 100));
  const calls = round(talks / (contact / 100));
  const ups = round(sources.walkin / (upClose / 100));
  // The cushion is a small activity-volume margin, not an assumed conversion improvement.
  const adjusted: Counts = { calls: round(calls * cushion), talks: round(talks * cushion), appts: round(appts * cushion), shows, ups, sold: s.goal };
  const daily = Object.fromEntries(countKeys.map(k => [k, round(adjusted[k] / workdays)])) as unknown as Counts;
  return { adjusted, raw: { calls, talks, appts }, sources, daily };
}

export function chicagoDay(date = new Date()) { return date.toLocaleDateString("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }); }

/**
 * Where a consultant stands on today's date. Selling days come from their own
 * routine schedule (days off, Sundays and holidays excluded). Today's target is the
 * plan's daily number, raised when they are behind so the month still closes.
 */
export function pace(s: State, today: string) {
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  let total = 0, elapsed = 0, remaining = 0;
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(y, m - 1, d, 12);
    if (planFor(date, s.schedule, s.weekendAnchor, s.earlyDays).kind === "off") continue;
    total++;
    if (dateKey(date) < today) elapsed++; else remaining++;
  }
  if (!total) { total = s.rates.workdays; remaining = Math.max(1, total - elapsed); }
  const todayOff = planFor(parseDay(today), s.schedule, s.weekendAnchor, s.earlyDays).kind === "off";
  const plan = projection({ goal: s.goal, rates: { ...s.rates, workdays: total } });
  const month = today.slice(0, 7);
  const before = blank(), mtd = blank();
  for (const [date, c] of Object.entries(s.days)) { if (!date.startsWith(month)) continue; for (const k of countKeys) { mtd[k] += c[k] || 0; if (date < today) before[k] += c[k] || 0; } }
  const left = Math.max(1, remaining);
  const targets = blank(), catchUp: Record<keyof Counts, boolean> = { calls: false, talks: false, appts: false, shows: false, ups: false, sold: false };
  for (const k of countKeys) {
    const needed = round(Math.max(0, plan.adjusted[k] - before[k]) / left);
    // Raise the daily target when behind, but never past double the plan so it stays workable.
    targets[k] = todayOff ? 0 : Math.min(Math.max(plan.daily[k], needed), plan.daily[k] * 2);
    catchUp[k] = !todayOff && needed > plan.daily[k];
  }
  const expectedSold = s.goal * elapsed / total;
  return { plan, total, elapsed, remaining, todayOff, mtd, targets, catchUp, expectedSold, behind: Math.round((expectedSold - mtd.sold) * 10) / 10, perDayNeeded: Math.max(0, s.goal - mtd.sold) / left };
}

/**
 * Suggest a consultant's own funnel ratios from logged activity. Only ratios the
 * log can support honestly are offered, and only with enough volume to mean
 * something. Close rates are not suggested because sold units are not tied to
 * a source.
 */
export function actualRates(s: State, today: string, lookbackDays = 30) {
  const start = parseDay(today); start.setDate(start.getDate() - lookbackDays + 1);
  const from = dateKey(start), t = blank();
  for (const [date, c] of Object.entries(s.days)) if (date >= from && date <= today) for (const k of countKeys) t[k] += c[k] || 0;
  const pct = (a: number, b: number) => Math.min(100, Math.max(1, Math.round(a / b * 100)));
  return {
    totals: t,
    contact: t.calls >= 40 ? pct(t.talks, t.calls) : null,
    set: t.talks >= 15 ? pct(t.appts, t.talks) : null,
    show: t.appts >= 8 ? pct(t.shows, t.appts) : null,
  };
}
