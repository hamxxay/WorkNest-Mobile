import type { QueryValue } from "../staff/normalize";
import type { CeoPeriod, DashRange } from "./types";

// The period of the CEO and Sales Manager dashboards (pure, unit-tested in __tests__/period.test.ts), as the API
// (WorkNest.Application/Helpers/DashboardPeriod.cs) and the CMS (pages/admin/ceo/period-range.ts) count it:
//   month | quarter | year  this calendar period to date; the requests send only `period`, exactly as before the
//                           database update CS_01, so they keep working without it.
//   custom                  any day range (both days included): at most 366 days, starting in 2000 or later and
//                           ending today at the latest; compared with the same number of days just before it
//                           (1-15 Oct -> 16-30 Sep). Before CS_01 the API answers it with a 503 naming the script.
//
// Query names: the dashboard, rooms and complaints calls take the range as from / to; the drill-down calls
// (breakdown, records) as periodFrom / periodTo, because from / to already narrow a list there on their own.

/** Longest custom range, in days (a leap year), as the API. */
export const MAX_RANGE_DAYS = 366;

/** No custom range starts before this day, as the API. */
export const EARLIEST_DAY = "2000-01-01";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** yyyy-MM-dd of a local date. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** A yyyy-MM-dd day as a local date, or null when it is not a real day ("2026-02-30"). */
export function parseDay(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Days in a range, both days included; 0 when it is not a valid range. */
export function rangeDays(range: DashRange | null | undefined): number {
  const f = parseDay(range?.from);
  const t = parseDay(range?.to);
  if (!f || !t || f > t) return 0;
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(t) - utc(f)) / 86400000) + 1;
}

/** The range just before one, as many days long (the API's previous period of a custom range); null when invalid. */
export function previousRange(range: DashRange): DashRange | null {
  const n = rangeDays(range);
  const f = parseDay(range.from);
  if (!n || !f) return null;
  const to = new Date(f.getFullYear(), f.getMonth(), f.getDate() - 1);
  const from = new Date(f.getFullYear(), f.getMonth(), f.getDate() - n);
  return { from: ymd(from), to: ymd(to) };
}

/**
 * A range in words, as the API labels it: "15 Oct 2026" (one day), "October 2026" (a whole month),
 * "1 Oct - 15 Oct 2026", "20 Dec 2025 - 10 Jan 2026"; "Custom range" when it is not a valid range.
 */
export function rangeLabel(range: DashRange | null | undefined): string {
  const f = parseDay(range?.from);
  const t = parseDay(range?.to);
  if (!f || !t || f > t) return "Custom range";
  const day = (d: Date, withYear: boolean) => `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
  if (f.getTime() === t.getTime()) return day(f, true);
  const lastOfMonth = new Date(f.getFullYear(), f.getMonth() + 1, 0);
  if (f.getDate() === 1 && t.getTime() === lastOfMonth.getTime()) return `${MONTHS_LONG[f.getMonth()]} ${f.getFullYear()}`;
  return f.getFullYear() === t.getFullYear() ? `${day(f, false)} - ${day(t, true)}` : `${day(f, true)} - ${day(t, true)}`;
}

/** What is wrong with a range (the API's rules, in its order), or null when it can be used. `today`: yyyy-MM-dd. */
export function checkRange(from: string | null | undefined, to: string | null | undefined, today: string = ymd(new Date())): string | null {
  if (!from || !to) return "Choose both dates.";
  if (!parseDay(from) || !parseDay(to)) return "Choose real dates.";
  if (from > to) return "The start date must be on or before the end date.";
  if (from < EARLIEST_DAY) return "Choose a start date in 2000 or later.";
  if (to > today) return "The end date cannot be after today.";
  if (rangeDays({ from, to }) > MAX_RANGE_DAYS) return `Choose at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

/** True when the range can be sent (checkRange finds nothing wrong). */
export function isValidRange(range: DashRange | null | undefined, today: string = ymd(new Date())): range is DashRange {
  return !!range && checkRange(range.from, range.to, today) === null;
}

/** The first day of the calendar period to today, as the dashboards count it. */
export function calendarRange(period: CeoPeriod, today: Date = new Date()): DashRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  const start = period === "year" ? new Date(y, 0, 1) : period === "quarter" ? new Date(y, Math.floor(m / 3) * 3, 1) : new Date(y, m, 1);
  return { from: ymd(start), to: ymd(today) };
}

