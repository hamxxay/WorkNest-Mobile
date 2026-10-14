/**
 * Pure scaling helpers for the charts (no React, no react-native): value cleaning, domains, "nice" ticks,
 * linear and band scales, compact labels and trend direction. Unit tested in ./__tests__/scale.test.ts.
 */
import { formatCompactNumber, formatMoney } from "../../utils/format";

export type Domain = readonly [number, number];

/** A finite number, or 0 for null / undefined / NaN / Infinity. */
export function toFinite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Every entry as a finite number (see `toFinite`). */
export function cleanValues(values: readonly (number | null | undefined)[] | null | undefined): number[] {
  return (values ?? []).map(toFinite);
}

/** [min, max] of the finite values; [0, 0] when there are none. */
export function extent(values: readonly (number | null | undefined)[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? [0, 0] : [min, max];
}

/** True when there is nothing to draw: no values, or every value is zero / not a number. */
export function isAllZero(values: readonly (number | null | undefined)[]): boolean {
  return values.every(v => toFinite(v) === 0);
}

/**
 * A "nice" step for splitting `span` into about `count` intervals: 1, 2, 2.5 or 5 times a power of ten
 * (e.g. span 1,234,567 / 4 -> 500,000). Returns 1 for an empty or invalid span.
 */
export function niceStep(span: number, count = 4): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, Math.round(count));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Decimal places needed to print multiples of `step` without float noise (0.1 + 0.2 -> 0.3). */
function stepDecimals(step: number): number {
  if (!(step > 0)) return 0;
  const text = String(step);
  const exp = /e-(\d+)$/.exec(text);
  if (exp) return Number(exp[1]);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

export type NiceDomain = { min: number; max: number; step: number; ticks: number[] };

export type NiceDomainOptions = {
  /** About how many intervals between ticks (default 4). */
  count?: number;
  /** Stretch the domain to include 0 (default true: bars always start at zero). */
  includeZero?: boolean;
};

/**
 * Domain snapped outwards to nice steps, plus its ticks.
 *   niceDomain(0, 1_234_567)  -> { min: 0, max: 1_500_000, step: 500_000, ticks: [0, 500K, 1M, 1.5M] }
 *   niceDomain(0, 0)          -> { min: 0, max: 1, step: 1, ticks: [0, 1] }   (nothing to show)
 */
export function niceDomain(min: number, max: number, options: NiceDomainOptions = {}): NiceDomain {
  const { count = 4, includeZero = true } = options;
  let lo = toFinite(min);
  let hi = toFinite(max);
  if (lo > hi) [lo, hi] = [hi, lo];
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    // Nothing to show (all zero), or a flat series without zero: give it a band so it can still be drawn.
    if (lo === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
    const pad = niceStep(Math.abs(lo), 1);
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const decimals = stepDecimals(step);
  const ticks: number[] = [];
  const n = Math.round((niceMax - niceMin) / step);
  for (let i = 0; i <= n; i++) ticks.push(Number((niceMin + i * step).toFixed(decimals)));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/** Ticks only: `niceDomain(min, max, options).ticks`. */
export function niceTicks(min: number, max: number, options: NiceDomainOptions = {}): number[] {
  return niceDomain(min, max, options).ticks;
}

/**
 * Linear map from `domain` to `range` (pixels). A zero-width domain maps everything to the start of the range.
 * Pass `clamp` to keep results inside the range.
 */
export function linearScale(domain: Domain, range: Domain, clamp = false): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value: number) => {
    if (!span) return r0;
    let t = (toFinite(value) - d0) / span;
    if (clamp) t = Math.max(0, Math.min(1, t));
    return r0 + t * (r1 - r0);
  };
}

/** `value` as a percentage of `total`, clamped to 0..100; 0 when the total is zero or negative. */
export function percentOf(value: number, total: number): number {
  const t = toFinite(total);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, (toFinite(value) / t) * 100));
}

export type CompactLabelOptions = {
  /** Prefix like "PKR" (uses formatMoney); omit for a bare number. */
  currency?: string;
};

/**
 * Short label for axes and bar ends: 0, 950, 12.5K, 1.25M, 3.4B (or "PKR 1.25M" with a currency).
 * Uses the app formatters (src/utils/format.ts), so it matches every other compact figure in the app.
 */
