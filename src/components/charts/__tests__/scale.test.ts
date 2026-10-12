import {
  bandLayout,
  cleanValues,
  compactLabel,
  extent,
  isAllZero,
  labelStep,
  linearScale,
  niceDomain,
  niceStep,
  niceTicks,
  percentOf,
  toFinite,
  trendDirection,
} from "../scale";

describe("toFinite / cleanValues", () => {
  it("turns missing and non-finite values into 0", () => {
    expect(toFinite(null)).toBe(0);
    expect(toFinite(undefined)).toBe(0);
    expect(toFinite(NaN)).toBe(0);
    expect(toFinite(Infinity)).toBe(0);
    expect(toFinite(-12.5)).toBe(-12.5);
    expect(cleanValues([1, null, NaN, 3])).toEqual([1, 0, 0, 3]);
    expect(cleanValues(undefined)).toEqual([]);
  });
});

describe("extent", () => {
  it("returns min and max of the finite values", () => {
    expect(extent([3, -2, 9, NaN, null, 4])).toEqual([-2, 9]);
  });
  it("returns [0, 0] when there is nothing", () => {
    expect(extent([])).toEqual([0, 0]);
    expect(extent([NaN, null, undefined])).toEqual([0, 0]);
  });
});

describe("isAllZero", () => {
  it("is true for empty, zero and invalid data", () => {
    expect(isAllZero([])).toBe(true);
    expect(isAllZero([0, 0, NaN, null])).toBe(true);
    expect(isAllZero([0, 0.5])).toBe(false);
  });
});

describe("niceStep", () => {
  it("picks 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(1_234_567, 4)).toBe(500_000);
    expect(niceStep(8, 4)).toBe(2);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(3.6, 4)).toBe(1);
    expect(niceStep(1, 4)).toBe(0.25);
    expect(niceStep(40, 4)).toBe(10);
  });
  it("falls back to 1 for an empty or invalid span", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(NaN)).toBe(1);
  });
});

describe("niceDomain / niceTicks", () => {
  it("starts at zero and rounds the top up to a nice step", () => {
    expect(niceDomain(0, 1_234_567)).toEqual({ min: 0, max: 1_500_000, step: 500_000, ticks: [0, 500_000, 1_000_000, 1_500_000] });
    expect(niceTicks(0, 87)).toEqual([0, 25, 50, 75, 100]);
  });
  it("includes zero for positive data by default", () => {
    expect(niceDomain(40, 90).min).toBe(0);
  });
  it("can fit the data without zero", () => {
    const d = niceDomain(62, 71, { includeZero: false });
    expect(d.min).toBeLessThanOrEqual(62);
    expect(d.max).toBeGreaterThanOrEqual(71);
    expect(d.min).toBeGreaterThan(0);
  });
  it("spans negative values", () => {
    expect(niceTicks(-30, 70)).toEqual([-50, -25, 0, 25, 50, 75]);
  });
  it("gives an all-zero series a 0..1 domain", () => {
    expect(niceDomain(0, 0)).toEqual({ min: 0, max: 1, step: 1, ticks: [0, 1] });
  });
  it("pads a flat series that excludes zero", () => {
    const d = niceDomain(500, 500, { includeZero: false });
    expect(d.min).toBeLessThan(500);
    expect(d.max).toBeGreaterThan(500);
  });
  it("swaps reversed bounds and ignores invalid input", () => {
    expect(niceTicks(100, 0)).toEqual([0, 25, 50, 75, 100]);
    expect(niceDomain(NaN, Infinity)).toEqual({ min: 0, max: 1, step: 1, ticks: [0, 1] });
  });
  it("prints decimal ticks without float noise", () => {
    expect(niceTicks(0, 0.3, { count: 3 })).toEqual([0, 0.1, 0.2, 0.3]);
    expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it("honours the tick count", () => {
    expect(niceTicks(0, 100, { count: 2 })).toEqual([0, 50, 100]);
    expect(niceTicks(0, 100, { count: 10 })).toHaveLength(11);
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range (inverted for SVG y)", () => {
    const y = linearScale([0, 100], [150, 10]);
    expect(y(0)).toBe(150);
    expect(y(100)).toBe(10);
    expect(y(50)).toBe(80);
  });
  it("extrapolates unless clamped", () => {
    expect(linearScale([0, 10], [0, 100])(20)).toBe(200);
    expect(linearScale([0, 10], [0, 100], true)(20)).toBe(100);
    expect(linearScale([0, 10], [0, 100], true)(-5)).toBe(0);
  });
  it("maps a zero-width domain to the range start", () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(0);
  });
});

describe("percentOf", () => {
  it("returns a clamped percentage", () => {
    expect(percentOf(18, 25)).toBe(72);
    expect(percentOf(30, 25)).toBe(100);
    expect(percentOf(-1, 25)).toBe(0);
  });
  it("returns 0 for a zero or invalid total", () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(5, NaN)).toBe(0);
  });
});

