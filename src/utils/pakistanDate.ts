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

/**
 * The instant (ms since epoch) of a Pakistan wall-clock date-time from the API ("2026-10-20T10:00:00", as every
 * booking StartOn / EndOn), whatever the phone's own time zone is. A text that carries "Z" or an offset is read as
 * it is; a date alone is midnight in Pakistan. NaN when the text is not a date. Same as the website's
 * utils/dates.ts pakistanWallClockMs.
 */
export function pakistanWallClockMs(text: string | null | undefined): number {
  const s = String(text ?? "").trim();
  if (!s) return NaN;
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s).getTime();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) return NaN;
  return (
    Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) - PAKISTAN_OFFSET_MS
  );
}
