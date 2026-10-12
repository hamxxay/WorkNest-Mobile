/**
 * Shared display formatters. Pure functions, no Intl dependency (output is identical on Hermes, Jest and web).
 *
 *   formatMoney(12500)                    -> "PKR 12,500"
 *   formatMoney(12500.5)                  -> "PKR 12,500.50"
 *   formatMoney(1250000, { compact: true }) -> "PKR 1.25M"
 *   formatDate("2026-10-12")              -> "12 Oct 2026"
 *   formatDateTime("2026-10-12T15:45:00") -> "12 Oct 2026, 3:45 PM"
 *   formatRelative(someDate)              -> "5 min ago" / "Yesterday" / "in 3 days" / "12 Oct 2026"
 */

export type DateInput = Date | string | number | null | undefined;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DASH = "—";

// ─── Numbers & money ──────────────────────────────────────────────────────────

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** 1234567.891 -> "1,234,567.89" (decimals default: 0 for whole numbers, else 2). */
export function formatNumber(value: number | string | null | undefined, decimals?: number, fallback = DASH): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  const places = decimals ?? (Number.isInteger(n) ? 0 : 2);
  const fixed = Math.abs(n).toFixed(places);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

/** 950 -> "950", 12500 -> "12.5K", 1250000 -> "1.25M", 3400000000 -> "3.4B". */
export function formatCompactNumber(value: number | string | null | undefined, fallback = DASH): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${trimZeros((abs / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `${sign}${trimZeros((abs / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${sign}${trimZeros((abs / 1e3).toFixed(1))}K`;
  return `${sign}${trimZeros(abs.toFixed(abs % 1 === 0 ? 0 : 2))}`;
}

export type MoneyOptions = {
  /** "PKR 1.25M" instead of "PKR 1,250,000". */
  compact?: boolean;
  /** Currency prefix. Default "PKR". Pass "" for the number only. */
  currency?: string;
  /** Fixed decimal places. Default: 0 for whole amounts, 2 otherwise. */
  decimals?: number;
  /** Shown for null / undefined / non-numeric input. Default an em dash. */
  fallback?: string;
};

/** Money in PKR: formatMoney(12500) -> "PKR 12,500"; negative -> "-PKR 1,200". */
export function formatMoney(amount: number | string | null | undefined, options: MoneyOptions = {}): string {
  const { compact = false, currency = "PKR", decimals, fallback = DASH } = options;
  const n = toNumber(amount);
  if (n === null) return fallback;
  const body = compact ? formatCompactNumber(Math.abs(n)) : formatNumber(Math.abs(n), decimals);
  const prefix = currency ? `${currency} ` : "";
  return `${n < 0 ? "-" : ""}${prefix}${body}`;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Parses API dates. A date-only string ("2026-10-12") is read as a LOCAL date (plain `new Date()` would read it
 * as UTC and can show the previous day). Returns null for empty / invalid input.
 */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const text = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export type DateOptions = {
  /** Include the year. Default true. */
  year?: boolean;
  /** Prefix the weekday: "Mon, 12 Oct 2026". Default false. */
  weekday?: boolean;
  fallback?: string;
};

/** "12 Oct 2026" (or "Mon, 12 Oct" with { weekday: true, year: false }). */
export function formatDate(value: DateInput, options: DateOptions = {}): string {
  const { year = true, weekday = false, fallback = DASH } = options;
  const d = parseDate(value);
  if (!d) return fallback;
  const core = `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}`;
  return weekday ? `${WEEKDAYS[d.getDay()]}, ${core}` : core;
}

/** "3:45 PM". */
export function formatTime(value: DateInput, fallback = DASH): string {
  const d = parseDate(value);
  if (!d) return fallback;
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

/** "12 Oct 2026, 3:45 PM". */
export function formatDateTime(value: DateInput, options: DateOptions = {}): string {
  const d = parseDate(value);
  if (!d) return options.fallback ?? DASH;
  return `${formatDate(d, options)}, ${formatTime(d)}`;
}

/** "12 – 14 Oct 2026", "28 Sep – 2 Oct 2026", "12 Oct 2026" when both are the same day. */
export function formatDateRange(start: DateInput, end: DateInput, fallback = DASH): string {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a && !b) return fallback;
  if (!a || !b) return formatDate(a ?? b);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === b.getDate()) return formatDate(a);
  if (sameMonth) return `${a.getDate()} – ${formatDate(b)}`;
  if (sameYear) return `${formatDate(a, { year: false })} – ${formatDate(b)}`;
  return `${formatDate(a)} – ${formatDate(b)}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Relative time for lists and notifications:
 * "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", "in 20 min", "Tomorrow", "in 3 days";
 * beyond 7 days it falls back to formatDate ("12 Oct 2026").
 */
export function formatRelative(value: DateInput, now: Date = new Date(), fallback = DASH): string {
  const d = parseDate(value);
  if (!d) return fallback;
  const diffMs = d.getTime() - now.getTime();
  const future = diffMs > 0;
  const absMin = Math.round(Math.abs(diffMs) / 60000);

  if (absMin < 1) return "Just now";
  if (absMin < 60) return future ? `in ${absMin} min` : `${absMin} min ago`;

  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (dayDiff === 0) {
    const hours = Math.round(absMin / 60);
    return future ? `in ${hours} h` : `${hours} h ago`;
  }
  if (dayDiff === -1) return "Yesterday";
  if (dayDiff === 1) return "Tomorrow";
  if (Math.abs(dayDiff) <= 7) return dayDiff < 0 ? `${-dayDiff} days ago` : `in ${dayDiff} days`;
  return formatDate(d);
}

/** Local yyyy-MM-dd (for API payloads), e.g. toYmdLocal(new Date()) -> "2026-10-12". */
export function toYmdLocal(value: DateInput): string {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
