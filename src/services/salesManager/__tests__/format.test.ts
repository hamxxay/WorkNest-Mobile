// Desk wording of the Sales Manager screens: whole numbers with a unit word, never money.

import { countOf, deskTrend, desks, signedCount } from "../format";

describe("desks", () => {
  it.each([
    [91, "91 desks"],
    [1, "1 desk"],
    [0, "0 desks"],
    [1250, "1,250 desks"],
    [-1, "-1 desk"],
    [-6, "-6 desks"],
    [2.4, "2 desks"],
    [0.6, "1 desk"],
    [null, "0 desks"],
    [undefined, "0 desks"],
    [NaN, "0 desks"],
  ])("%p -> %p", (value, text) => {
    expect(desks(value as number | null | undefined)).toBe(text);
  });
});

describe("countOf", () => {
  it("picks the singular for exactly one", () => {
    expect(countOf(1, "lease", "leases")).toBe("1 lease");
    expect(countOf(4, "lease", "leases")).toBe("4 leases");
    expect(countOf(0, "quotation", "quotations")).toBe("0 quotations");
    expect(countOf(1200, "booking", "bookings")).toBe("1,200 bookings");
    expect(countOf(null, "booking", "bookings")).toBe("0 bookings");
  });
});

describe("signedCount", () => {
  it.each([
    [85, "+85"],
    [-3, "-3"],
    [0, "0"],
    [1500, "+1,500"],
    [null, "0"],
  ])("%p -> %p", (value, text) => {
    expect(signedCount(value as number | null)).toBe(text);
  });
});

describe("deskTrend", () => {
  it("is the absolute change in desks against the previous period", () => {
    expect(deskTrend(91, 85)).toEqual({ direction: "up", label: "6 vs last period", upIsGood: true });
    expect(deskTrend(80, 91)).toEqual({ direction: "down", label: "11 vs last period", upIsGood: true });
    expect(deskTrend(1500, 200)).toEqual({ direction: "up", label: "1,300 vs last period", upIsGood: true });
    expect(deskTrend(5, 5)).toEqual({ direction: "flat", label: "no change", upIsGood: true });
  });

  it("handles net desks going negative", () => {
    expect(deskTrend(-3, 4)).toEqual({ direction: "down", label: "7 vs last period", upIsGood: true });
    expect(deskTrend(2, -5)).toEqual({ direction: "up", label: "7 vs last period", upIsGood: true });
  });

  it("shows nothing without a previous figure, or when both are 0", () => {
    expect(deskTrend(91, null)).toBeUndefined();
    expect(deskTrend(91, undefined)).toBeUndefined();
    expect(deskTrend(91, NaN)).toBeUndefined();
    expect(deskTrend(0, 0)).toBeUndefined();
    expect(deskTrend(0, 3)).toEqual({ direction: "down", label: "3 vs last period", upIsGood: true });
  });
});
