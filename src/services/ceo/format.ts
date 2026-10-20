import { formatMoney, formatNumber } from "../../utils/format";
import type { CeoAgingBucketKey, CeoFunnelStage, CeoFunnelStageKey, CeoPeriod, CeoSales } from "./types";

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

/** The period selector: the calendar periods, then Custom (a From / To range, ./period.ts). */
export const PERIOD_OPTIONS: { label: string; value: CeoPeriod; accessibilityLabel?: string }[] = [
  { label: "This month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
  { label: "Custom", value: "custom", accessibilityLabel: "Custom date range" },
];

/** "this month" / "this quarter" / "this year"; a custom range: "in this range". */
export function periodWords(period: CeoPeriod): string {
  return period === "custom" ? "in this range" : `this ${period}`;
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
 * A funnel stage's share of the stage before it, as the CMS ("62.5% of quotations"): none for the first stage, none when
 * the previous stage is 0, and none when this stage is bigger than the one before it (most quotations don't start as
 * tour inquiries, so a share over 100% would only confuse). The bookings stage gets no share (it includes direct
 * bookings, CP_02): "5 from quotations" when the server says how many came from a quotation, else nothing.
 */
export function funnelStepText(
  funnel: readonly Pick<CeoFunnelStage, "stage" | "count" | "label">[],
  index: number,
  bookingsFromQuotations: number | null = null,
): string | null {
  const here = funnel[index];
  if (here?.stage === "bookings") return bookingsFromQuotations != null ? `${count(bookingsFromQuotations)} from quotations` : null;
  const before = index > 0 ? funnel[index - 1] : undefined;
  if (!here || !before || !(before.count > 0) || here.count > before.count) return null;
  return `${pct(shareOf(here.count, before.count))} of ${before.label.toLowerCase()}`;
}

/**
 * True when one location is chosen but the tour inquiry figures still count every location (the server's database
 * update QA_07 has not run, or an older API): the inquiry tiles then say "all locations".
 */
export function inquiriesCountAllLocations(sales: Pick<CeoSales, "inquiriesAllLocations">, locationId: number | null | undefined): boolean {
  return !!locationId && sales.inquiriesAllLocations;
}
