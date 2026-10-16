/**
 * Screen-size rules shared by the app (src/utils/responsive.ts): grid columns, stacking button rows and label /
 * value rows, for the sizes the app must support: 320dp phones, 360-430dp phones, the Galaxy Z Fold6 cover screen
 * (~369dp) and inner screen (~707dp), tablets (768-1280dp) and system font sizes up to 200%.
 */
jest.mock("react-native", () => ({ useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1, scale: 3 }) }));

import {
  MAX_CONTENT_WIDTH,
  MAX_WIDE_CONTENT_WIDTH,
  STAT_CARD_MIN_WIDTH,
  columnsFor,
  estimateButtonWidth,
  itemWidthFor,
  maxWidthFor,
  scaledMinWidth,
  stackActions,
  stackLabelValue,
  textScale,
} from "../responsive";

/** Width of a screen's content (window minus the 16dp screen padding on both sides). */
const inner = (window: number) => Math.min(window, MAX_CONTENT_WIDTH) - 32;
const kpi = (width: number, fontScale = 1, count = 4) =>
  columnsFor(width, { minItemWidth: STAT_CARD_MIN_WIDTH, fontScale, count });

describe("textScale", () => {
  it("clamps the system font scale to 1..2", () => {
    expect(textScale(1)).toBe(1);
    expect(textScale(0.85)).toBe(1);
    expect(textScale(1.3)).toBe(1.3);
    expect(textScale(3.2)).toBe(2);
    expect(textScale(Number.NaN)).toBe(1);
    expect(textScale(undefined)).toBe(1);
  });

  it("grows only part of an item with the text", () => {
    expect(scaledMinWidth(100, 1)).toBe(100);
    expect(scaledMinWidth(100, 2)).toBe(150);
    expect(scaledMinWidth(100, 2, 1)).toBe(200);
  });
});

describe("content column", () => {
  it("is 720dp for forms and lists, 1120dp for dashboards, unlimited for full-bleed screens", () => {
    expect(maxWidthFor()).toBe(MAX_CONTENT_WIDTH);
    expect(maxWidthFor("content")).toBe(720);
    expect(maxWidthFor("wide")).toBe(MAX_WIDE_CONTENT_WIDTH);
    expect(maxWidthFor("full")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("KPI grid columns", () => {
  it("one tile per row on a 320dp phone, two on normal phones and the Fold cover screen", () => {
    expect(kpi(inner(320))).toBe(1);
    expect(kpi(inner(360))).toBe(2);
    expect(kpi(inner(369))).toBe(2);
    expect(kpi(inner(390))).toBe(2);
    expect(kpi(inner(430))).toBe(2);
  });

  it("four per row on the unfolded Fold and tablets", () => {
    expect(kpi(inner(707))).toBe(4);
    expect(kpi(inner(768))).toBe(4);
    expect(kpi(MAX_WIDE_CONTENT_WIDTH - 32)).toBe(4);
  });

  it("fewer, wider tiles with large text", () => {
    expect(kpi(inner(390), 1.3)).toBe(2);
    expect(kpi(inner(360), 1.3)).toBe(1);
    expect(kpi(inner(390), 2)).toBe(1);
    expect(kpi(inner(707), 2)).toBe(2);
  });

  it("never leaves a nearly empty last row", () => {
    // 4 tiles: 4, 2 or 1 per row, never 3 + 1.
    expect(columnsFor(500, { minItemWidth: 148, count: 4 })).toBe(2);
    // 6 tiles where 4 fit: 3 + 3.
    expect(kpi(inner(707), 1, 6)).toBe(3);
    // 5 tiles where 4 fit: 3 + 2.
    expect(kpi(inner(707), 1, 5)).toBe(3);
    // Never more columns than tiles.
    expect(kpi(inner(707), 1, 2)).toBe(2);
    expect(kpi(inner(707), 1, 1)).toBe(1);
  });

  it("is always at least one column", () => {
    expect(columnsFor(0, { minItemWidth: 148 })).toBe(1);
    expect(columnsFor(Number.NaN, { minItemWidth: 148 })).toBe(1);
    expect(columnsFor(-20, { minItemWidth: 148, count: 3 })).toBe(1);
  });

  it("cell widths plus gaps never exceed the row", () => {
    for (const width of [288, 328, 337, 675, 688, 1088]) {
      for (const cols of [1, 2, 3, 4]) {
        const cell = itemWidthFor(width, cols, 12);
        expect(cell * cols + 12 * (cols - 1)).toBeLessThanOrEqual(width);
      }
    }
    expect(itemWidthFor(675, 4)).toBe(159);
  });
});

describe("button rows", () => {
  it("keeps Cancel / Delete side by side in a dialog, even on a 320dp phone", () => {
    // ConfirmDialog: card = window - 48, minus 40 padding.
    expect(stackActions(360 - 48 - 40, 1, ["Cancel", "Delete"], 10)).toBe(false);
    expect(stackActions(320 - 48 - 40, 1, ["Cancel", "Delete"], 10)).toBe(false);
  });

  it("stacks long labels that would be cut off", () => {
    // BottomSheet footer on a 360dp phone: 360 - 40 padding.
    expect(stackActions(320, 1, ["Cancel", { title: "Delete account", icon: true }])).toBe(true);
    expect(stackActions(390 - 40, 1, ["Cancel", "Save"])).toBe(false);
  });

  it("stacks with large text when the labels no longer fit", () => {
    expect(stackActions(360 - 40, 1, ["Cancel", "Change password"])).toBe(true);
    expect(stackActions(412 - 40, 2, ["Cancel", "Save"])).toBe(false);
    expect(stackActions(360 - 40, 2, ["Back", "Decline"])).toBe(false);
    expect(stackActions(320 - 40, 2, ["Cancel", "Reassign"])).toBe(true);
  });

  it("without labels uses a minimum width per button that grows with the text", () => {
    expect(stackActions(280, 1, 2)).toBe(false);
    expect(stackActions(240, 1, 2)).toBe(true);
    expect(stackActions(330, 1.4, 2)).toBe(true);
  });

  it("never stacks a single button", () => {
    expect(stackActions(100, 2, 1)).toBe(false);
    expect(stackActions(100, 2, ["Done"])).toBe(false);
  });

  it("estimates wider buttons for longer labels, icons and larger text (capped like the Button text)", () => {
    expect(estimateButtonWidth("Delete account")).toBeGreaterThan(estimateButtonWidth("Cancel"));
    expect(estimateButtonWidth("Save", 1, true)).toBeGreaterThan(estimateButtonWidth("Save"));
    expect(estimateButtonWidth("Save", 2)).toBe(estimateButtonWidth("Save", 1.4));
  });
});

describe("label / value rows", () => {
  it("stay side by side at normal text sizes", () => {
    expect(stackLabelValue(320, 1)).toBe(false);
    expect(stackLabelValue(412, 1.15)).toBe(false);
  });

  it("stack with large text on a phone, not on the unfolded Fold", () => {
    expect(stackLabelValue(360, 1.3)).toBe(true);
    expect(stackLabelValue(412, 2)).toBe(true);
    expect(stackLabelValue(707, 2)).toBe(false);
  });
});
