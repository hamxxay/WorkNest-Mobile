/**
 * StatCard (the KPI tile of the CEO, Sales Manager and staff dashboards): the delta chip against the previous period
 * (arrow and figure on a soft green fill when the change is good, red when it is bad, neutral when flat; the " vs ..."
 * part of the label follows in muted text), in light and dark colours, and the screen-reader label keeping the whole
 * trend. React Native primitives, the icon font, Skeleton, ScalePressable, Sparkline and the theme hook are mocked so
 * this runs in plain Node.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({
  // The theme's typography reads Platform.OS when it loads (Inter font families per platform).
  Platform: { OS: "android", select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("../Skeleton", () => ({ SkeletonBlock: "SkeletonBlock", SkeletonGroup: "SkeletonGroup" }));
jest.mock("../motion/ScalePressable", () => ({ ScalePressable: "ScalePressable", PRESS_SCALE: 0.97 }));
jest.mock("../charts/Sparkline", () => ({ Sparkline: "Sparkline" }));
jest.mock("../../utils/responsive", () => ({ STAT_CARD_MIN_WIDTH: 148 }));
let mockDark = false;
jest.mock("../../theme", () => {
  const { radii, getShadows } = jest.requireActual("../../theme/tokens");
  const { lightColors, darkColors, lightTones, darkTones } = jest.requireActual("../../theme/colors");
  const { typography, fontFor } = jest.requireActual("../../theme/typography");
  return {
    fontFor,
    useTheme: () => ({
      colors: mockDark ? darkColors : lightColors,
      tones: mockDark ? darkTones : lightTones,
      typography,
      radii,
      shadows: getShadows(mockDark),
    }),
  };
});

import { darkColors, darkTones, lightColors, lightTones } from "../../theme/colors";
import { StatCard, type StatCardProps } from "./StatCard";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; IS_REACT_NATIVE_TEST_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

function render(props: StatCardProps): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<StatCard {...props} />);
  });
  return renderer!.root;
}

const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? style.reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...flat(s) }), {}) : ((style as Record<string, unknown>) ?? {});
const texts = (root: ReactTestInstance) => root.findAll((n) => n.type === ("Text" as unknown)).map((n) => n.props.children);
const textNode = (root: ReactTestInstance, text: string) => root.findAll((n) => n.type === ("Text" as unknown) && n.props.children === text)[0];
const icons = (root: ReactTestInstance) => root.findAll((n) => n.type === ("Ionicons" as unknown));

afterEach(() => {
  mockDark = false;
});

describe("StatCard delta chip", () => {
  test.each([
    ["light", false],
    ["dark", true],
  ])("a good rise: green chip with an up arrow, the comparison muted after it (%s)", (_name, dark) => {
    mockDark = dark;
    const tones = dark ? darkTones : lightTones;
    const colors = dark ? darkColors : lightColors;
    const root = render({ label: "Invoiced", value: "PKR 1.2M", sub: "this month", icon: "receipt-outline", trend: { direction: "up", label: "12% vs last period" } });
    expect(texts(root)).toEqual(["Invoiced", "PKR 1.2M", "12%", "vs last period", "this month"]);
    const arrow = icons(root).find((n) => n.props.name === "arrow-up")!;
    expect(arrow.props.color).toBe(tones.success.fg);
    expect(flat(arrow.parent!.props.style).backgroundColor).toBe(tones.success.bg);
    expect(flat(textNode(root, "12%").props.style).color).toBe(tones.success.fg);
    expect(flat(textNode(root, "vs last period").props.style).color).toBe(colors.textMuted);
    // Screen readers still hear the whole trend.
    expect(root.findAll((n) => n.type === ("View" as unknown) && n.props.accessible)[0].props.accessibilityLabel).toBe(
      "Invoiced, PKR 1.2M, this month, 12% vs last period",
    );
  });

  test("a rise that is bad (upIsGood false) is red; a fall that is good is green with a down arrow", () => {
    const bad = render({ label: "Overdue", value: "PKR 200K", trend: { direction: "up", label: "8% vs last period", upIsGood: false } });
    const up = icons(bad).find((n) => n.props.name === "arrow-up")!;
    expect(up.props.color).toBe(lightTones.danger.fg);
    expect(flat(up.parent!.props.style).backgroundColor).toBe(lightTones.danger.bg);

    const good = render({ label: "Overdue", value: "PKR 100K", trend: { direction: "down", label: "50% vs last period", upIsGood: false } });
    const down = icons(good).find((n) => n.props.name === "arrow-down")!;
    expect(down.props.color).toBe(lightTones.success.fg);
  });

  test("no change: a neutral chip with a dash and no comparison line", () => {
    const root = render({ label: "Occupancy", value: "72%", trend: { direction: "flat", label: "no change" } });
    const dash = icons(root).find((n) => n.props.name === "remove")!;
    expect(dash.props.color).toBe(lightTones.neutral.fg);
    expect(texts(root)).toEqual(["Occupancy", "72%", "no change"]);
  });

  test("no trend: no chip", () => {
    const root = render({ label: "Sales executives", value: 4, sub: "All locations", icon: "people-outline" });
    expect(icons(root).map((n) => n.props.name)).toEqual(["people-outline"]);
    expect(texts(root)).toEqual(["Sales executives", 4, "All locations"]);
  });

  test("the icon well follows the tone (status tiles stand out, plain figures stay brand teal)", () => {
    const plain = render({ label: "Invoiced", value: "PKR 1M", icon: "receipt-outline" });
    expect(icons(plain)[0].props.color).toBe(lightTones.primary.fg);
    const overdue = render({ label: "Overdue", value: "PKR 1M", icon: "alert-circle-outline", tone: "danger" });
    expect(icons(overdue)[0].props.color).toBe(lightTones.danger.fg);
    expect(flat(icons(overdue)[0].parent!.props.style).backgroundColor).toBe(lightTones.danger.bg);
  });
});
