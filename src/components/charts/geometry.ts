/**
 * SVG path builders for the charts. Pure functions; the ones marked "worklet" also run on the UI thread inside
 * Reanimated `useAnimatedProps` (the mount animation recomputes a path per frame). Unit tested in
 * ./__tests__/geometry.test.ts.
 */
import { extent, toFinite } from "./scale";

export type Point = { x: number; y: number };

/** Rounds to 2 decimals so path strings stay short. */
export function r2(n: number): number {
  "worklet";
  return Math.round(n * 100) / 100;
}

/** A path that draws nothing (an empty `d` is not accepted everywhere). */
export const EMPTY_PATH = "M0 0";

/**
 * A column standing on the baseline `y0`, `height` px tall: rounded data end (top corners, radius `radius`),
 * square at the baseline. Nothing for a zero / negative size.
 */
export function columnPath(x: number, y0: number, width: number, height: number, radius = 4): string {
  "worklet";
  if (!(width > 0) || !(height > 0)) return "M0 0";
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const top = y0 - height;
  if (r === 0) return `M${r2(x)} ${r2(y0)}V${r2(top)}H${r2(x + width)}V${r2(y0)}Z`;
  return (
    `M${r2(x)} ${r2(y0)}V${r2(top + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + r)} ${r2(top)}` +
    `H${r2(x + width - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + width)} ${r2(top + r)}` +
    `V${r2(y0)}Z`
  );
}

/** A rounded rectangle (radius capped at half the height and half the width): HBarList tracks and fills. */
export function pillPath(x: number, y: number, width: number, height: number, radius?: number): string {
  "worklet";
  if (!(width > 0) || !(height > 0)) return "M0 0";
  const r = Math.max(0, Math.min(radius ?? height / 2, height / 2, width / 2));
  const right = x + width;
  const bottom = y + height;
  return (
    `M${r2(x + r)} ${r2(y)}H${r2(right - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(right)} ${r2(y + r)}V${r2(bottom - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(right - r)} ${r2(bottom)}H${r2(x + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(bottom - r)}V${r2(y + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + r)} ${r2(y)}Z`
  );
}

/**
 * A circular arc (stroke it; no fill) around (cx, cy). Angles are degrees clockwise from 12 o'clock.
 * A sweep of 360 is drawn as 359.99 so a full ring still renders.
 */
export function arcPath(cx: number, cy: number, radius: number, startDeg: number, sweepDeg: number): string {
  "worklet";
  if (!(sweepDeg > 0) || !(radius > 0)) return "M0 0";
  const sweep = Math.min(sweepDeg, 359.99);
  const a0 = ((startDeg - 90) * Math.PI) / 180;
  const a1 = ((startDeg + sweep - 90) * Math.PI) / 180;
  const x0 = cx + radius * Math.cos(a0);
  const y0 = cy + radius * Math.sin(a0);
  const x1 = cx + radius * Math.cos(a1);
  const y1 = cy + radius * Math.sin(a1);
  const large = sweep > 180 ? 1 : 0;
  return `M${r2(x0)} ${r2(y0)}A${r2(radius)} ${r2(radius)} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`;
}

/** How much of an arc (start / sweep in degrees) is visible when the ring has swept `progress` (0..1) of 360. */
export function visibleSweep(progress: number, startDeg: number, sweepDeg: number): number {
  "worklet";
  return Math.max(0, Math.min(sweepDeg, progress * 360 - startDeg));
}

export type ArcSpan = { start: number; sweep: number };

/**
 * Donut segments as arcs (degrees, clockwise from 12 o'clock).
 * `total` larger than the sum leaves the rest of the ring empty (a meter: 72 of 100). Zero / negative values get a
 * zero sweep. With two or more visible segments each one gives up `gapDeg` (half each side) so a surface gap
 * separates neighbours.
 */
export function donutSpans(values: readonly number[], total?: number, gapDeg = 0): ArcSpan[] {
  const v = values.map(x => Math.max(0, toFinite(x)));
  const sum = v.reduce((a, b) => a + b, 0);
  const whole = Math.max(sum, toFinite(total));
  if (whole <= 0) return v.map(() => ({ start: 0, sweep: 0 }));
  const visible = v.filter(x => x > 0).length;
  const gap = visible >= 2 ? Math.max(0, gapDeg) : 0;
  let cursor = 0;
  return v.map(x => {
    const raw = (x / whole) * 360;
    const start = cursor;
    cursor += raw;
    if (!raw) return { start, sweep: 0 };
    // Keep tiny segments visible (at least half their size) instead of letting the gap eat them.
    const sweep = Math.max(raw - gap, raw / 2);
    return { start: start + (raw - sweep) / 2, sweep };
  });
}

/** "M x y L x y ..." through the points. */
export function linePath(points: readonly Point[]): string {
  if (!points.length) return EMPTY_PATH;
  return points.map((p, i) => `${i ? "L" : "M"}${r2(p.x)} ${r2(p.y)}`).join("");
}

/** The line closed down to `baseY`: the soft wash under a sparkline. */
export function areaPath(points: readonly Point[], baseY: number): string {
  if (points.length < 2) return EMPTY_PATH;
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)}L${r2(last.x)} ${r2(baseY)}L${r2(first.x)} ${r2(baseY)}Z`;
}

/** Total length of the polyline (for the draw-on stroke animation). */
export function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * Sparkline points: values spread evenly across `width`, scaled between their own min and max (a sparkline
 * shows shape, so it does not start at zero) inside `height` minus `pad` on every side. A flat series sits in
 * the middle.
 */
export function sparkPoints(values: readonly number[], width: number, height: number, pad = 0): Point[] {
  const v = values.map(toFinite);
  if (!v.length || !(width > 0) || !(height > 0)) return [];
  const [lo, hi] = extent(v);
  const left = pad;
  const right = Math.max(pad, width - pad);
  const top = pad;
  const bottom = Math.max(pad, height - pad);
  const dx = v.length > 1 ? (right - left) / (v.length - 1) : 0;
  return v.map((value, i) => ({
    x: v.length > 1 ? left + i * dx : (left + right) / 2,
    y: hi === lo ? (top + bottom) / 2 : bottom - ((value - lo) / (hi - lo)) * (bottom - top),
  }));
}
