/**
 * The Sales Manager dashboard's Complaints section: its loading / error (503 SM_03) / empty / figures states, the
 * scope note, and that cards, the status bar, categories, months and "all open" open the right complaints lists.
 * React Native primitives, the UI kit, charts and the CEO building blocks are mocked so this runs in plain Node
 * (the services are the real, pure ones), in light and dark colours.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({
  Platform: { OS: "android", select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../services/apiClient", () => {
  class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    errorMessage: (error: unknown, fallback = "Something went wrong.") => (error instanceof ApiError ? error.message : fallback),
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});
jest.mock("../../../components/charts", () => ({ BarChart: "BarChart", useChartColors: () => ({ track: "#eeeeee" }) }));
jest.mock("../../../components/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  Divider: "Divider",
  KpiSkeleton: "KpiSkeleton",
  ListRow: "ListRow",
  SectionHeader: "SectionHeader",
  StatusPill: "StatusPill",
}));
let mockDark = false;
jest.mock("../../../theme", () => {
  const { spacing } = jest.requireActual("../../../theme/tokens");
  const { lightColors, darkColors } = jest.requireActual("../../../theme/colors");
  const { complaintStatusColor } = jest.requireActual("../../../theme/complaintStatus");
  return {
    spacing,
    useTheme: () => ({ colors: mockDark ? darkColors : lightColors, isDark: mockDark }),
    useComplaintStatusColors: () => (status: any) => complaintStatusColor(status, mockDark),
  };
});
jest.mock("../Ceo/parts", () => {
  const R = jest.requireActual("react");
  return {
    CeoErrorState: "CeoErrorState",
    ChartCard: ({ children, ...props }: any) => R.createElement("ChartCard", props, children),
    ChartGrid: ({ children }: any) => R.createElement("ChartGrid", null, children),
    ChartSkeleton: "ChartSkeleton",
    InlineEmpty: "InlineEmpty",
    SectionEmpty: "SectionEmpty",
    StaleBanner: "StaleBanner",
  };
});
jest.mock("../Staff/Dashboard/parts", () => ({ KpiGrid: "KpiGrid" }));

import { ApiError } from "../../../services/apiClient";
import {
  darkComplaintStatusColors,
  lightComplaintStatusColors,
} from "../../../theme/complaintStatus";
import { normalizeSalesManagerComplaints, salesManagerComplaintsErrorView, toSalesManagerComplaintsError, type SmComplaints } from "../../../services/salesManager";
import type { CeoQuery } from "../Ceo/parts";
import { ComplaintsBlock, isEmptyComplaints } from "./ComplaintsSection";
import type { SmDrill } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const DATA = normalizeSalesManagerComplaints({
  period: "month",
  periodLabel: "October 2026",
  status: { open: 4, inProgress: 3, resolved: 2, closed: 10 },
  activeTotal: 7,
  newInPeriod: 9,
  newInPeriodPrev: 6,
  resolvedInPeriod: 5,
  reopenedInPeriod: 1,
  avgResolutionDays: 1.5,
  byCategory: [{ category: "Internet / WiFi", open: 2, inProgress: 1, total: 4 }],
  months: [
    { month: "2026-09", created: 3, resolved: 2 },
    { month: "2026-10", created: 9, resolved: 5 },
  ],
  oldestActive: [{ complaintId: 12, complaintNo: "CMP-0012", customerName: "Ali", category: "Cleaning", branch: "I-8", status: "open", ageDays: 8 }],
});

function query(over: Partial<CeoQuery<SmComplaints>>): CeoQuery<SmComplaints> {
  return { data: null, error: null, loading: false, refreshing: false, loadedAt: null, reload: jest.fn(), refresh: jest.fn(), quietRefresh: jest.fn(), ...over };
}

function makeDrill(): SmDrill & { records: jest.Mock } {
  return { scope: { period: "month", locationId: 2 }, breakdown: jest.fn(), records: jest.fn(), focus: jest.fn(), target: jest.fn() } as any;
}

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

describe("ComplaintsBlock", () => {
  test("heading, period and the WhatsApp scope note; skeletons while loading", () => {
    const root = render(<ComplaintsBlock query={query({ loading: true })} drill={makeDrill()} periodLabel="October 2026" oneLocation={false} />);
    expect(byType(root, "SectionHeader")[0].props).toMatchObject({
      title: "Complaints",
      subtitle: "Customer complaints at your locations · October 2026",
    });
    expect(textOf(root)).toContain("Complaints without a branch (WhatsApp) show under All my locations");
    expect(byType(root, "KpiSkeleton")).toHaveLength(1);
    expect(byType(root, "KpiGrid")).toHaveLength(0);
  });

  test("a failed load shows its own error with retry, worded for the SM_03 update on a 503", () => {
    const error = toSalesManagerComplaintsError(new ApiError("Unavailable", 503));
    const q = query({ error });
    const root = render(<ComplaintsBlock query={q} drill={makeDrill()} oneLocation={false} />);
    const state = byType(root, "CeoErrorState")[0];
    expect(state.props.onRetry).toBe(q.reload);
    expect(state.props.describe).toBe(salesManagerComplaintsErrorView);
    expect(state.props.describe(state.props.error).message).toMatch(/^The complaints section needs the database update SM_03/);
  });

  test("no complaints at all: the empty state", () => {
    const empty = normalizeSalesManagerComplaints({});
    expect(isEmptyComplaints(empty)).toBe(true);
    expect(isEmptyComplaints(DATA)).toBe(false);
    const root = render(<ComplaintsBlock query={query({ data: empty })} drill={makeDrill()} oneLocation />);
    expect(byType(root, "SectionEmpty")[0].props.message).toBe("No complaints for this location yet.");
  });

  test("figures kept after a failed refresh get the warning", () => {
    const root = render(<ComplaintsBlock query={query({ data: DATA, error: new ApiError("x", 500) })} drill={makeDrill()} oneLocation={false} />);
    expect(byType(root, "StaleBanner")[0].props.what).toBe("The complaints below are");
    expect(byType(root, "KpiGrid")).toHaveLength(1);
  });
});

describe("ComplaintsContent", () => {
  test("cards: new (reopened, change vs last period), open, in progress, resolved (average days); each opens its list", () => {
    const drill = makeDrill();
    const root = render(<ComplaintsBlock query={query({ data: DATA })} drill={drill} oneLocation={false} />);
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    expect(tiles.map((t: any) => [t.label, t.value, t.sub])).toEqual([
      ["New this month", "9", "1 reopened"],
      ["Open", "4", "waiting for action"],
      ["In progress", "3", "being worked on"],
      ["Resolved this month", "5", "avg 1.5 days to resolve"],
    ]);
    // 3 more than last period: up, which is not good for complaints.
    expect(tiles[0].trend).toMatchObject({ direction: "up", upIsGood: false });
    tiles.forEach((t: any) => act(() => t.onPress()));
    expect(drill.records.mock.calls.map((c) => [c[0].params.status, c[1], c[2]])).toEqual([
      ["new_period", ["Complaints", "New this month"], "New complaints this month"],
      ["open", ["Complaints", "Open"], "Open complaints"],
      ["in_progress", ["Complaints", "In progress"], "Complaints in progress"],
      ["resolved_period", ["Complaints", "Resolved this month"], "Resolved this month"],
    ]);
    expect(drill.records.mock.calls[0][0]).toEqual({ kind: "complaints", params: { status: "new_period", locationId: 2, period: "month" } });
    expect(JSON.stringify(textOf(root))).not.toMatch(/PKR/);
  });

  test("status bar in the contract's colours (light and dark); segments and rows open that status", () => {
    for (const dark of [false, true]) {
      mockDark = dark;
      const colors = dark ? darkComplaintStatusColors : lightComplaintStatusColors;
      const drill = makeDrill();
      const root = render(<ComplaintsBlock query={query({ data: DATA })} drill={drill} oneLocation={false} />);
      const card = root.findAll((n) => n.type === ("ChartCard" as unknown) && n.props.title === "Status now")[0];
      const pressables = byType(card, "Pressable");
      // 4 segments (every status has complaints) + 4 legend rows.
      expect(pressables).toHaveLength(8);
      const segments = pressables.slice(0, 4);
      expect(segments.map((p) => p.props.style[1].backgroundColor)).toEqual([colors.open, colors.in_progress, colors.resolved, colors.closed]);
      expect(segments.map((p) => p.props.style[1].flexGrow)).toEqual([4, 3, 2, 10]);
      const rows = pressables.slice(4);
      expect(rows.map((p) => p.props.accessibilityLabel)).toEqual([
        "Open, 4 · 21.1%",
        "In progress, 3 · 15.8%",
        "Resolved, awaiting customer, 2 · 10.5%",
        "Closed, 10 · 52.6%",
      ]);
      act(() => segments[0].props.onPress());
      act(() => rows[3].props.onPress());
      expect(drill.records.mock.calls.map((c) => c[0].params.status)).toEqual(["open", "closed"]);
    }
  });

  test("a category opens its complaints; a month opens those created then; the oldest list has status and age chips", () => {
    const drill = makeDrill();
    const root = render(<ComplaintsBlock query={query({ data: DATA })} drill={drill} oneLocation={false} />);
    const category = root.findAll((n) => n.type === ("ChartCard" as unknown) && n.props.title === "By category")[0];
    const [row] = byType(category, "Pressable");
    expect(row.props.accessibilityLabel).toBe("Internet / WiFi, 3 open or in progress, 2 open · 1 in progress, 4 new this month");
    act(() => row.props.onPress());
    expect(drill.records).toHaveBeenLastCalledWith(
      { kind: "complaints", params: { category: "Internet / WiFi", locationId: 2, period: "month" } },
      ["Complaints", "Internet / WiFi"],
      "Complaints: Internet / WiFi",
    );

    const chart = byType(root, "BarChart")[0];
    expect(chart.props.data.map((d: any) => d.values)).toEqual([
      [3, 2],
      [9, 5],
    ]);
    act(() => chart.props.onPressItem(1));
    expect(drill.records).toHaveBeenLastCalledWith(
      { kind: "complaints", params: { month: "2026-10", locationId: 2 } },
      ["Complaints", "Oct 2026"],
      "Complaints, Oct 2026",
    );

    const rows = byType(root, "ListRow");
    expect(rows[0].props).toMatchObject({ title: "CMP-0012", subtitle: "Ali · Cleaning · I-8", leftIconTone: "danger" });
    // ListRow is mocked: its `right` element (the two chips) is read from the prop.
    const chips = React.Children.toArray(rows[0].props.right.props.children).map((p: any) => [p.props.label, p.props.tone]);
    expect(chips).toEqual([
      ["Open", "warning"],
      ["8 days", "danger"],
    ]);
    expect(rows[1].props.title).toBe("All open and in progress (7)");
    act(() => rows[1].props.onPress());
    expect(drill.records.mock.calls.at(-1)?.[0].params).toEqual({ status: "active", locationId: 2, period: "month" });
  });

  test("by branch: hidden for one branch; shown with complaints without a branch, each row opening its branch", () => {
    expect(render(<ComplaintsBlock query={query({ data: DATA })} drill={makeDrill()} oneLocation={false} />).findAll(
      (n) => n.type === ("ChartCard" as unknown) && n.props.title === "By branch",
    )).toHaveLength(0);
    const data = {
      ...DATA,
      byBranch: [
        { branch: "I-8", label: "I-8", open: 2, inProgress: 1, total: 5 },
        { branch: "", label: "No branch", open: 1, inProgress: 0, total: 2 },
      ],
    };
    const drill = makeDrill();
    const root = render(<ComplaintsBlock query={query({ data })} drill={drill} oneLocation={false} />);
    const card = root.findAll((n) => n.type === ("ChartCard" as unknown) && n.props.title === "By branch")[0];
    const rows = byType(card, "ListRow");
    expect(rows.map((r) => [r.props.title, r.props.meta, r.props.subtitle])).toEqual([
      ["I-8", "3 active", "2 open · 1 in progress · 5 new this month"],
      ["No branch", "1 active", "1 open · 0 in progress · 2 new this month"],
    ]);
    act(() => rows[1].props.onPress());
    expect(drill.records).toHaveBeenLastCalledWith(
      { kind: "complaints", params: { branch: "none", locationId: 2, period: "month" } },
      ["Complaints", "No branch"],
      "Complaints: No branch",
    );
    act(() => rows[0].props.onPress());
    expect(drill.records.mock.calls.at(-1)?.[0].params).toEqual({ branch: "I-8", locationId: 2, period: "month" });
  });

  test("the scope note the dashboard gives (one location: no reference to a hidden option)", () => {
    const root = render(
      <ComplaintsBlock query={query({ loading: true })} drill={makeDrill()} oneLocation scopeNote="Includes complaints without a branch (WhatsApp)" />,
    );
    expect(textOf(root)).toContain("Includes complaints without a branch (WhatsApp)");
    expect(JSON.stringify(textOf(root))).not.toMatch(/All my locations/);
  });

  test("no open complaints: says so", () => {
    const data = { ...DATA, oldestActive: [] };
    const root = render(<ComplaintsBlock query={query({ data })} drill={makeDrill()} oneLocation={false} />);
    expect(byType(root, "InlineEmpty").map((n) => n.props.text)).toContain("No open complaints");
  });
});
