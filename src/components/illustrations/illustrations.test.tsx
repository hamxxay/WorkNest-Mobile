/**
 * The illustration name map, and a render of every drawing in light and dark mode. react-native-svg and the theme
 * hook are mocked, so this runs in plain Node (the React Native Jest preset is not needed).
 */
import React from "react";
import TestRenderer, { act, type ReactTestRendererJSON } from "react-test-renderer";
import { darkColors, lightColors } from "../../theme/colors";
import { Illustration, ILLUSTRATION_NAMES, illustrationPalette, illustrations, isIllustrationName, type IllustrationName } from ".";

let mockScheme: "light" | "dark" = "light";

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

jest.mock("../../theme", () => {
  const { lightColors: light, darkColors: dark } = jest.requireActual("../../theme/colors");
  return {
    useTheme: () => ({ colors: mockScheme === "dark" ? dark : light, isDark: mockScheme === "dark" }),
  };
});

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; IS_REACT_NATIVE_TEST_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

function render(element: React.ReactElement): ReactTestRendererJSON | null {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.toJSON() as ReactTestRendererJSON | null;
}

/** Every fill / stroke used anywhere in the tree. */
function paints(node: ReactTestRendererJSON): string[] {
  const own = [node.props.fill, node.props.stroke].filter((v): v is string => typeof v === "string");
  const kids = (node.children ?? []).filter((c): c is ReactTestRendererJSON => typeof c !== "string");
  return [...own, ...kids.flatMap(paints)];
}

/** The ten illustrations the empty and error states rely on. */
const REQUIRED: IllustrationName[] = [
  "calendar",
  "receipt",
  "document",
  "people",
  "bell",
  "search",
  "inbox",
  "door",
  "chart",
  "cloud-off",
];

describe("illustration name map", () => {
  test("lists every name once, including the ten the states rely on", () => {
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(ILLUSTRATION_NAMES.length);
    expect(ILLUSTRATION_NAMES).toEqual(expect.arrayContaining(REQUIRED));
  });

  test("maps each name to exactly one named component", () => {
    expect(Object.keys(illustrations).sort()).toEqual([...ILLUSTRATION_NAMES].sort());
    const components = ILLUSTRATION_NAMES.map((name) => illustrations[name]);
    components.forEach((component) => {
      expect(typeof component).toBe("function");
      expect(component.displayName).toMatch(/^[A-Z][A-Za-z]+Illustration$/);
    });
    expect(new Set(components).size).toBe(components.length);
  });

  test("isIllustrationName accepts the names only", () => {
    ILLUSTRATION_NAMES.forEach((name) => expect(isIllustrationName(name)).toBe(true));
    ["Calendar", "calendar-outline", "cloudOff", "", null, undefined, 42].forEach((value) =>
      expect(isIllustrationName(value)).toBe(false),
    );
  });
});

describe.each(["light", "dark"] as const)("illustrations in %s mode", (scheme) => {
  const colors = scheme === "dark" ? darkColors : lightColors;
  const allowed = new Set<string>([...Object.values(illustrationPalette(colors, scheme === "dark")), "none"]);

  beforeEach(() => {
    mockScheme = scheme;
  });

  test.each([...ILLUSTRATION_NAMES])("%s draws with theme colours only and is hidden from screen readers", (name) => {
    const tree = render(<Illustration name={name} size={120} />);
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe("Svg");
    expect(tree!.props).toMatchObject({
      width: 120,
      height: 120,
      viewBox: "0 0 160 160",
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
    });
    const used = paints(tree!);
    expect(used.length).toBeGreaterThan(3);
    used.forEach((paint) => expect(allowed).toContain(paint));
    // The backdrop disc comes first and uses the soft brand tint.
    expect(used[0]).toBe(colors.primarySoft);
  });
});

describe("Illustration", () => {
  beforeEach(() => {
    mockScheme = "light";
  });

  test("defaults to 140dp", () => {
    expect(render(<Illustration name="bell" />)!.props).toMatchObject({ width: 140, height: 140 });
  });

  test("with an accessibilityLabel it is announced as an image", () => {
    const props = render(<Illustration name="calendar" accessibilityLabel="Empty calendar" />)!.props;
    expect(props).toMatchObject({ accessible: true, accessibilityRole: "image", accessibilityLabel: "Empty calendar" });
    expect(props.importantForAccessibility).toBeUndefined();
  });

  test("renders nothing for an unknown name", () => {
    expect(render(<Illustration name={"unknown" as IllustrationName} />)).toBeNull();
  });
});
