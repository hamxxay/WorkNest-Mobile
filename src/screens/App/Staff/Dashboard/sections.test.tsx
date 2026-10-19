/**
 * Staff dashboard overview charts drill down: a month of "Invoiced and paid" opens revenue-month for that month,
 * the occupancy ring opens the spaces in use now (occupied-month of the server's month) and a space type bar opens
 * space-type, each a button for screen readers. Without onDrill the charts stay read-only. React Native, the UI kit,
 * charts and the dashboard building blocks are mocked so this runs in plain Node; the services are the real ones.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 }, View: "View" }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("../../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../../services/apiClient", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, apiRequest: jest.fn(), errorMessage: () => "x", serverMessage: () => null, onSessionExpired: jest.fn() };
});
jest.mock("../../../../components/charts", () => ({ BarChart: "BarChart", Donut: "Donut", HBarList: "HBarList", percentOf: (a: number, b: number) => (b ? (a * 100) / b : 0) }));
jest.mock("../../../../components/motion", () => {
  const R = jest.requireActual("react");
  return { ScalePressable: ({ children, ...props }: any) => R.createElement("ScalePressable", props, children) };
});
jest.mock("../../../../components/ui", () => {
  const R = jest.requireActual("react");
  const box = (name: string) => ({ children, ...props }: any) => R.createElement(name, props, children);
  return {
    AppText: box("AppText"),
    Card: box("Card"),
    Divider: "Divider",
    FilterChips: "FilterChips",
    InfoRow: "InfoRow",
    ListRow: "ListRow",
    SegmentedControl: "SegmentedControl",
    StatusPill: "StatusPill",
  };
});
jest.mock("../../../../theme", () => ({ spacing: jest.requireActual("../../../../theme/tokens").spacing }));
jest.mock("../../Ceo/parts", () => {
  const R = jest.requireActual("react");
  return { ChartGrid: ({ children }: any) => R.createElement("ChartGrid", null, children) };
});
jest.mock("./parts", () => ({ AttentionList: "AttentionList", Fact: "Fact", FigureTable: "FigureTable", KpiGrid: "KpiGrid", money: (v: number) => `PKR ${v}` }));

import { normalizeDashboardOverview } from "../../../../services/staff";
import { OverviewSection } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const D = normalizeDashboardOverview({
  totalSpaces: 25,
  occupiedSpaces: 18,
  occupancyPct: 72,
  occupancyPctLastMonth: 68,
  generatedAt: "2026-10-19T10:00:00",
  months: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((month, i) => ({
    month,
    invoiced: 1000 * (i + 1),
    paid: 500 * (i + 1),
    occupancyPct: 60 + i,
    newBookings: i,
  })),
  spaceTypes: [
    { spaceType: "Private Office", total: 10, occupied: 8 },
    { spaceType: "Meeting Room", total: 0, occupied: 0 },
    { spaceType: "Dedicated Desk", total: 15, occupied: 10 },
  ],
});

function render(onDrill?: jest.Mock): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<OverviewSection data={D} periodWord="this month" onDrill={onDrill} />);
  });
  return renderer!.root;
}

const one = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown))[0];

test("a month of Invoiced and paid opens that month's invoices (revenue-month)", () => {
  const onDrill = jest.fn();
  const chart = one(render(onDrill), "BarChart");
  expect(chart.props.data.map((d: any) => d.title)).toEqual(["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"]);
  expect(chart.props.itemAccessibilityHint).toBe("Opens the invoices issued that month");
  act(() => chart.props.onPressItem(5));
  act(() => chart.props.onPressItem(0));
  expect(onDrill.mock.calls.map((c) => c[0])).toEqual([
    { request: { kind: "revenue-month", month: "2026-10" }, trail: ["Invoiced and paid", "Oct 2026"], title: "Invoices issued in Oct 2026" },
    { request: { kind: "revenue-month", month: "2026-05" }, trail: ["Invoiced and paid", "May 2026"], title: "Invoices issued in May 2026" },
  ]);
});

test("a space type bar opens its spaces (space-type), counting only the types shown", () => {
  const onDrill = jest.fn();
  const bars = one(render(onDrill), "HBarList");
  expect(bars.props.items.map((i: any) => i.label)).toEqual(["Private Office", "Dedicated Desk"]);
  expect(bars.props.itemAccessibilityHint).toBe("Opens the spaces of this type");
  act(() => bars.props.onPressItem(bars.props.items[1], 1));
  expect(onDrill).toHaveBeenCalledWith({
    request: { kind: "space-type", spaceType: "Dedicated Desk" },
    trail: ["Occupancy by space type", "Dedicated Desk"],
    title: "Dedicated Desk spaces",
  });
});

test("the occupancy ring is one button that opens the spaces in use now (occupied-month, server's month)", () => {
  const onDrill = jest.fn();
  const ring = one(render(onDrill), "ScalePressable");
  expect(ring.props).toMatchObject({
    accessibilityRole: "button",
    accessibilityLabel: "Occupancy 72%: 18 of 25 spaces in use. Last month 68%.",
    accessibilityHint: "Opens the spaces in use now",
  });
  expect(one(ring, "Donut").props.accessibilityLabel).toBe("Occupancy 72%: 18 of 25 spaces in use. Last month 68%.");
  act(() => ring.props.onPress());
  expect(onDrill).toHaveBeenCalledWith({
    request: { kind: "occupied-month", month: "2026-10" },
    trail: ["Occupancy", "In use now"],
    title: "Spaces in use now",
  });
});

test("without onDrill the charts stay read-only", () => {
  const root = render();
  expect(one(root, "BarChart").props.onPressItem).toBeUndefined();
  expect(one(root, "HBarList").props.onPressItem).toBeUndefined();
  expect(root.findAll((n) => n.type === ("ScalePressable" as unknown))).toHaveLength(0);
  expect(one(root, "Donut").props.accessibilityLabel).toContain("Occupancy 72%");
});
