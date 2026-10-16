/**
 * MatchCard layout on different screens: "Enrol face" + "Enrol fingerprint" share a row only when both labels fit
 * (tablet / unfolded foldable), otherwise one above the other (phones, where "Enrol fingerprint" would be cut);
 * the status chip goes under the room name when beside it the name would get a few letters. useWindowDimensions is
 * mocked; React Native primitives and the UI kit are mocked so this runs in plain Node.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

type Dims = { width: number; height: number; fontScale: number; scale: number };
let mockDims: Dims = { width: 390, height: 844, fontScale: 1, scale: 3 };

jest.mock("react-native", () => ({
  Platform: { OS: "android", select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default },
  StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1 },
  useWindowDimensions: () => mockDims,
  View: "View",
  Text: "Text",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../../components/ui", () => ({
  AppText: "AppText",
  Avatar: "Avatar",
  Banner: "Banner",
  Button: "Button",
  Card: "Card",
  Divider: "Divider",
  InfoRow: "InfoRow",
  // The Screen's content column: the window, at most 720dp.
  useScreenColumnWidth: () => Math.min(mockDims.width, 720),
}));
jest.mock("../../../services/accessOfficer", () => ({
  ...jest.requireActual("../../../services/accessOfficer/format"),
  ...jest.requireActual("../../../services/accessOfficer/rules"),
}));
jest.mock("../../../theme", () => {
  const tokens = jest.requireActual("../../../theme/tokens");
  const { lightColors, lightTones } = jest.requireActual("../../../theme/colors");
  const typo = jest.requireActual("../../../theme/typography");
  const theme = { colors: lightColors, tones: lightTones, spacing: tokens.spacing, radii: tokens.radii, typography: typo.typography };
  return {
    spacing: tokens.spacing,
    useTheme: () => theme,
    useThemedStyles: <T,>(create: (c: unknown, t: unknown) => T) => create(lightColors, theme),
  };
});

import { match } from "../../../services/accessOfficer/__fixtures__";
import { MatchCard, statusChipBelow } from "./MatchCard";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

function render(width: number, fontScale = 1): ReactTestInstance {
  mockDims = { width, height: 844, fontScale, scale: 3 };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<MatchCard match={match()} busy={null} locked={false} onAction={() => undefined} />);
  });
  return renderer!.root;
}

const button = (root: ReactTestInstance, title: string) => root.find((n) => n.type === ("Button" as unknown) && n.props.title === title);
/** Side by side, each enrol button takes half the row (style flex 1); stacked, they have no flex style. */
const sideBySide = (root: ReactTestInstance) =>
  [button(root, "Enrol face"), button(root, "Enrol fingerprint")].every((b) => b.props.style?.flex === 1);

describe("MatchCard enrol buttons", () => {
  test.each([
    ["320dp phone", 320, 1, false],
    ["390dp phone", 390, 1, false],
    ["Fold cover screen", 369, 1, false],
    ["Fold inner screen", 707, 1, true],
    ["tablet", 1024, 1, true],
    ["tablet, largest text", 1024, 2, true],
    ["Fold inner screen, largest text", 707, 2, true],
  ])("%s: side by side = %s", (_name, width, fontScale, expected) => {
    expect(sideBySide(render(width, fontScale))).toBe(expected);
  });

  test("Remove access always gets the full row", () => {
    expect(button(render(1024), "Remove access").props.style).toBeUndefined();
  });
});

describe("statusChipBelow", () => {
  // Inner card width = window - 2 x 16 screen padding - 2 x 17 card padding and border.
  test("beside the room name when the name keeps enough room", () => {
    expect(statusChipBelow(390 - 66, 1, "Has access")).toBe(false);
    expect(statusChipBelow(654, 2, "Waiting for CNIC check")).toBe(false);
  });

  test("under the room name on a 320dp phone, with a long status or with large text", () => {
    expect(statusChipBelow(320 - 66, 1, "Has access")).toBe(true);
    expect(statusChipBelow(390 - 66, 1, "Waiting for CNIC check")).toBe(true);
    expect(statusChipBelow(390 - 66, 2, "Has access")).toBe(true);
  });
});
