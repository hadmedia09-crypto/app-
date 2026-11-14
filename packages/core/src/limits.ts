/**
 * Sending-limit helpers shared by the UI (to display) and the worker (to enforce).
 * Warm-up ramp: start at 5/day, +2 per day, capped at the account's daily limit.
 */
export const WARMUP_START = 5;
export const WARMUP_STEP = 2;

export function effectiveDailyLimit(a: { dailyLimit: number; warmupEnabled: boolean; warmupStartedAt: Date | null }, now = new Date()) {
  if (!a.warmupEnabled || !a.warmupStartedAt) return a.dailyLimit;
  const days = Math.max(0, Math.floor((now.getTime() - a.warmupStartedAt.getTime()) / 86_400_000));
  return Math.min(a.dailyLimit, WARMUP_START + days * WARMUP_STEP);
}

/** Local calendar date (YYYY-MM-DD) in a timezone: the key for daily usage counters. */
export function localDay(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** True when `now` falls inside the account's sending window (local time + allowed weekdays). */
export function inSendingWindow(a: { timezone: string; sendingWindowStart: string; sendingWindowEnd: string; sendingDays: number[] }, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: a.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hhmm = `${get("hour")}:${get("minute")}`;
  return a.sendingDays.includes(day) && hhmm >= a.sendingWindowStart && hhmm < a.sendingWindowEnd;
}
