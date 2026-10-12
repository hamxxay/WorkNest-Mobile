import {
  EMPTY_PATH,
  arcPath,
  areaPath,
  columnPath,
  donutSpans,
  linePath,
  pillPath,
  polylineLength,
  sparkPoints,
  visibleSweep,
} from "../geometry";

describe("columnPath", () => {
  it("draws a column with a rounded top and a square base", () => {
    expect(columnPath(10, 100, 20, 50, 4)).toBe("M10 100V54A4 4 0 0 1 14 50H26A4 4 0 0 1 30 54V100Z");
  });
  it("caps the radius for short or thin columns", () => {
    expect(columnPath(0, 10, 20, 2, 4)).toContain("A2 2");
    expect(columnPath(0, 100, 4, 50, 4)).toContain("A2 2");
  });
  it("draws nothing for zero or negative sizes", () => {
    expect(columnPath(0, 100, 20, 0)).toBe(EMPTY_PATH);
    expect(columnPath(0, 100, 0, 20)).toBe(EMPTY_PATH);
    expect(columnPath(0, 100, 20, -5)).toBe(EMPTY_PATH);
  });
  it("draws square corners with radius 0", () => {
    expect(columnPath(0, 10, 4, 6, 0)).toBe("M0 10V4H4V10Z");
  });
});

describe("pillPath", () => {
  it("rounds both ends to half the height", () => {
    const d = pillPath(0, 0, 100, 8);
    expect(d.startsWith("M4 0H96")).toBe(true);
    expect(d).toContain("A4 4");
  });
  it("caps the radius at half the width for tiny fills", () => {
    expect(pillPath(0, 0, 2, 8)).toContain("A1 1");
  });
  it("draws nothing for an empty bar", () => {
    expect(pillPath(0, 0, 0, 8)).toBe(EMPTY_PATH);
  });
});

describe("arcPath", () => {
  it("starts at 12 o'clock and runs clockwise", () => {
    // Quarter circle from 12 to 3 o'clock around (50, 50), r 40.
    expect(arcPath(50, 50, 40, 0, 90)).toBe("M50 10A40 40 0 0 1 90 50");
  });
  it("uses the large-arc flag past 180 degrees", () => {
    expect(arcPath(50, 50, 40, 0, 270)).toContain("0 1 1");
    expect(arcPath(50, 50, 40, 0, 90)).toContain("0 0 1");
  });
  it("still renders a full ring", () => {
    expect(arcPath(50, 50, 40, 0, 360)).not.toBe(EMPTY_PATH);
  });
  it("draws nothing for an empty sweep", () => {
    expect(arcPath(50, 50, 40, 0, 0)).toBe(EMPTY_PATH);
  });
});

describe("visibleSweep", () => {
  it("reveals arcs in order as the ring sweeps", () => {
    expect(visibleSweep(0, 0, 90)).toBe(0);
    expect(visibleSweep(0.125, 0, 90)).toBe(45);
    expect(visibleSweep(1, 0, 90)).toBe(90);
    expect(visibleSweep(0.2, 90, 90)).toBe(0);
    expect(visibleSweep(0.5, 90, 90)).toBe(90);
  });
});

describe("donutSpans", () => {
  it("makes a meter when the total is larger than the value", () => {
    expect(donutSpans([72], 100)).toEqual([{ start: 0, sweep: 259.2 }]);
  });
  it("fills the ring with one segment and no total", () => {
    expect(donutSpans([5])).toEqual([{ start: 0, sweep: 360 }]);
  });
  it("separates two or more segments with a gap", () => {
    const [a, b] = donutSpans([1, 1], undefined, 2);
    expect(a).toEqual({ start: 1, sweep: 178 });
    expect(b).toEqual({ start: 181, sweep: 178 });
  });
  it("keeps tiny segments visible", () => {
    const [, tiny] = donutSpans([99, 1], 100, 4);
    expect(tiny.sweep).toBeCloseTo(1.8);
  });
  it("draws nothing for zero, negative or invalid values", () => {
    expect(donutSpans([0, -3, NaN])).toEqual([
      { start: 0, sweep: 0 },
      { start: 0, sweep: 0 },
      { start: 0, sweep: 0 },
    ]);
    const spans = donutSpans([0, 10], 40, 2);
    expect(spans[0].sweep).toBe(0);
    expect(spans[1]).toEqual({ start: 0, sweep: 90 });
  });
});

describe("lines and areas", () => {
  const pts = [
    { x: 0, y: 10 },
    { x: 3, y: 6 },
    { x: 6, y: 10 },
  ];
  it("builds a polyline", () => {
    expect(linePath(pts)).toBe("M0 10L3 6L6 10");
    expect(linePath([])).toBe(EMPTY_PATH);
  });
  it("closes the area down to the base", () => {
    expect(areaPath(pts, 12)).toBe("M0 10L3 6L6 10L6 12L0 12Z");
    expect(areaPath(pts.slice(0, 1), 12)).toBe(EMPTY_PATH);
  });
  it("measures the polyline", () => {
    expect(polylineLength(pts)).toBe(10);
    expect(polylineLength([])).toBe(0);
  });
});

describe("sparkPoints", () => {
  it("spreads values across the width between their own min and max", () => {
    expect(sparkPoints([10, 20, 30], 100, 40, 5)).toEqual([
      { x: 5, y: 35 },
      { x: 50, y: 20 },
      { x: 95, y: 5 },
    ]);
  });
  it("puts a flat series in the middle", () => {
    expect(sparkPoints([7, 7], 100, 40).map(p => p.y)).toEqual([20, 20]);
  });
  it("is empty without data or size", () => {
    expect(sparkPoints([], 100, 40)).toEqual([]);
    expect(sparkPoints([1, 2], 0, 40)).toEqual([]);
  });
  it("treats invalid values as zero", () => {
    expect(sparkPoints([NaN, 10], 10, 10).map(p => p.y)).toEqual([10, 0]);
  });
});
