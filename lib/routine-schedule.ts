export type EarlyDays = "mon-wed" | "tue-thu";
export function normalizeEarlyDays(value: unknown): EarlyDays {
  return value === "tue-thu" ? "tue-thu" : "mon-wed";
}
export function weekdayRoutineKind(day: number, earlyDays: EarlyDays): "short" | "long" | undefined {
  if (day < 1 || day > 4) return undefined;
  const monWed = day === 1 || day === 3;
  return monWed === (earlyDays === "mon-wed") ? "short" : "long";
}
