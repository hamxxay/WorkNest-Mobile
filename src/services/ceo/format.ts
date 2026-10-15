import { formatMoney, formatNumber } from "../../utils/format";
import type { CeoAgingBucketKey, CeoFunnelStageKey, CeoPeriod, CeoSales } from "./types";

// Display helpers for the CEO screens (pure, unit-tested).

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

/** True for a yyyy-MM month key. */
export function isMonthKey(value: unknown): value is string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** "2026-10" -> "Oct 2026" (other text is returned as is). */
export function monthLabel(ym: string): string {
  if (!isMonthKey(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" -> "October 2026". */
export function monthLongLabel(ym: string): string {
  if (!isMonthKey(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "2026-10" -> "Oct" (chart axis). */
export function monthShort(ym: string): string {
  if (!isMonthKey(ym)) return ym;
  return MONTHS[Number(ym.split("-")[1]) - 1];
}

/** Compact PKR: "PKR 1.25M". */
export const money = (value: number | null | undefined): string => formatMoney(value, { compact: true });

/** Full PKR: "PKR 1,250,000". */
export const moneyFull = (value: number | null | undefined): string => formatMoney(value);

/** 72 -> "72%", 72.45 -> "72.5%". */
export function pct(value: number | null | undefined): string {
  const v = Number(value);
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)}%`;
}

/** 0..100 with one decimal (donut meters, percentage bars). */
export function clampPct(value: number | null | undefined): number {
  const v = Number(value);
  return Number.isFinite(v) ? Math.round(Math.max(0, Math.min(100, v)) * 10) / 10 : 0;
}

/** occupied / total as a percentage (0 when there are no spaces). */
export function shareOf(part: number, whole: number): number {
  return whole > 0 ? clampPct((part / whole) * 100) : 0;
}

export const count = (value: number | null | undefined): string => formatNumber(value ?? 0, 0);

export const PERIOD_OPTIONS: { label: string; value: CeoPeriod }[] = [
  { label: "This month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
];

/** "this month" / "this quarter" / "this year". */
export function periodWords(period: CeoPeriod): string {
  return `this ${period}`;
}

export const AGING_ORDER: readonly CeoAgingBucketKey[] = ["not_due", "1_30", "31_60", "61_90", "90_plus"];

export const AGING_LABELS: Record<CeoAgingBucketKey, string> = {
  not_due: "Not due",
  "1_30": "1-30 days",
  "31_60": "31-60 days",
  "61_90": "61-90 days",
  "90_plus": "Over 90 days",
};

export const FUNNEL_ORDER: readonly CeoFunnelStageKey[] = ["inquiries", "quotations", "accepted", "bookings"];

export const FUNNEL_LABELS: Record<CeoFunnelStageKey, string> = {
  inquiries: "Tour inquiries",
  quotations: "Quotations",
  accepted: "Accepted",
  bookings: "Bookings",
};

/**
 * True when one location is chosen but the tour inquiry figures still count every location (the server's database
 * update QA_07 has not run, or an older API): the inquiry tiles then say "all locations".
 */
export function inquiriesCountAllLocations(sales: Pick<CeoSales, "inquiriesAllLocations">, locationId: number | null | undefined): boolean {
  return !!locationId && sales.inquiriesAllLocations;
}
