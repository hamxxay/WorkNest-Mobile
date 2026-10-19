/**
 * Screen-reader summaries for the charts (each chart is one accessible element whose label lists its values).
 * Pure functions; unit tested in ./__tests__/summary.test.ts.
 */
import { formatNumber } from "../../utils/format";
import { cleanValues, compactLabel, extent, trendDirection } from "./scale";

export type ValueFormatter = (value: number) => string;

/** Default value text: grouped digits, no trailing zeros ("1,250,000", "72.4"). */
export const defaultFormat: ValueFormatter = value => {
  const text = formatNumber(value);
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
};

const sentence = (text: string) => {
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
};

/**
 * Joins non-empty parts as sentences, each starting with a capital:
 * ["Pipeline", "draft 3, sent 5"] -> "Pipeline. Draft 3, sent 5."
 */
export function sentences(parts: readonly (string | null | undefined | false)[]): string {
  return parts
    .map(p => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .map(sentence)
    .join(" ");
}

export type BarSummaryInput = {
  label?: string;
  data: readonly { label: string; title?: string; values: readonly number[] }[];
  series: readonly { label: string }[];
  format?: ValueFormatter;
  emptyText?: string;
};

/** "Invoiced and paid. Oct 2026: Invoiced PKR 1.2M, Paid PKR 900K. Nov 2026: ..." */
export function summarizeBars({ label, data, series, format = defaultFormat, emptyText = "No data" }: BarSummaryInput): string {
  const rows = data.map(d => {
    const values = series.map((s, i) => {
      const v = cleanValues(d.values)[i] ?? 0;
      return series.length > 1 ? `${s.label} ${format(v)}` : format(v);
    });
    return `${d.title || d.label}: ${values.join(", ")}`;
  });
  const empty = !data.length || data.every(d => cleanValues(d.values).every(v => v === 0));
  return sentences([label, empty ? emptyText : rows.join(". ")]);
}

export type ListSummaryInput = {
  label?: string;
  items: readonly { label: string; value: number; valueLabel?: string }[];
  format?: ValueFormatter;
  emptyText?: string;
};

/** "Pipeline. Draft 3, Sent 5, Converted 2." (uses each item's valueLabel when given). */
export function summarizeList({ label, items, format = defaultFormat, emptyText = "No data" }: ListSummaryInput): string {
  const body = items.map(it => `${it.label} ${it.valueLabel ?? format(it.value)}`).join(", ");
  return sentences([label, items.length ? body : emptyText]);
}

export type DonutSummaryInput = {
  label?: string;
  /** The figure in the middle, e.g. "72%". */
  center?: string;
  centerCaption?: string;
  segments: readonly { label: string; value: number }[];
  total?: number;
  format?: ValueFormatter;
};

/** "Occupancy. 72% occupied. Occupied 18 of 25." */
export function summarizeDonut({ label, center, centerCaption, segments, total, format = defaultFormat }: DonutSummaryInput): string {
  const sum = segments.reduce((a, s) => a + Math.max(0, cleanValues([s.value])[0]), 0);
  const whole = Math.max(sum, cleanValues([total])[0]);
  const parts = segments.map(s => `${s.label} ${format(s.value)}`).join(", ");
  const of = total != null && whole > 0 ? ` of ${format(whole)}` : "";
  return sentences([label, [center, centerCaption].filter(Boolean).join(" "), segments.length ? `${parts}${of}` : null]);
}

const DIRECTION_WORD = { up: "rising", down: "falling", flat: "steady" } as const;

/**
 * "trend rising over 6 periods, from 62 to 71" (compact numbers; any unit). Empty for fewer than two points.
 */
export function describeTrend(values: readonly number[], format: ValueFormatter = v => compactLabel(v)): string {
  const v = cleanValues(values);
  if (v.length < 2) return "";
  const [lo, hi] = extent(v);
  const dir = trendDirection(v);
  const range = lo === hi ? "" : `, low ${format(lo)}, high ${format(hi)}`;
  return `trend ${DIRECTION_WORD[dir]} over ${v.length} periods, from ${format(v[0])} to ${format(v[v.length - 1])}${range}`;
}

/**
 * A KPI delta label split for its chip: "12% vs last period" -> figure "12%" (in the chip, with the arrow) and
 * versus "vs last period" (muted, after the chip). A label without " vs " ("new", "no change") is all figure.
 */
export function splitTrendLabel(label: string): { figure: string; versus: string | null } {
  const at = label.indexOf(" vs ");
  if (at <= 0) return { figure: label, versus: null };
  return { figure: label.slice(0, at), versus: label.slice(at + 1) };
}