/**
 * The dates the range editor opens with: the custom range on screen (or the last one chosen), else the current
 * calendar period to today; never after today.
 */
export function rangeDraft(period: CeoPeriod, range: DashRange | null | undefined, today: Date = new Date()): DashRange {
  const start = range && parseDay(range.from) && parseDay(range.to) ? range : calendarRange(period === "custom" ? "month" : period, today);
  const last = ymd(today);
  return { from: start.from > last ? last : start.from, to: start.to > last ? last : start.to };
}

/** The editor's hint: "15 days, compared with the 15 days before." (one day: "the day before"). */
export function rangeHint(range: DashRange | null | undefined): string {
  const n = rangeDays(range);
  if (!n) return `Up to ${MAX_RANGE_DAYS} days, compared with the same number of days before.`;
  return n === 1 ? "1 day, compared with the day before." : `${n} days, compared with the ${n} days before.`;
}

/**
 * The custom range a scope uses: its range when the period is custom and the range is a real one, else null (a
 * calendar period never sends dates).
 */
export function customRangeOf(scope: { period?: CeoPeriod; range?: DashRange | null }): DashRange | null {
  const r = scope.period === "custom" ? scope.range : null;
  return r && rangeDays(r) > 0 ? { from: r.from, to: r.to } : null;
}

/**
 * The period of a dashboard call (dashboard, rooms, complaints): `period`, plus from / to for a custom range. A
 * calendar period sends only `period`, so those requests stay exactly as before.
 */
export function periodQuery(period: CeoPeriod, range?: DashRange | null): Record<string, QueryValue> {
  const r = customRangeOf({ period, range });
  return r ? { period, from: r.from, to: r.to } : { period };
}

/**
 * The period of a drill-down call (breakdown, records) for a custom range: period=custom and periodFrom / periodTo
 * (from / to there narrow a list on their own). {} for a calendar period (its drill-down calls stay as before).
 */
export function drillPeriodParams(scope: { period?: CeoPeriod; range?: DashRange | null }): Record<string, string> {
  const r = customRangeOf(scope);
  return r ? { period: "custom", periodFrom: r.from, periodTo: r.to } : {};
}

/** The range a response covers (its yyyy-MM-dd from / to), or null. */
export function rangeOf(from: unknown, to: unknown): DashRange | null {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  return typeof from === "string" && typeof to === "string" && day.test(from) && day.test(to) && parseDay(from) && parseDay(to)
    ? { from, to }
    : null;
}

/**
 * How the dashboards word the period and the one before it, as the CMS: "this month" / "last month" / "a month ago";
 * a custom range "in this range" / "previous 15 days" / "15 days earlier" (one day: "previous day" / "1 day earlier").
 */
export type PeriodWords = {
  /** "this month", "in this range" */
  thisP: string;
  /** "last month", "previous 15 days" */
  last: string;
  /** "a month ago", "15 days earlier" */
  ago: string;
};

export function periodWordsOf(period: CeoPeriod, range?: DashRange | null): PeriodWords {
  if (period === "custom") {
    const n = rangeDays(range);
    if (!n) return { thisP: "in this range", last: "previous range", ago: "one range earlier" };
    return n === 1
      ? { thisP: "in this range", last: "previous day", ago: "1 day earlier" }
      : { thisP: "in this range", last: `previous ${n} days`, ago: `${n} days earlier` };
  }
  return { thisP: `this ${period}`, last: `last ${period}`, ago: `a ${period} ago` };
}

/** The period's title when the server sent no label: "This month", "This quarter", "This year" or the range. */
export function periodTitleOf(period: CeoPeriod, range?: DashRange | null): string {
  if (period === "custom") return rangeLabel(range);
  return period === "year" ? "This year" : period === "quarter" ? "This quarter" : "This month";
}

/**
 * A KPI change labelled for a custom range, as the CMS: "12% vs previous 15 days" instead of "12% vs last period"
 * (`which` "ago" for a figure taken at a moment, e.g. occupancy: "2.0 pts vs 15 days earlier"). Calendar periods keep
 * their label as it is.
 */
export function trendForPeriod<T extends { label: string }>(
  trend: T | undefined,
  period: CeoPeriod,
  range?: DashRange | null,
  which: "last" | "ago" = "last",
): T | undefined {
  if (!trend || period !== "custom") return trend;
  const words = periodWordsOf(period, range);
  return { ...trend, label: trend.label.replace(/vs last period$/, `vs ${which === "ago" ? words.ago : words.last}`) };
}
