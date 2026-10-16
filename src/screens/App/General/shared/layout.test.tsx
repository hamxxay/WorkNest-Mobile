/**
 * Layout decisions of the customer screens: card lists in columns on wide windows, title + pill rows that wrap,
 * button labels that fit, side buttons that move under the text, and the onboarding card layout. The window size
 * and font scale are mocked (320dp phone, 390dp phone, Galaxy Z Fold6 cover and inner screen, tablet, landscape).
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { slideLayout } from "../../../Auth/onboardingLayout";

type Dims = { width: number; height: number; fontScale: number; scale: number };
let mockDims: Dims = { width: 390, height: 844, fontScale: 1, scale: 3 };
let mockInsets = { top: 24, bottom: 16, left: 0, right: 0 };

jest.mock("react-native", () => ({
  StyleSheet: { create: <T,>(s: T) => s },
  useWindowDimensions: () => mockDims,
  View: "View",
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock("../../../../theme", () => ({ spacing: jest.requireActual("../../../../theme/tokens").spacing }));
jest.mock("../../../../components/ui", () => ({ AppText: "AppText" }));

import { contentWidthFor, fittingLabel, stackSideAction, useCardGrid } from "./layout";
import { TitleRow } from "./TitleRow";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

const setWindow = (width: number, height: number, fontScale = 1) => {
  mockDims = { width, height, fontScale, scale: 3 };
};
const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? style.reduce((acc, s) => ({ ...acc, ...flat(s) }), {}) : ((style as Record<string, unknown>) ?? {});

beforeEach(() => {
  setWindow(390, 844);
  mockInsets = { top: 24, bottom: 16, left: 0, right: 0 };
});

describe("contentWidthFor", () => {
  it("is the window minus the screen padding on a phone, the 720dp column on a tablet", () => {
    expect(contentWidthFor(390)).toBe(358);
    expect(contentWidthFor(1280)).toBe(688);
  });

  it("leaves out side insets (a phone in landscape with the navigation buttons on the side)", () => {
    expect(contentWidthFor(844, 0, 48)).toBe(688);
    expect(contentWidthFor(640, 0, 48)).toBe(560);
  });

  it("uses the whole window for full-width screens (gallery)", () => {
    expect(contentWidthFor(1280, 0, 0, "full")).toBe(1248);
  });
});

describe("fittingLabel", () => {
  const confirm = ["Confirm booking and get challan", "Confirm and get challan", "Confirm booking"];

  it("keeps the full label on a normal phone", () => {
    expect(fittingLabel(confirm, contentWidthFor(390), 1)).toBe(confirm[0]);
  });

  it("uses a shorter label with the same meaning on a 320dp phone and with large text", () => {
    expect(fittingLabel(confirm, contentWidthFor(320), 1)).toBe(confirm[1]);
    expect(fittingLabel(confirm, contentWidthFor(320), 2)).toBe(confirm[2]);
  });
});

describe("stackSideAction (Remove beside an employee, Unlock beside a door)", () => {
  // Employee row: content width - 2 x 16 row padding; avatar + gaps = 60dp.
  const row = (width: number) => contentWidthFor(width) - 32;

  it("keeps the button beside the text on 360-430dp phones", () => {
    expect(stackSideAction(row(390), 60, "Remove", 1, true)).toBe(false);
    expect(stackSideAction(row(360), 60, "Remove", 1, true)).toBe(false);
    expect(stackSideAction(row(369), 60, "Remove", 1, true)).toBe(false);
  });

  it("puts it under the text on a 320dp phone and with large text", () => {
    expect(stackSideAction(row(320), 60, "Remove", 1, true)).toBe(true);
    expect(stackSideAction(row(390), 60, "Remove", 1.5, true)).toBe(true);
    expect(stackSideAction(row(390), 60, "Remove", 2, true)).toBe(true);
  });

  it("keeps it beside the text on a tablet even with large text", () => {
    expect(stackSideAction(row(1024), 60, "Remove", 2, true)).toBe(false);
  });
});

describe("useCardGrid (bookings, bills, agreements, spaces)", () => {
  let grid: ReturnType<typeof useCardGrid> | undefined;
  function Probe({ minItemWidth }: { minItemWidth: number }) {
    grid = useCardGrid({ minItemWidth });
    return null;
  }

  it("one card per row on phones and the Fold cover screen (cards fill the row as before)", () => {
    for (const width of [320, 369, 390, 430]) {
      setWindow(width, 800);
      render(<Probe minItemWidth={320} />);
      expect(grid?.numColumns).toBe(1);
      expect(grid?.cellStyle).toBeUndefined();
      expect(grid?.columnWrapperStyle).toBeUndefined();
    }
  });

  it("two per row on the unfolded Fold, a tablet and a phone in landscape", () => {
    setWindow(707, 680);
    render(<Probe minItemWidth={320} />);
    expect(grid?.numColumns).toBe(2);
    // 707 - 32 = 675; two columns with a 12dp gap.
    expect(grid?.cellStyle).toEqual({ width: 331 });

    setWindow(1280, 800);
    render(<Probe minItemWidth={320} />);
    expect(grid?.numColumns).toBe(2);
    expect(grid?.cellStyle).toEqual({ width: 338 });

    setWindow(844, 390);
    render(<Probe minItemWidth={320} />);
    expect(grid?.numColumns).toBe(2);
  });

  it("back to one per row on the unfolded Fold with large text", () => {
    setWindow(707, 680, 1.3);
    render(<Probe minItemWidth={320} />);
    expect(grid?.numColumns).toBe(1);
  });
});

describe("TitleRow", () => {
  const title = (root: ReactTestInstance) => root.findAll((n) => n.type === ("AppText" as unknown))[0];

  it("wraps the pill under the title instead of squeezing it: the title keeps a minimum width", () => {
    const { root } = render(<TitleRow title="Private Office, Gulberg" right={React.createElement("Pill")} />);
    const row = root.findAll((n) => n.type === ("View" as unknown))[0];
    expect(flat(row.props.style)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
    expect(flat(title(root).props.style)).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 120 });
    expect(title(root).props.numberOfLines).toBe(1);
  });

  it("the minimum grows with the font size and the title gets a second line", () => {
    setWindow(390, 844, 2);
    const { root } = render(<TitleRow title="Private Office, Gulberg" right={React.createElement("Pill")} />);
    expect(flat(title(root).props.style).flexBasis).toBe(240);
    expect(title(root).props.numberOfLines).toBe(2);
  });
});

describe("slideLayout (onboarding card)", () => {
  it("phone in portrait: photo on top, 4:3 of the card width", () => {
    expect(slideLayout({ width: 350, height: 600, windowHeight: 844 })).toEqual({ side: false, imageHeight: 262, cardHeight: null });
  });

  it("large text: a smaller photo so the text has room", () => {
    expect(slideLayout({ width: 350, height: 560, windowHeight: 844, fontScale: 1.5 }).imageHeight).toBe(224);
  });

  it("phone in landscape: photo beside the text, a card height that fits the text (the screen scrolls)", () => {
    expect(slideLayout({ width: 680, height: 0, windowHeight: 390, short: true })).toEqual({ side: true, imageHeight: 0, cardHeight: 240 });
    expect(slideLayout({ width: 680, height: 0, windowHeight: 390, fontScale: 2, short: true }).cardHeight).toBe(480);
  });

  it("unfolded Fold held wide: photo beside the text; tablet in portrait: stacked", () => {
    expect(slideLayout({ width: 667, height: 420, windowHeight: 650 }).side).toBe(true);
    expect(slideLayout({ width: 680, height: 800, windowHeight: 1024 })).toEqual({ side: false, imageHeight: 440, cardHeight: null });
  });
});
