/**
 * CEO dashboard KPI cards drill down (owner's request, 16 Oct 2026): Invoiced, Collected, Outstanding, Overdue,
 * Occupancy, New / Active bookings, Leases expiring, Tour inquiries, Conversion, Quotation value and Booking value
 * each open their breakdown, a list built from the dashboard, or records, and say so to screen readers. React Native,
 * the UI kit, charts and the CEO building blocks are mocked so this runs in plain Node; the services are the real ones.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 }, View: "View" }));
jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../services/apiClient", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, apiRequest: jest.fn(), errorMessage: () => "x", serverMessage: () => null, onSessionExpired: jest.fn() };
});
jest.mock("../../../components/charts", () => ({ BarChart: "BarChart", Donut: "Donut", HBarList: "HBarList" }));
jest.mock("../../../components/ui", () => ({ AppText: "AppText", Divider: "Divider", ListRow: "ListRow", SegmentedControl: "SegmentedControl" }));
jest.mock("../../../theme", () => ({ spacing: jest.requireActual("../../../theme/tokens").spacing, useInquiryTypeColors: () => () => "#000000" }));
jest.mock("../Staff/Dashboard/parts", () => ({ Fact: "Fact", KpiGrid: "KpiGrid" }));
jest.mock("./parts", () => {
  const R = jest.requireActual("react");
  return {
    ChartCard: ({ children, ...props }: any) => R.createElement("ChartCard", props, children),
    ChartGrid: ({ children }: any) => R.createElement("ChartGrid", null, children),
    InlineEmpty: "InlineEmpty",
  };
});

import { normalizeCeoDashboard, recordsForFunnelStage, type CeoPeriod } from "../../../services/ceo";
import { MoneySection, OccupancySection, SalesSection, TeamSection, type Drill } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const D = normalizeCeoDashboard({
  period: "month",
  money: {
    invoiced: 900,
    collected: 600,
    outstanding: 500,
    outstandingCount: 3,
    overdue: 200,
    overdueCount: 1,
    months: [{ month: "2026-10", invoiced: 900, collected: 600 }],
    aging: [{ bucket: "1_30", amount: 300, count: 2 }],
  },
  occupancy: {
    totalSpaces: 30,
    occupiedSpaces: 19,
    occupancyPct: 63.3,
    activeBookings: 17,
    newBookings: 4,
    byLocation: [
      { locationId: 1, name: "I-8", total: 20, occupied: 15 },
      { locationId: 2, name: "F-7", total: 10, occupied: 4 },
    ],
    leasesExpiring: [],
    leasesExpiringCount: 6,
  },
  sales: {
    funnel: [
      { stage: "inquiries", count: 10 },
      { stage: "quotations", count: 6 },
      { stage: "accepted", count: 3 },
      { stage: "bookings", count: 2 },
    ],
    quotationValue: 100,
    bookingValue: 50,
    inquiriesAllLocations: false,
  },
});

function makeDrill(period: CeoPeriod = "month", locationId: number | null = null) {
  const scope = { period, locationId };
  return {
    period,
    locationId,
    breakdown: jest.fn(),
    records: jest.fn(),
    open: jest.fn(),
    focus: jest.fn(),
    target: jest.fn(() => jest.fn()),
    overdueRecords: () => ({ kind: "invoices", params: { status: "overdue" } }),
    newBookingsRecords: () => ({ kind: "bookings", params: { period } }),
    funnelRecords: (stage: string) => recordsForFunnelStage(stage, scope),
    customerRecords: () => null,
    leasesRecords: () => ({ kind: "leases", params: {} }),
  } as Drill & { open: jest.Mock; records: jest.Mock; focus: jest.Mock };
}

function tilesOf(element: React.ReactElement): any[] {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const root: ReactTestInstance = renderer!.root;
  return root.findAll((n) => n.type === ("KpiGrid" as unknown))[0].props.tiles;
}

const press = (tiles: any[], label: string) => {
  const tile = tiles.find((t) => t.label === label);
  expect(tile?.onPress).toBeInstanceOf(Function);
  act(() => tile.onPress());
  return tile;
};

describe("Money cards", () => {
  test("this month: Invoiced / Collected open this month by location (Collected then the paid invoices)", () => {
    const drill = makeDrill("month", 2);
    const tiles = tilesOf(<MoneySection money={D.money!} drill={drill} />);
    expect(press(tiles, "Invoiced").accessibilityHint).toBe("Opens invoiced this month by location");
    expect(press(tiles, "Collected").accessibilityHint).toBe("Opens collected this month by location");
    const [[invoiced, trail], [collected]] = drill.open.mock.calls;
    expect(invoiced).toMatchObject({ kind: "breakdown", query: { metric: "revenue", period: "month", locationId: 2 }, recordsParams: undefined });
    expect(invoiced.query.month).toMatch(/^\d{4}-\d{2}$/);
    expect(trail).toEqual(["Money", "Invoiced this month"]);
    expect(collected).toMatchObject({ kind: "breakdown", recordsParams: { status: "paid" } });
  });

  test("a quarter or year: the period's months first; Outstanding: the aging buckets; Overdue: its invoices", () => {
    const drill = makeDrill("year");
    const tiles = tilesOf(<MoneySection money={D.money!} drill={drill} />);
    expect(press(tiles, "Invoiced").accessibilityHint).toBe("Opens invoiced this year by month");
    expect(press(tiles, "Outstanding").accessibilityHint).toBe("Opens the outstanding invoices by age");
    expect(drill.open.mock.calls[0][0]).toMatchObject({ kind: "list", list: { title: "Invoiced by month" } });
    expect(drill.open.mock.calls[1][0]).toMatchObject({ kind: "list", list: { title: "Outstanding by age" } });
    expect(drill.open.mock.calls[1][1]).toEqual(["Money", "Outstanding"]);
    press(tiles, "Overdue");
    expect(drill.records).toHaveBeenCalledWith({ kind: "invoices", params: { status: "overdue" } }, ["Money", "Overdue invoices"], "Overdue invoices");
  });
});

describe("Occupancy cards", () => {
  test("Occupancy by location, Active bookings running today, New bookings and every lease expiring", () => {
    const drill = makeDrill("quarter");
    const tiles = tilesOf(<OccupancySection occupancy={D.occupancy!} drill={drill} />);
    expect(press(tiles, "Occupancy").accessibilityHint).toBe("Opens the occupied rooms by location");
    expect(drill.open.mock.calls[0][0]).toMatchObject({ kind: "list", list: { title: "Occupied rooms by location" } });
    expect(press(tiles, "Active bookings").accessibilityHint).toBe("Opens the bookings running today");
    expect(drill.open.mock.calls[1]).toEqual([
      {
        kind: "records",
        query: { kind: "bookings", params: { status: "active", from: "2000-01-01" } },
        title: "Active bookings",
        keepTitle: true,
        timeless: true,
      },
      ["Occupancy", "Active bookings"],
    ]);
    press(tiles, "New bookings");
    expect(press(tiles, "Leases expiring").accessibilityHint).toBe("Opens every lease ending in the next 90 days");
    expect(drill.records.mock.calls.map((c) => c[2])).toEqual(["New bookings", "Leases expiring"]);
    expect(drill.focus).not.toHaveBeenCalled();
  });

  test("one location chosen: Occupancy opens its occupied rooms by space type; without the full lease count the card shows the list here", () => {
    const drill = makeDrill("month", 1);
    const tiles = tilesOf(<OccupancySection occupancy={{ ...D.occupancy!, leasesExpiringCount: null }} drill={drill} />);
    expect(press(tiles, "Occupancy").accessibilityHint).toBe("Opens the occupied rooms of this location by space type");
    expect(drill.open.mock.calls[0][0]).toEqual({
      kind: "breakdown",
      query: { metric: "occupancy-location", period: "month", locationId: 1 },
      recordsParams: { occupied: true },
    });
    press(tiles, "Leases expiring");
    expect(drill.focus).toHaveBeenCalledWith("leases");
  });
});

describe("Sales cards", () => {
  test("Tour inquiries, Conversion, Quotation value and Booking value open their records of the period", () => {
    const drill = makeDrill("month", 3);
    const tiles = tilesOf(<SalesSection sales={D.sales!} drill={drill} />);
    for (const label of ["Tour inquiries", "Conversion", "Quotation value", "Booking value"]) press(tiles, label);
    expect(drill.records.mock.calls.map((c) => [c[0].kind, c[0].params.stage ?? null, c[0].params.locationId, c[2]])).toEqual([
      ["inquiries", null, 3, "Tour inquiries"],
      ["quotations", "converted", 3, "Converted quotations"],
      ["quotations", "quotations", 3, "Quotations"],
      ["bookings", null, 3, "Bookings"],
    ]);
    expect(tiles.every((t) => t.accessibilityHint)).toBe(true);
  });
});

describe("a custom date range", () => {
  const range = { from: "2026-10-01", to: "2026-10-15" };
  const customDrill = () => ({ ...makeDrill("custom", 2), range });

  test("Money: worded for the range, compared with the previous 15 days; Invoiced opens the range by location", () => {
    const drill = customDrill();
    const money = { ...D.money!, invoicedPrev: 600, collectedPrev: 600 };
    const tiles = tilesOf(<MoneySection money={money} drill={drill} />);
    const invoiced = press(tiles, "Invoiced");
    expect(invoiced).toMatchObject({ sub: "in this range", accessibilityHint: "Opens invoiced in this range by location" });
    expect(invoiced.trend.label).toBe("50% vs previous 15 days");
    expect(drill.open.mock.calls[0]).toEqual([
      { kind: "breakdown", query: { metric: "revenue", period: "custom", range, locationId: 2 }, recordsParams: undefined },
      ["Money", "Invoiced in this range"],
    ]);
  });

  test("Occupancy compares with as many days earlier; New bookings with the previous days", () => {
    const drill = customDrill();
    const occupancy = { ...D.occupancy!, occupancyPctPrev: 61.3, newBookingsPrev: 2 };
    const tiles = tilesOf(<OccupancySection occupancy={occupancy} drill={drill} />);
    expect(tiles.find((t) => t.label === "Occupancy").trend.label).toBe("2.0 pts vs 15 days earlier");
    const newBookings = tiles.find((t) => t.label === "New bookings");
    expect(newBookings).toMatchObject({ sub: "in this range" });
    expect(newBookings.trend.label).toBe("2 vs previous 15 days");
  });
});

describe("Team section (sales executives only, with their revenue)", () => {
  const team = normalizeCeoDashboard({
    team: {
      perLocation: [{ locationId: 1, name: "I-8", salesExecutives: 1, quotations: 6, converted: 2 }],
      people: [
        { userId: 5, name: "Sara", role: "Sales Executive", locations: "I-8", quotations: 6, converted: 2, revenue: 300000 },
        { userId: 6, name: "Omar", role: "Sales Executive", locations: "F-7", quotations: 1, converted: 0, revenue: 0 },
      ],
      salesExecutives: 2,
      revenue: 300000,
    },
  }).team!;

  function render(drill: Drill) {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<TeamSection team={team} drill={drill} />);
    });
    return renderer!.root;
  }

  test("totals, people with revenue and no role labels; a person opens their last 6 months", () => {
    const drill = makeDrill("month", null);
    const root = render(drill);
    const tiles = root.findAll((n) => n.type === ("KpiGrid" as unknown))[0].props.tiles;
    expect(tiles.map((t: any) => [t.label, t.value])).toEqual([
      ["Sales executives", "2"],
      ["Revenue", tiles[1].value],
    ]);
    expect(tiles[1].value).toMatch(/300/);
    const rows = root.findAll((n) => n.type === ("ListRow" as unknown)).map((n) => n.props);
    const people = rows.filter((r) => r.avatar);
    expect(people.map((r) => r.title)).toEqual(["Sara", "Omar"]);
    expect(people[0].subtitle).toBe("I-8 · 6 quotes · 2 won (33.3%)");
    expect(people.every((r) => !/admin|sales executive/i.test(r.subtitle))).toBe(true);
    expect(people[0].meta).toMatch(/300/);
    act(() => people[0].onPress());
    expect(drill.breakdown).toHaveBeenCalledWith({ metric: "staff", userId: 5 }, ["Team", "Sara"]);
    // Per location: the sales executives only, no admin count.
    const location = rows.find((r) => r.title === "I-8" && !r.avatar);
    expect(location?.subtitle).toBe("1 sales executive");
  });

  test("the revenue bars list only those with revenue; a bar opens the quotations they converted", () => {
    const drill = makeDrill("quarter", 2);
    const root = render(drill);
    const bars = root.findAll((n) => n.type === ("HBarList" as unknown))[0].props;
    expect(bars.items.map((i: any) => [i.label, i.value])).toEqual([["Sara", 300000]]);
    act(() => bars.onPressItem(bars.items[0], 0));
    const [query, trail, title] = (drill.records as jest.Mock).mock.calls[0];
    expect(query).toMatchObject({ kind: "quotations", params: { stage: "converted", period: "quarter", locationId: 2, userId: 5 } });
    expect(trail).toEqual(["Team", "Sara", "Revenue"]);
    expect(title).toBe("Sara: converted quotations");
  });
});