describe("compactLabel", () => {
  it("uses the app compact number format", () => {
    expect(compactLabel(0)).toBe("0");
    expect(compactLabel(950)).toBe("950");
    expect(compactLabel(12_500)).toBe("12.5K");
    expect(compactLabel(1_250_000)).toBe("1.25M");
    expect(compactLabel(500_000)).toBe("500K");
    expect(compactLabel(3_400_000_000)).toBe("3.4B");
  });
  it("adds a currency prefix through formatMoney", () => {
    expect(compactLabel(1_250_000, { currency: "PKR" })).toBe("PKR 1.25M");
    expect(compactLabel(-1200, { currency: "PKR" })).toBe("-PKR 1.2K");
  });
  it("treats invalid input as zero", () => {
    expect(compactLabel(NaN)).toBe("0");
  });
});

describe("bandLayout", () => {
  it("centres capped bars in equal slots", () => {
    const l = bandLayout({ count: 3, width: 300 });
    expect(l.slot).toBe(100);
    expect(l.barWidth).toBe(24);
    expect(l.groups.map(g => g.center)).toEqual([50, 150, 250]);
    expect(l.groups[0].bars).toEqual([38]);
  });
  it("puts a 2px gap between the bars of a group", () => {
    const l = bandLayout({ count: 6, groupSize: 2, width: 300 });
    expect(l.slot).toBe(50);
    expect(l.barWidth).toBeLessThanOrEqual(24);
    const [a, b] = l.groups[0].bars;
    expect(b - a).toBeCloseTo(l.barWidth + 2);
    expect(l.groupWidth).toBeCloseTo(l.barWidth * 2 + 2);
    // Group stays inside its slot.
    expect(l.groups[0].x).toBeGreaterThanOrEqual(0);
    expect(l.groups[0].x + l.groupWidth).toBeLessThanOrEqual(l.slot);
  });
  it("never makes a bar thinner than 1px", () => {
    const l = bandLayout({ count: 40, groupSize: 3, width: 100 });
    expect(l.barWidth).toBe(1);
  });
  it("is empty without categories or width", () => {
    expect(bandLayout({ count: 0, width: 300 }).groups).toEqual([]);
    expect(bandLayout({ count: 4, width: 0 }).groups).toEqual([]);
  });
});

describe("labelStep", () => {
  it("thins labels that would collide", () => {
    expect(labelStep(6, 300, 36)).toBe(1);
    expect(labelStep(12, 240, 36)).toBe(2);
    expect(labelStep(24, 240, 36)).toBe(4);
  });
  it("is 1 for a single label or no width", () => {
    expect(labelStep(1, 10)).toBe(1);
    expect(labelStep(12, 0)).toBe(1);
  });
});

describe("trendDirection", () => {
  it("compares the first and last values", () => {
    expect(trendDirection([62, 65, 71])).toBe("up");
    expect(trendDirection([900, 700, 400])).toBe("down");
  });
  it("calls small changes and short series flat", () => {
    expect(trendDirection([100, 140, 101])).toBe("flat");
    expect(trendDirection([5])).toBe("flat");
    expect(trendDirection([])).toBe("flat");
    expect(trendDirection([0, 0, 0])).toBe("flat");
  });
});
