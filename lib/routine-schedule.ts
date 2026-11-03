export type EarlyDays = "mon-wed" | "tue-thu";
/** name is the short title shown on the accordion; detail is what the block actually involves. */
export type RoutineItem = { id: string; time: string; name: string; detail?: string; done?: boolean };
/** Title + description for a block. Older blocks wrote both in one line ("Title: what it involves"). */
export function routineParts(item: RoutineItem): { title: string; detail: string } {
  if (item.detail !== undefined) return { title: item.name.trim(), detail: item.detail.trim() };
  const at = item.name.indexOf(": ");
  return at > 0 && at < 60 ? { title: item.name.slice(0, at).trim(), detail: item.name.slice(at + 2).trim() } : { title: item.name.trim(), detail: "" };
}
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
/*
 * Seasonal hours. When the clocks fall back (first Sunday in November) the store
 * runs its winter schedule: early days close at 5 PM and late days at 6 PM. In
 * "auto" mode that switches by date; consultants can also force either schedule.
 */
export type SeasonMode = "auto" | "daylight" | "standard";
export type SeasonalHours = { mode: SeasonMode; shortClose: string; longClose: string };
export const defaultHours: SeasonalHours = { mode: "auto", shortClose: "17:00", longClose: "18:00" };
const clock = (value: unknown, fallback: string) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
export function normalizeHours(value: unknown): SeasonalHours {
  const v = value && typeof value === "object" ? value as Partial<SeasonalHours> : {};
  return { mode: v.mode === "daylight" || v.mode === "standard" ? v.mode : "auto", shortClose: clock(v.shortClose, defaultHours.shortClose), longClose: clock(v.longClose, defaultHours.longClose) };
}
/** US daylight saving time: second Sunday in March through the day before the first Sunday in November. */
export function isDaylightTime(d: Date) {
  const y = d.getFullYear(), m = d.getMonth(), n = d.getDate();
  if (m < 2 || m > 10) return false;
  if (m > 2 && m < 10) return true;
  return m === 2 ? n >= nth(y, 2, 0, 2) : n < nth(y, 10, 0, 1);
}
export function winterHoursOn(d: Date, hours?: SeasonalHours) { return !!hours && (hours.mode === "standard" || (hours.mode === "auto" && !isDaylightTime(d))); }
const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const toClock = (minutes: number) => { const v = Math.min(23 * 60 + 59, Math.max(0, minutes)); return pad(Math.floor(v / 60)) + ":" + pad(v % 60); };
/** Template end times before any seasonal shift (9 AM starts: 5-hour and 7-hour days). */
const naturalClose: Record<"short" | "long", string> = { short: "14:00", long: "16:00" };
/** The closing time for a day kind on a date, when the winter schedule applies. */
export function closingTime(kind: PlanKind, d?: Date, hours?: SeasonalHours) {
  if (!d || !winterHoursOn(d, hours) || (kind !== "short" && kind !== "long")) return null;
  return kind === "short" ? hours!.shortClose : hours!.longClose;
}
export function formatClock(value: string) { const [h, m] = value.split(":").map(Number); return `${((h + 11) % 12) + 1}${m ? ":" + pad(m) : ""} ${h < 12 ? "AM" : "PM"}`; }
export function planFromTemplate(id: string, d?: Date, hours?: SeasonalHours): PlanDay {
  if (id === "off") return { kind: "off", items: [] };
  const t = routineTemplates.find(t => t.id === id) || routineTemplates[0];
  const close = closingTime(t.kind, d, hours);
  const shift = close && (t.kind === "short" || t.kind === "long") ? toMinutes(close) - toMinutes(naturalClose[t.kind]) : 0;
  return { kind: t.kind, items: t.items.map(([time, name], i) => ({ id: id + "-" + i, time: shift ? toClock(toMinutes(time) + shift) : time, name, done: false })) };
}
export function defaultDayKind(d: Date, anchor: string, earlyDays: EarlyDays): PlanKind {
  if (isClosedDay(d) || (d.getDay() === 6 && isOffSaturday(d, anchor))) return "off";
  if (d.getDay() === 5) return "friday";
  const weekday = weekdayRoutineKind(d.getDay(), earlyDays);
  if (weekday) return weekday;
  const index = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 5)) / 86400000);
  return index % 2 === 0 ? "short" : "long";
}
/** The routine a consultant works on a date: their saved plan, or the default for that day. */
export function planFor(d: Date, schedule: Record<string, PlanDay>, anchor: string, earlyDays: EarlyDays, hours?: SeasonalHours): PlanDay {
  if (isClosedDay(d)) return { kind: "off", items: [] };
  return schedule[dateKey(d)] || planFromTemplate(defaultDayKind(d, anchor, earlyDays), d, hours);
}
