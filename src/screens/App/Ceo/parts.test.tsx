/**
 * CeoSection (shared by the CEO and Sales Manager dashboards): the optional scope note under the heading (the Sales
 * Manager's Tour inquiries say where inquiries without a branch count), shown while loading too, in light and dark
 * colours; no note, nothing extra. React Native primitives and the UI kit are mocked so this runs in plain Node.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  View: "View",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../../components/ui", () => ({
  AppText: "AppText",
  Banner: "Banner",
  Card: "Card",
  EmptyState: "EmptyState",
  ErrorState: "ErrorState",
  KpiSkeleton: "KpiSkeleton",
  SectionHeader: "SectionHeader",
  SkeletonBlock: "SkeletonBlock",
  SkeletonGroup: "SkeletonGroup",
}));
jest.mock("../../../services/ceo", () => ({ ceoErrorView: jest.fn(), trailForSpeech: jest.fn() }));
let mockDark = false;
jest.mock("../../../theme", () => {
  const { spacing } = jest.requireActual("../../../theme/tokens");
  const { lightColors, darkColors } = jest.requireActual("../../../theme/colors");
  return { spacing, useThemeColors: () => (mockDark ? darkColors : lightColors) };
});

import { darkColors, lightColors } from "../../../theme/colors";
import { CeoSection, ScopeLine, useCeoQuery } from "./parts";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const NOTE = "Inquiries without a branch show under All my locations";

function render(element: React.ReactElement): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}

const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const textOf = (root: ReactTestInstance) => byType(root, "AppText").map((n) => String(n.props.children));

afterEach(() => {
  mockDark = false;
});

describe("CeoSection", () => {
  test.each([
    ["light", false],
    ["dark", true],
  ])("a scope note under the heading, while loading too (%s)", (_name, dark) => {
    mockDark = dark;
    const root = render(
      <CeoSection title="Tour inquiries" subtitle="Tour inquiries at your locations · October 2026" note={NOTE} loading empty={false} emptyMessage="None." />,
    );
    expect(byType(root, "SectionHeader")[0].props).toMatchObject({
      title: "Tour inquiries",
      subtitle: "Tour inquiries at your locations · October 2026",
    });
    expect(textOf(root)).toEqual([NOTE]);
    expect(root.findAll((n) => n.type === ("View" as unknown) && n.props.accessibilityLabel === `Note: ${NOTE}.`)).toHaveLength(1);
    expect(byType(root, "Ionicons")[0].props).toMatchObject({
      name: "information-circle-outline",
      color: (dark ? darkColors : lightColors).textMuted,
    });
    expect(byType(root, "KpiSkeleton")).toHaveLength(1);
  });

  test("without a note: heading and content only", () => {
    const root = render(
      <CeoSection title="Renewals & desks" loading={false} empty={false} emptyMessage="None.">
        <React.Fragment />
      </CeoSection>,
    );
    expect(textOf(root)).toEqual([]);
    expect(byType(root, "Ionicons")).toHaveLength(0);
  });
});

describe("ScopeLine", () => {
  test("first load: a placeholder of the same height, so the sections do not move when the figures arrive", () => {
    const root = render(<ScopeLine loading />);
    expect(byType(root, "SkeletonGroup")).toHaveLength(1);
    expect(byType(root, "SkeletonBlock")).toHaveLength(2);
    expect(textOf(root)).toEqual([]);
  });

  test.each([
    ["light", false],
    ["dark", true],
  ])("the period, then when the figures arrived with a green dot; amber when the last refresh failed (%s)", (_name, dark) => {
    mockDark = dark;
    const colors = dark ? darkColors : lightColors;
    const dot = (root: ReactTestInstance) =>
      byType(root, "View").find((n) => n.props.style?.some?.((s: any) => s && s.backgroundColor))!.props.style.find((s: any) => s && s.backgroundColor)
        .backgroundColor;

    const fresh = render(<ScopeLine text="October 2026" updated="Updated just now" />);
    expect(textOf(fresh)).toEqual(["October 2026", "Updated just now"]);
    expect(byType(fresh, "View").filter((n) => n.props.accessible)[0].props.accessibilityLabel).toBe("October 2026. Updated just now");
    expect(byType(fresh, "Ionicons")[0].props).toMatchObject({ name: "calendar-outline", color: colors.textMuted });
    expect(dot(fresh)).toBe(colors.success);

    const stale = render(<ScopeLine text="October 2026" updated="Updated 12 min ago" stale />);
    expect(dot(stale)).toBe(colors.warning);
  });

  test("nothing to say (the dashboard failed before its first answer): nothing drawn", () => {
    const root = render(<ScopeLine text={undefined} updated="" />);
    expect(root.children).toHaveLength(0);
  });
});

describe("useCeoQuery", () => {
  type Probe = ReturnType<typeof useCeoQuery<string>>;
  let latest: Probe | undefined;
  function QueryProbe({ load }: { load: () => Promise<string> }) {
    latest = useCeoQuery(load);
    return null;
  }

  /** A load whose answers the test hands out one by one. */
  function loader() {
    const pending: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = [];
    const load = jest.fn(() => new Promise<string>((resolve, reject) => pending.push({ resolve, reject })));
    return { load, answer: async (v: string) => act(async () => pending.shift()!.resolve(v)), fail: async (e: unknown) => act(async () => pending.shift()!.reject(e)) };
  }

  test("the quiet refresh keeps the figures on screen (no skeleton, no spinner) until the new ones arrive", async () => {
    const { load, answer, fail } = loader();
    render(<QueryProbe load={load} />);
    expect(latest).toMatchObject({ data: null, loading: true, refreshing: false, loadedAt: null });
    await answer("first");
    expect(latest).toMatchObject({ data: "first", loading: false, refreshing: false });
    const firstAt = latest!.loadedAt;
    expect(typeof firstAt).toBe("number");

    act(() => latest!.quietRefresh());
    expect(load).toHaveBeenCalledTimes(2);
    expect(latest).toMatchObject({ data: "first", loading: false, refreshing: false, error: null, loadedAt: firstAt });
    await answer("second");
    expect(latest).toMatchObject({ data: "second", loading: false, refreshing: false, error: null });

    // A quiet refresh that fails keeps the figures and reports the error (the screen says they are from the last update).
    act(() => latest!.quietRefresh());
    await fail(new Error("offline"));
    expect(latest).toMatchObject({ data: "second", loading: false, refreshing: false });
    expect((latest!.error as Error).message).toBe("offline");
  });

  test("pull to refresh still shows its spinner", async () => {
    const { load, answer } = loader();
    render(<QueryProbe load={load} />);
    await answer("first");
    act(() => latest!.refresh());
    expect(latest).toMatchObject({ data: "first", refreshing: true });
    await answer("again");
    expect(latest).toMatchObject({ data: "again", refreshing: false });
  });
});
