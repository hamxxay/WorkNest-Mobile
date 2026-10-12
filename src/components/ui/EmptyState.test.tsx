/**
 * EmptyState / ErrorState: which picture they show (illustration, icon, cloud-off default) and that the picture is
 * hidden from screen readers while the title and message stay readable. React Native primitives, the icon font,
 * Button, Skeleton and the theme hook are mocked so this runs in plain Node.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { EmptyState, ErrorState } from "./States";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Svg: "Svg",
  Circle: "Circle",
  G: "G",
  Line: "Line",
  Path: "Path",
  Rect: "Rect",
}));
jest.mock("./Button", () => ({ Button: "Button" }));
jest.mock("../Skeleton", () => ({ SkeletonBlock: "SkeletonBlock", SkeletonGroup: "SkeletonGroup" }));
jest.mock("../../theme", () => {
  const { lightColors } = jest.requireActual("../../theme/colors");
  const { typography } = jest.requireActual("../../theme/typography");
  return { useTheme: () => ({ colors: lightColors, isDark: false, typography }) };
});

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; IS_REACT_NATIVE_TEST_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

function render(element: React.ReactElement): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}

/** displayName of the illustration component rendered, if any. */
function illustrationOf(root: ReactTestInstance): string | undefined {
  const found = root.findAll((n) => typeof n.type === "function" && /Illustration$/.test((n.type as { displayName?: string }).displayName ?? ""));
  return found.length ? (found[0].type as { displayName?: string }).displayName : undefined;
}

function svgOf(root: ReactTestInstance): ReactTestInstance {
  return root.findByType("Svg" as unknown as React.ElementType);
}

function iconOf(root: ReactTestInstance): string | undefined {
  const icons = root.findAll((n) => n.type === ("Ionicons" as unknown));
  return icons.length ? icons[0].props.name : undefined;
}

function texts(root: ReactTestInstance): string[] {
  return root.findAll((n) => n.type === ("Text" as unknown)).map((n) => String(n.props.children));
}

describe("EmptyState", () => {
  test("shows the illustration, hidden from screen readers, and keeps the text readable", () => {
    const root = render(<EmptyState illustration="calendar" title="No bookings yet" message="Book a space." />);
    expect(illustrationOf(root)).toBe("CalendarIllustration");
    expect(svgOf(root).props).toMatchObject({
      width: 140,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
    });
    expect(iconOf(root)).toBeUndefined();
    expect(texts(root)).toEqual(["No bookings yet", "Book a space."]);
    expect(root.findByProps({ children: "No bookings yet" }).props.accessibilityRole).toBe("header");
  });

  test("illustration takes precedence over icon", () => {
    const root = render(<EmptyState illustration="receipt" icon="receipt-outline" title="No payments" />);
    expect(illustrationOf(root)).toBe("ReceiptIllustration");
    expect(iconOf(root)).toBeUndefined();
  });

  test("without an illustration the icon still works (in a hidden well)", () => {
    const root = render(<EmptyState icon="images-outline" title="No photos" />);
    expect(illustrationOf(root)).toBeUndefined();
    expect(iconOf(root)).toBe("images-outline");
    const well = root.findAll((n) => n.type === ("View" as unknown) && n.props.importantForAccessibility === "no-hide-descendants");
    expect(well).toHaveLength(1);
    expect(iconOf(render(<EmptyState title="Nothing" />))).toBe("file-tray-outline");
  });

  test("compact uses a smaller illustration unless a size is given", () => {
    expect(svgOf(render(<EmptyState compact illustration="people" title="Nobody" />)).props.width).toBe(96);
    expect(svgOf(render(<EmptyState compact illustration="people" illustrationSize={120} title="Nobody" />)).props.width).toBe(120);
  });
});

describe("ErrorState", () => {
  test("defaults to the cloud-off illustration", () => {
    const root = render(<ErrorState message="Network error" />);
    expect(illustrationOf(root)).toBe("CloudOffIllustration");
    expect(iconOf(root)).toBeUndefined();
    expect(texts(root)).toEqual(["Could not load this", "Network error"]);
  });

  test("an icon replaces the default illustration", () => {
    const root = render(<ErrorState icon="alert-circle-outline" />);
    expect(illustrationOf(root)).toBeUndefined();
    expect(iconOf(root)).toBe("alert-circle-outline");
  });

  test("an explicit illustration takes precedence over icon", () => {
    const root = render(<ErrorState illustration="receipt" icon="alert-circle-outline" compact />);
    expect(illustrationOf(root)).toBe("ReceiptIllustration");
    expect(svgOf(root).props.width).toBe(96);
    expect(iconOf(root)).toBeUndefined();
  });
});
