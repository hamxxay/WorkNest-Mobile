/**
 * Layouts that follow the window size and the system font size: ResponsiveGrid columns, the Screen content
 * column with the full-width header behind it (and no remount when a foldable switches screens), stacked footer
 * buttons in BottomSheet and ConfirmDialog, and InfoRow stacking with large text. useWindowDimensions is mocked
 * (phone, Galaxy Z Fold6 cover and inner screen, tablet; font scale 1 to 2). React Native primitives and the
 * leaf components are mocked so this runs in plain Node.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

type Dims = { width: number; height: number; fontScale: number; scale: number };
let mockDims: Dims = { width: 390, height: 844, fontScale: 1, scale: 3 };
let mockInsets = { top: 24, bottom: 16, left: 0, right: 0 };

jest.mock("react-native", () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) return style.reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...flatten(s) }), {});
    return typeof style === "object" ? (style as Record<string, unknown>) : {};
  };
  class Value {
    interpolate() {
      return 0;
    }
  }
  return {
    Platform: { OS: "android", select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default },
    StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1, flatten, absoluteFill: { position: "absolute" } },
    useWindowDimensions: () => mockDims,
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    Modal: "Modal",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    StatusBar: "StatusBar",
    Animated: { Value, View: "AnimatedView", timing: () => ({ start: () => undefined }) },
    Easing: { out: (f: unknown) => f, in: (f: unknown) => f, cubic: 0 },
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
  SafeAreaView: "SafeAreaView",
}));
jest.mock("@react-navigation/native", () => {
  const R = jest.requireActual("react");
  return { NavigationContext: R.createContext(undefined), NavigationRouteContext: R.createContext(undefined) };
});
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("./Button", () => ({ Button: "Button", IconButton: "IconButton" }));
jest.mock("./Banner", () => ({ Banner: "Banner" }));
jest.mock("./Toast", () => ({ ToastModalHost: "ToastModalHost" }));
jest.mock("./BrandLogo", () => ({ BrandLogo: "BrandLogo" }));
jest.mock("./FocusAwareStatusBar", () => ({
  FocusAwareStatusBar: "FocusAwareStatusBar",
  barStyleFor: () => "dark-content",
}));
jest.mock("../../utils/haptics", () => ({ haptics: { error: jest.fn() } }));
jest.mock("../motion/ScalePressable", () => ({ ScalePressable: "ScalePressable", PRESS_SCALE_LARGE: 0.98 }));
jest.mock("./Avatar", () => ({ Avatar: "Avatar" }));
jest.mock("../../theme", () => {
  const tokens = jest.requireActual("../../theme/tokens");
  const { lightColors, lightTones } = jest.requireActual("../../theme/colors");
  const typo = jest.requireActual("../../theme/typography");
  const theme = {
    colors: lightColors,
    tones: lightTones,
    isDark: false,
    radii: tokens.radii,
    typography: typo.typography,
    shadows: { sm: {}, md: {}, lg: {} },
  };
  return {
    spacing: tokens.spacing,
    radii: tokens.radii,
    tabularNums: typo.tabularNums,
    fontFor: typo.fontFor,
    withBrandFont: (s: unknown) => s,
    useTheme: () => theme,
  };
});

import { StyleSheet } from "react-native";
import { Screen } from "../Screen";
import { AppHeader } from "./AppHeader";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import { InfoRow } from "./InfoRow";
import { ListRow } from "./ListRow";
import { ResponsiveGrid } from "./ResponsiveGrid";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) as Record<string, any>;
const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const setWindow = (width: number, height: number, fontScale = 1) => {
  mockDims = { width, height, fontScale, scale: 3 };
};

beforeEach(() => {
  setWindow(390, 844);
  mockInsets = { top: 24, bottom: 16, left: 0, right: 0 };
});

// ─── ResponsiveGrid ────────────────────────────────────────────────────────────────────────────────────────

function Tiles({ count = 4 }: { count?: number }) {
  return (
    <ResponsiveGrid testID="grid" minItemWidth={148}>
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>
          {React.createElement("Tile", { id: i })}
        </React.Fragment>
      ))}
    </ResponsiveGrid>
  );
}

const gridView = (root: ReactTestInstance) => root.findAll((n) => n.type === ("View" as unknown) && n.props.testID === "grid")[0];
const cells = (root: ReactTestInstance) => gridView(root).children as ReactTestInstance[];
const cellWidths = (root: ReactTestInstance) => cells(root).map((c) => flat(c).width);

describe("ResponsiveGrid", () => {
  it("two tiles per row on a phone (first frame: estimated from the window)", () => {
    const { root } = render(<Tiles />);
    // 390 - 2 x 16 screen padding = 358; two columns with a 12dp gap.
    expect(cellWidths(root)).toEqual([173, 173, 173, 173]);
  });

  it("re-measures itself: four per row once laid out on the unfolded Fold", () => {
    const { root } = render(<Tiles />);
    act(() => {
      gridView(root).props.onLayout({ nativeEvent: { layout: { width: 675, height: 0, x: 0, y: 0 } } });
    });
    expect(cellWidths(root)).toEqual([159, 159, 159, 159]);
  });

  it("one per row on a 320dp phone and with the largest text", () => {
    setWindow(320, 640);
    expect(cellWidths(render(<Tiles />).root)).toEqual([288, 288, 288, 288]);
    setWindow(390, 844, 2);
    expect(cellWidths(render(<Tiles />).root)).toEqual([358, 358, 358, 358]);
  });

  it("an odd last tile fills its row", () => {
    const { root } = render(<Tiles count={3} />);
    // 3 tiles at 358dp: two columns, the third tile alone in the last row takes all of it.
    const [first, , last] = cells(root);
    expect(flat(first).flexGrow).toBeUndefined();
    expect(flat(last).flexGrow).toBe(1);
  });
});

// ─── Screen + AppHeader ────────────────────────────────────────────────────────────────────────────────────

let mounts = 0;
function Form() {
  React.useEffect(() => {
    mounts += 1;
  }, []);
  return React.createElement("FormBody");
}

const column = (root: ReactTestInstance) => byType(root, "SafeAreaView")[0].children[0] as ReactTestInstance;
const bleed = (root: ReactTestInstance) => root.findAll((n) => n.props.testID === "app-header-bleed" && n.type === ("View" as unknown));

describe("Screen content column", () => {
  it("phones: full width, header without a bleed", () => {
    const { root } = render(
      <Screen>
        <AppHeader title="Bookings" />
      </Screen>,
    );
    expect(flat(column(root)).maxWidth).toBe(720);
    expect(bleed(root)).toHaveLength(0);
  });

  it("tablets: a centred 720dp column, the header background still spans the window", () => {
    setWindow(1000, 800);
    const { root } = render(
      <Screen>
        <AppHeader title="Bookings" />
      </Screen>,
    );
    const [b] = bleed(root);
    expect(flat(b)).toMatchObject({ left: -140, right: -140 });
  });

  it("dashboards: a 1120dp column", () => {
    setWindow(1280, 800);
    const { root } = render(
      <Screen width="wide">
        <AppHeader variant="dashboard" title="Dashboard" />
      </Screen>,
    );
    expect(flat(column(root)).maxWidth).toBe(1120);
    expect(flat(bleed(root)[0])).toMatchObject({ left: -80, right: -80 });
  });

  it("landscape: the header covers the side insets too", () => {
    setWindow(844, 390);
    mockInsets = { top: 0, bottom: 0, left: 48, right: 48 };
    const { root } = render(
      <Screen>
        <AppHeader title="Bookings" />
      </Screen>,
    );
    // 844 - 96 insets = 748; column 720, 14 each side + the inset.
    expect(flat(bleed(root)[0])).toMatchObject({ left: -62, right: -62 });
  });

  it("opening the Fold (cover -> inner screen) keeps the screen's content mounted", () => {
    mounts = 0;
    setWindow(369, 860);
    const tree = render(
      <Screen>
        <Form />
      </Screen>,
    );
    setWindow(707, 816);
    act(() => {
      tree.update(
        <Screen>
          <Form />
        </Screen>,
      );
    });
    setWindow(1000, 800);
    act(() => {
      tree.update(
        <Screen>
          <Form />
        </Screen>,
      );
    });
    expect(mounts).toBe(1);
    expect(flat(column(tree.root)).maxWidth).toBe(720);
  });
});

// ─── Button rows ───────────────────────────────────────────────────────────────────────────────────────────

const footerOf = (root: ReactTestInstance) =>
  byType(root, "View").find((v) => flat(v).borderTopWidth === StyleSheet.hairlineWidth && flat(v).paddingTop === 12)!;

function Sheet({ confirm, icon }: { confirm: string; icon?: string }) {
  return (
    <BottomSheet
      visible
      onClose={() => undefined}
      title="Delete"
      footer={
        <>
          {React.createElement("Button", { title: "Cancel", style: { flex: 1 } })}
          {React.createElement("Button", { title: confirm, leftIcon: icon, style: { flex: 1 } })}
        </>
      }
    >
      {React.createElement("Body")}
    </BottomSheet>
  );
}

describe("BottomSheet footer", () => {
  it("short labels stay side by side", () => {
    setWindow(412, 900);
    const footer = footerOf(render(<Sheet confirm="Save" />).root);
    expect(flat(footer).flexDirection).toBe("row");
  });

  it("a long label on a 360dp phone stacks the buttons, main action on top, flex reset", () => {
    setWindow(360, 780);
    const footer = footerOf(render(<Sheet confirm="Delete account" icon="trash-outline" />).root);
    expect(flat(footer).flexDirection).toBe("column-reverse");
    const buttons = byType(footer, "Button");
    expect(buttons.map((b) => b.props.title)).toEqual(["Cancel", "Delete account"]);
    for (const b of buttons) expect(flat(b)).toMatchObject({ flexGrow: 0, flexBasis: "auto" });
  });

  it("large text stacks buttons that fit at the default size", () => {
    setWindow(320, 640);
    expect(flat(footerOf(render(<Sheet confirm="Reassign" />).root)).flexDirection).toBe("row");
    setWindow(320, 640, 2);
    expect(flat(footerOf(render(<Sheet confirm="Reassign" />).root)).flexDirection).toBe("column-reverse");
  });
});

describe("ConfirmDialog", () => {
  const actionsOf = (root: ReactTestInstance) => byType(root, "Button")[0].parent!;
  const dialog = (confirmLabel: string) => (
    <ConfirmDialog visible title="Cancel booking?" confirmLabel={confirmLabel} onConfirm={() => undefined} onCancel={() => undefined} />
  );

  it("Cancel / Delete side by side even on a 320dp phone", () => {
    setWindow(320, 640);
    expect(flat(actionsOf(render(dialog("Delete")).root)).flexDirection).toBe("row");
  });

  it("a long confirm label with large text stacks the buttons", () => {
    setWindow(390, 844, 1.6);
    expect(flat(actionsOf(render(dialog("Cancel booking")).root)).flexDirection).toBe("column-reverse");
  });

  it("its text scrolls inside a card that never outgrows the screen", () => {
    const { root } = render(dialog("Delete"));
    const scroll = byType(root, "ScrollView")[0];
    expect(flat(scroll)).toMatchObject({ flexShrink: 1 });
    expect(flat(scroll.parent!).maxHeight).toBe("100%");
  });
});

describe("InfoRow", () => {
  const rowOf = (root: ReactTestInstance) => root.findAll((n) => n.type === ("View" as unknown) && n.props.accessible)[0];

  it("label and value side by side at the default text size", () => {
    setWindow(360, 780);
    expect(flat(rowOf(render(<InfoRow label="Amount" value="PKR 120,000" />).root)).flexDirection).toBe("row");
  });

  it("value under the label with large text on a phone", () => {
    setWindow(360, 780, 1.3);
    expect(flat(rowOf(render(<InfoRow label="Amount" value="PKR 120,000" />).root)).flexDirection).toBeUndefined();
  });
});

describe("ListRow meta", () => {
  const texts = (root: ReactTestInstance) => byType(root, "Text").map((t) => t.props.children);
  const row = <ListRow title="Ayesha Khan" subtitle="Sales executive · I-8" meta="12 quotes · 3 won" />;

  it("on the right at the default text size", () => {
    setWindow(360, 780);
    const { root } = render(row);
    const meta = byType(root, "Text").find((t) => t.props.children === "12 quotes · 3 won")!;
    // A child of the row itself, after the title / subtitle column.
    expect(flat(meta.parent!).flexDirection).toBe("row");
  });

  it("under the subtitle with large text on a phone", () => {
    setWindow(360, 780, 1.6);
    const { root } = render(row);
    expect(texts(root)).toEqual(["Ayesha Khan", "Sales executive · I-8", "12 quotes · 3 won"]);
    const meta = byType(root, "Text").find((t) => t.props.children === "12 quotes · 3 won")!;
    // Inside the title / subtitle column.
    expect(flat(meta.parent!).flexDirection).toBeUndefined();
    expect(meta.props.numberOfLines).toBe(2);
  });

  it("a status pill on the right goes under the title with large text too", () => {
    const pill = React.createElement("Pill");
    setWindow(360, 780);
    let root = render(<ListRow title="Ayesha Khan" right={pill} />).root;
    expect(flat(byType(root, "Pill")[0].parent!).flexDirection).toBe("row");
    setWindow(360, 780, 1.6);
    root = render(<ListRow title="Ayesha Khan" right={pill} />).root;
    expect(flat(byType(root, "Pill")[0].parent!)).toMatchObject({ alignSelf: "flex-start" });
  });
});
