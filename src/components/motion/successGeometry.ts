/** Geometry of the SuccessCheck mark (pure, unit tested). */

export type Point = { x: number; y: number };

/** The tick inside a circle of `size`, as fractions of the size (short stroke down, long stroke up). */
const CHECK = [
  { x: 0.29, y: 0.52 },
  { x: 0.44, y: 0.66 },
  { x: 0.72, y: 0.37 },
] as const;

export function strokeWidthFor(size: number): number {
  return Math.max(2, Math.round(size * 0.07 * 10) / 10);
}

export function checkPoints(size: number): Point[] {
  return CHECK.map(p => ({ x: p.x * size, y: p.y * size }));
}

export function polylineLength(points: ReadonlyArray<Point>): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

export function polylinePath(points: ReadonlyArray<Point>): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/** Ring that fits inside `size` with its stroke: centre, radius and circumference (the dash length to draw it). */
export function ringMetrics(size: number, stroke: number): { center: number; radius: number; circumference: number } {
  const radius = Math.max(0, (size - stroke) / 2);
  return { center: size / 2, radius, circumference: 2 * Math.PI * radius };
}
