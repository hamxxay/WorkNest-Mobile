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
import { CeoSection } from "./parts";

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
