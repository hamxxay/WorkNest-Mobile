import { checkPoints, polylineLength, polylinePath, ringMetrics, strokeWidthFor } from "../successGeometry";

describe("success check geometry", () => {
  it("measures a polyline", () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
    expect(polylineLength([])).toBe(0);
  });

  it("scales the tick with the size and draws it as one path", () => {
    const small = checkPoints(20);
    const big = checkPoints(80);
    expect(polylineLength(big)).toBeCloseTo(polylineLength(small) * 4, 6);
    expect(polylinePath(checkPoints(100))).toBe("M29.00 52.00 L44.00 66.00 L72.00 37.00");
    // The tick stays inside the circle.
    for (const p of big) {
      expect(Math.hypot(p.x - 40, p.y - 40)).toBeLessThan(40);
    }
  });

  it("fits the ring inside the box with its stroke", () => {
    const { center, radius, circumference } = ringMetrics(64, 4);
    expect(center).toBe(32);
    expect(radius).toBe(30);
    expect(circumference).toBeCloseTo(2 * Math.PI * 30, 10);
    expect(ringMetrics(2, 4).radius).toBe(0);
  });

  it("keeps the stroke readable at small sizes", () => {
    expect(strokeWidthFor(20)).toBe(2);
    expect(strokeWidthFor(72)).toBe(5);
  });
});