export function compactLabel(value: number, options: CompactLabelOptions = {}): string {
  const v = toFinite(value);
  return options.currency ? formatMoney(v, { compact: true, currency: options.currency }) : formatCompactNumber(v);
}

export type BandGroup = {
  /** Left edge of the group (all its bars plus the gaps between them). */
  x: number;
  /** Centre of the slot (where the category label goes). */
  center: number;
  /** Left edge of each bar in the group, one per series. */
  bars: number[];
};

export type BandLayout = {
  /** Width of each category slot. */
  slot: number;
  /** Width of one bar. */
  barWidth: number;
  /** Width of one group (bars + gaps). */
  groupWidth: number;
  groups: BandGroup[];
};

export type BandLayoutOptions = {
  /** Number of categories (columns / groups). */
  count: number;
  /** Bars per group (series). Default 1. */
  groupSize?: number;
  /** Width available for the bars. */
  width: number;
  /** Bars never get thicker than this (default 24, the chart mark spec). */
  maxBarWidth?: number;
  /** Surface gap between bars of one group (default 2). */
  barGap?: number;
  /** Share of each slot kept as air around a group, 0..0.9 (default 0.35). */
  padding?: number;
};

/** Positions for grouped columns: each category gets an equal slot, the group is centred in it. */
export function bandLayout(options: BandLayoutOptions): BandLayout {
  const count = Math.max(0, Math.floor(options.count));
  const groupSize = Math.max(1, Math.floor(options.groupSize ?? 1));
  const width = Math.max(0, toFinite(options.width));
  const maxBar = options.maxBarWidth ?? 24;
  const gap = options.barGap ?? 2;
  const padding = Math.max(0, Math.min(0.9, options.padding ?? 0.35));
  if (!count || !width) return { slot: 0, barWidth: 0, groupWidth: 0, groups: [] };
  const slot = width / count;
  const inner = slot * (1 - padding);
  const barWidth = Math.max(1, Math.min(maxBar, (inner - gap * (groupSize - 1)) / groupSize));
  const groupWidth = barWidth * groupSize + gap * (groupSize - 1);
  const groups: BandGroup[] = [];
  for (let i = 0; i < count; i++) {
    const x = i * slot + (slot - groupWidth) / 2;
    const bars: number[] = [];
    for (let j = 0; j < groupSize; j++) bars.push(x + j * (barWidth + gap));
    groups.push({ x, center: i * slot + slot / 2, bars });
  }
  return { slot, barWidth, groupWidth, groups };
}

/**
 * Show every n-th category label so neighbours stay at least `minSpacing` px apart
 * (e.g. 12 months in 240 px with 36 px labels -> every 2nd). Always >= 1.
 */
export function labelStep(count: number, width: number, minSpacing = 36): number {
  if (count <= 1 || !(width > 0)) return 1;
  const slot = width / count;
  return Math.max(1, Math.ceil(minSpacing / slot));
}

export type TrendDirection = "up" | "down" | "flat";

/**
 * Direction from the first to the last value. Changes smaller than `tolerance` (share of the largest absolute
 * value, default 2%) count as flat, as does a series with fewer than two points.
 */
export function trendDirection(values: readonly (number | null | undefined)[], tolerance = 0.02): TrendDirection {
  const v = cleanValues(values);
  if (v.length < 2) return "flat";
  const first = v[0];
  const last = v[v.length - 1];
  const [lo, hi] = extent(v);
  const scale = Math.max(Math.abs(lo), Math.abs(hi));
  if (!scale || Math.abs(last - first) <= scale * tolerance) return "flat";
  return last > first ? "up" : "down";
}

export type StackSegment = {
  /** Index of the series. */
  index: number;
  /** Sum of the segments below this one. */
  start: number;
  value: number;
  /** The highest non-zero segment of the column (drawn with the rounded top). */
  top: boolean;
};

/**
 * Stacked column parts, bottom to top in series order: missing / negative / non-finite values count as 0 and
 * zero segments are left out. [] when the column is empty.
 */
export function stackSegments(values: readonly (number | null | undefined)[]): StackSegment[] {
  const out: StackSegment[] = [];
  let start = 0;
  values.forEach((raw, index) => {
    const value = Math.max(0, toFinite(raw));
    if (value <= 0) return;
    out.push({ index, start, value, top: false });
    start += value;
  });
  if (out.length) out[out.length - 1].top = true;
  return out;
}
