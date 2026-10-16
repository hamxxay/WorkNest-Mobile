/**
 * Staff layout helpers: button rows and field pairs that stack when they don't fit, and the window rules for
 * moving pills / amounts under their text and scrolling list filters away. useWindowDimensions is mocked (320dp
 * phone, 390 / 430 phones, Galaxy Z Fold6 inner screen, a phone in landscape; font scale 1 to 2).
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

type Dims = { width: number; height: number; fontScale: number; scale: number };
let mockDims: Dims = { width: 390, height: 844, fontScale: 1, scale: 3 };

jest.mock("react-native", () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) return style.reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...flatten(s) }), {});
    return typeof style === "object" ? (style as Record<string, unknown>) : {};
  };
  return {
    StyleSheet: { create: <T,>(s: T) => s, flatten },
    useWindowDimensions: () => mockDims,
    View: "View",
  };
});
jest.mock("../../../../theme", () => ({ spacing: jest.requireActual("../../../../theme/tokens").spacing }));

import { StyleSheet } from "react-native";
import { ActionRow, DATE_FIELD_MIN_WIDTH, FieldRow, TIME_FIELD_MIN_WIDTH, useShortWindow, useStackedMeta } from "./layout";

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
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) as Record<string, unknown>;
const view = (root: ReactTestInstance, testID: string) =>
  root.findAll((n) => n.type === ("View" as unknown) && n.props.testID === testID)[0];
const button = (title: string, props: Record<string, unknown> = {}) => React.createElement("Button", { title, ...props });

beforeEach(() => setWindow(390, 844));

// ─── ActionRow ─────────────────────────────────────────────────────────────────────────────────────────────

function ChallanActions() {
  return (
    <ActionRow testID="actions">
      {button("Challan PDF", { leftIcon: "document-outline" })}
      {button("Email challan", { leftIcon: "mail-outline" })}
    </ActionRow>
  );
}

const isStacked = (root: ReactTestInstance) => flat(view(root, "actions")).flexDirection === "column";

describe("ActionRow", () => {
  it("side by side, equal widths, where both labels fit (430dp phone)", () => {
    setWindow(430, 932);
    const { root } = render(<ChallanActions />);
    expect(isStacked(root)).toBe(false);
    const cells = view(root, "actions").children as ReactTestInstance[];
    expect(cells.map((c) => flat(c).flex)).toEqual([1, 1]);
  });

  it("one above the other on a 320dp phone and with the largest text", () => {
    setWindow(320, 640);
    expect(isStacked(render(<ChallanActions />).root)).toBe(true);
    setWindow(430, 932, 2);
    expect(isStacked(render(<ChallanActions />).root)).toBe(true);
  });

  it("follows its measured width: side by side again once laid out on the unfolded Fold", () => {
    setWindow(320, 640);
    const { root } = render(<ChallanActions />);
    act(() => {
      view(root, "actions").props.onLayout({ nativeEvent: { layout: { width: 643, height: 0, x: 0, y: 0 } } });
    });
    expect(isStacked(root)).toBe(false);
  });

  it("a button that can show a spinner is measured with it, so the row does not flip while loading", () => {
    // "Statement PDF" / "Email customer" at 390dp: too wide side by side whether or not a spinner is showing.
    const row = (loading: boolean) => (
      <ActionRow testID="actions">
        {button("Statement PDF", { loading: false })}
        {button("Email customer", { loading })}
      </ActionRow>
    );
    expect(isStacked(render(row(false)).root)).toBe(isStacked(render(row(true)).root));
  });

  it("a single button keeps the full row", () => {
    setWindow(320, 640, 2);
    const { root } = render(<ActionRow testID="actions">{button("Agreement PDF", { leftIcon: "document-outline" })}{null}</ActionRow>);
    expect(isStacked(root)).toBe(false);
    expect(view(root, "actions").children).toHaveLength(1);
  });
});

// ─── FieldRow ──────────────────────────────────────────────────────────────────────────────────────────────

function Pair({ minItemWidth }: { minItemWidth: number }) {
  return (
    <FieldRow testID="pair" minItemWidth={minItemWidth}>
      {React.createElement("DateField", { label: "From" })}
      {React.createElement("DateField", { label: "To" })}
    </FieldRow>
  );
}

const sideBySide = (root: ReactTestInstance) => flat(view(root, "pair")).flexDirection === "row";

describe("FieldRow", () => {
  it("times: side by side on a phone, stacked on 320dp and with large text", () => {
    expect(sideBySide(render(<Pair minItemWidth={TIME_FIELD_MIN_WIDTH} />).root)).toBe(true);
    setWindow(320, 640);
    expect(sideBySide(render(<Pair minItemWidth={TIME_FIELD_MIN_WIDTH} />).root)).toBe(false);
    setWindow(390, 844, 2);
    expect(sideBySide(render(<Pair minItemWidth={TIME_FIELD_MIN_WIDTH} />).root)).toBe(false);
  });

  it("dates: stacked on phones (a weekday date needs ~180dp), side by side on the unfolded Fold", () => {
    expect(sideBySide(render(<Pair minItemWidth={DATE_FIELD_MIN_WIDTH} />).root)).toBe(false);
    setWindow(707, 690);
    expect(sideBySide(render(<Pair minItemWidth={DATE_FIELD_MIN_WIDTH} />).root)).toBe(true);
  });

  it("stacked fields have no flex (they would collapse in a ScrollView) and the form's 16dp gap", () => {
    setWindow(320, 640);
    const pair = view(render(<Pair minItemWidth={TIME_FIELD_MIN_WIDTH} />).root, "pair");
    expect(flat(pair).gap).toBe(16);
    expect((pair.children as ReactTestInstance[]).map((c) => flat(c).flex)).toEqual([undefined, undefined]);
  });
});

// ─── Window rules ──────────────────────────────────────────────────────────────────────────────────────────

function Probe() {
  const stacked = useStackedMeta();
  const short = useShortWindow();
  return React.createElement("Probe", { stacked, short });
}
const probe = () => render(<Probe />).root.findByType("Probe" as never).props as { stacked: boolean; short: boolean };

describe("useStackedMeta / useShortWindow", () => {
  it("pills and amounts stay beside their text at the default size, also on a 320dp phone", () => {
    setWindow(320, 640);
    expect(probe().stacked).toBe(false);
  });

  it("they go under it with large text on a phone, not on the unfolded Fold", () => {
    setWindow(390, 844, 1.3);
    expect(probe().stacked).toBe(true);
    setWindow(707, 690, 2);
    expect(probe().stacked).toBe(false);
  });

  it("list filters scroll away on a phone in landscape and with the largest text, not in portrait", () => {
    expect(probe().short).toBe(false);
    setWindow(844, 390);
    expect(probe().short).toBe(true);
    setWindow(390, 844, 2);
    expect(probe().short).toBe(true);
    setWindow(1280, 800);
    expect(probe().short).toBe(false);
  });
});
