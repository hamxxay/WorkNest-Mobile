/** Pakistan is UTC+5 all year (no daylight saving). */
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Today's date in Pakistan as "yyyy-MM-dd", whatever the phone's own time zone is. */
export function pakistanToday(now: Date = new Date()): string {
  return new Date(now.getTime() + PAKISTAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** The "yyyy-MM-dd" part of an API date ("2026-10-13T00:00:00" -> "2026-10-13"); empty when it has none. */
export function apiDateOnly(value: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? "").trim());
  return m ? m[1] : "";
}

/** True when the last valid day (an API date, Pakistan) is before today in Pakistan. A missing date never passes. */
export function isPastPakistanDate(lastDay: string | null | undefined, now: Date = new Date()): boolean {
  const day = apiDateOnly(lastDay);
  return !!day && day < pakistanToday(now);
}
