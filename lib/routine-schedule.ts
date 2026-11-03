export type EarlyDays = "mon-wed" | "tue-thu";
export type RoutineItem = { id: string; time: string; name: string; done?: boolean };
export type PlanKind = "short" | "long" | "friday" | "off";
export type PlanDay = { kind: PlanKind; items: RoutineItem[] };

export function normalizeEarlyDays(value: unknown): EarlyDays {
  return value === "tue-thu" ? "tue-thu" : "mon-wed";
}
export function weekdayRoutineKind(day: number, earlyDays: EarlyDays): "short" | "long" | undefined {
  if (day < 1 || day > 4) return undefined;
  const monWed = day === 1 || day === 3;
  return monWed === (earlyDays === "mon-wed") ? "short" : "long";
}

/*
 * Sample days built from the consultant Daily Planner sheet: Good Morning walk,
 * sold and unsold follow-up, three 20-minute training blocks, prospecting,
 * logging the day and writing tomorrow's to-dos. Every time and line is editable.
 */
export const routineTemplates: { id: string; label: string; kind: Exclude<PlanKind, "off">; items: [string, string][] }[] = [
  { id: "short", label: "5-hour early day", kind: "short", items: [
    ["09:00", "Good Morning walk: greet the team, walk the lot, pick 3 units to know cold"],
    ["09:15", "Plan the day: appointments, hot prospects, today's to-dos"],
    ["09:30", "20 min product knowledge on today's 3 units"],
    ["09:50", "Calling block 1: unsold follow-up and internet leads"],
    ["10:50", "Floor and appointments: ups, demos, test drives"],
    ["11:50", "Sold customer follow-up: thank-you calls, delivery check-ins, referral ask"],
    ["12:15", "Calling block 2: set tomorrow's appointments"],
    ["13:00", "20 min selling skills: word tracks and objection practice"],
    ["13:20", "Confirm tomorrow's appointments and update the CRM"],
    ["13:40", "Log today's numbers and write tomorrow's to-dos"],
  ] },
  { id: "long", label: "7-hour late day", kind: "long", items: [
    ["09:00", "Good Morning walk: greet the team, walk the lot, pick 3 units to know cold"],
    ["09:15", "Plan the day: appointments, hot prospects, today's to-dos"],
    ["09:30", "20 min product knowledge on today's 3 units"],
    ["09:50", "Calling block 1: unsold follow-up and internet leads"],
    ["10:50", "Floor and appointments: ups, demos, test drives"],
    ["12:00", "Lunch or floor coverage"],
    ["12:30", "Sold customer follow-up: thank-you calls, delivery check-ins, referral ask"],
    ["13:00", "Calling block 2: set appointments"],
    ["14:00", "Floor, demos and deliveries, or outside prospecting if the floor is slow"],
    ["15:00", "20 min selling skills, then 20 min attitude and motivation"],
    ["15:40", "Confirm appointments, update the CRM, log numbers, write tomorrow's to-dos"],
  ] },
  { id: "friday", label: "Friday noon finish", kind: "friday", items: [
    ["08:00", "Good Morning walk and weekend game plan"],
    ["08:15", "Call and confirm weekend appointments"],
    ["08:45", "Unsold follow-up calls"],
    ["09:30", "Floor, appointments and active deals"],
    ["10:45", "Sold customer follow-up and referral ask"],
    ["11:15", "20 min attitude and motivation: review the week"],
    ["11:35", "Log numbers, write next week's to-dos, manager handoffs"],
  ] },
  { id: "customer", label: "Customer-first flexible day", kind: "long", items: [
    ["09:00", "Good Morning walk and review today's scheduled customers"],
    ["09:20", "Prepare vehicles for today's appointments"],
    ["09:45", "Confirm appointments by call or text"],
    ["10:15", "Showroom appointments and test drives"],
    ["11:45", "Respond to leads and unsold follow-up"],
    ["12:30", "Lunch or floor coverage"],
    ["13:00", "Calling block: set appointments"],
    ["14:00", "Appointments, demos and deliveries"],
    ["15:00", "Sold customer follow-up and 20 min product knowledge"],
    ["15:40", "Update the CRM, log numbers, write tomorrow's to-dos"],
  ] },
];

const pad = (n: number) => String(n).padStart(2, "0");
export function dateKey(d: Date) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function parseDay(value: string) { return new Date(value + "T12:00:00"); }
export function startOfWeek(date: Date) { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
function nth(y: number, m: number, day: number, n: number) { const f = new Date(y, m, 1).getDay(); return 1 + (day - f + 7) % 7 + 7 * (n - 1); }
function last(y: number, m: number, day: number) { const e = new Date(y, m + 1, 0); return e.getDate() - (e.getDay() - day + 7) % 7; }
function observed(y: number, m: number, day: number, date: Date) { const v = new Date(y, m, day); v.setDate(v.getDate() + (v.getDay() === 6 ? -1 : v.getDay() === 0 ? 1 : 0)); return dateKey(v) === dateKey(date); }
export function isHoliday(d: Date) { const y = d.getFullYear(), m = d.getMonth(), n = d.getDate(); return [[0, 1], [5, 19], [6, 4], [10, 11], [11, 25]].some(([mm, dd]) => observed(y, mm, dd, d)) || (m === 0 && n === nth(y, 0, 1, 3)) || (m === 1 && n === nth(y, 1, 1, 3)) || (m === 4 && n === last(y, 4, 1)) || (m === 8 && n === nth(y, 8, 1, 1)) || (m === 9 && n === nth(y, 9, 1, 2)) || (m === 10 && n === nth(y, 10, 4, 4)); }
export function isClosedDay(d: Date) { return d.getDay() === 0 || isHoliday(d); }
export function isOffSaturday(d: Date, anchor: string) { const a = parseDay(anchor); const delta = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); return ((delta % 14) + 14) % 14 === 0; }
export function planFromTemplate(id: string): PlanDay { if (id === "off") return { kind: "off", items: [] }; const t = routineTemplates.find(t => t.id === id) || routineTemplates[0]; return { kind: t.kind, items: t.items.map(([time, name], i) => ({ id: id + "-" + i, time, name, done: false })) }; }
export function defaultDayKind(d: Date, anchor: string, earlyDays: EarlyDays): PlanKind {
  if (isClosedDay(d) || (d.getDay() === 6 && isOffSaturday(d, anchor))) return "off";
  if (d.getDay() === 5) return "friday";
  const weekday = weekdayRoutineKind(d.getDay(), earlyDays);
  if (weekday) return weekday;
  const index = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 5)) / 86400000);
  return index % 2 === 0 ? "short" : "long";
}
/** The routine a consultant works on a date: their saved plan, or the default for that day. */
export function planFor(d: Date, schedule: Record<string, PlanDay>, anchor: string, earlyDays: EarlyDays): PlanDay {
  if (isClosedDay(d)) return { kind: "off", items: [] };
  return schedule[dateKey(d)] || planFromTemplate(defaultDayKind(d, anchor, earlyDays));
}
