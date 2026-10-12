import {
  ACTIVE_TAB_EXTRA,
  TAB_BAR_HEIGHT,
  TAB_ITEM_HEIGHT,
  clampTabPosition,
  tabActiveness,
  tabBarBottomOffset,
  tabBarSpace,
  tabUnitWidth,
} from "./tabBarMetrics";

describe("tab bar footprint", () => {
  it("tab items keep a 44dp+ touch target", () => {
    expect(TAB_ITEM_HEIGHT).toBeGreaterThanOrEqual(44);
  });

  it("sits a small gap above the bottom inset (gesture handle / navigation bar)", () => {
    expect(tabBarBottomOffset(24)).toBe(32);
    expect(tabBarBottomOffset(48)).toBe(56);
  });

  it("keeps a gap from the screen edge when there is no inset", () => {
    expect(tabBarBottomOffset(0)).toBe(12);
    expect(tabBarBottomOffset(Number.NaN)).toBe(12);
    expect(tabBarBottomOffset(-4)).toBe(12);
  });

  it("space = bar + gap + inset", () => {
    expect(tabBarSpace(24)).toBe(TAB_BAR_HEIGHT + 8 + 24);
    expect(tabBarSpace(0)).toBe(TAB_BAR_HEIGHT + 12);
  });

  it("toasts (80dp above the inset) stay clear of the bar", () => {
    for (const inset of [0, 24, 48]) expect(tabBarSpace(inset)).toBeLessThanOrEqual(inset + 80);
  });
});

describe("tab row layout", () => {
  it("selected tab is fully active, its neighbours not at all", () => {
    expect(tabActiveness(2, 2)).toBe(1);
    expect(tabActiveness(2, 1)).toBe(0);
    expect(tabActiveness(2, 3)).toBe(0);
    expect(tabActiveness(2, 0)).toBe(0);
  });

  it("between two tabs, the two share the selection and sum to 1", () => {
    const p = 1.25;
    expect(tabActiveness(p, 1)).toBeCloseTo(0.75);
    expect(tabActiveness(p, 2)).toBeCloseTo(0.25);
    const total = [0, 1, 2, 3, 4].reduce((sum, i) => sum + tabActiveness(p, i), 0);
    expect(total).toBeCloseTo(1);
  });

  it("row widths add up: n inactive units plus the active extra fill the row", () => {
    const width = 316;
    const unit = tabUnitWidth(width, 5);
    expect(unit * (5 + ACTIVE_TAB_EXTRA)).toBeCloseTo(width);
    // The indicator (1 + extra units wide, at unit * index) ends on the row edge for the last tab.
    expect(unit * 4 + unit * (1 + ACTIVE_TAB_EXTRA)).toBeCloseTo(width);
  });

  it("inactive tabs stay at or above 44dp on a 360dp phone", () => {
    const row = 360 - 2 * 16 - 2 * 5;
    expect(tabUnitWidth(row, 5)).toBeGreaterThanOrEqual(44);
  });

  it("unit width is 0 before the row is measured", () => {
    expect(tabUnitWidth(0, 5)).toBe(0);
    expect(tabUnitWidth(300, 0)).toBe(0);
  });

  it("clamps spring overshoot to the first / last tab", () => {
    expect(clampTabPosition(-0.1, 5)).toBe(0);
    expect(clampTabPosition(4.2, 5)).toBe(4);
    expect(clampTabPosition(2.5, 5)).toBe(2.5);
    expect(clampTabPosition(3, 0)).toBe(0);
  });
});
