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
import { MoneySection, OccupancySection, OutlookSection, SalesSection, TeamSection, type Drill } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const RAW_MONEY = {
  invoiced: 900,
  collected: 600,
  outstanding: 500,
  outstandingCount: 3,
  overdue: 200,
  overdueCount: 1,
  months: [{ month: "2026-10", invoiced: 900, collected: 600 }],
  aging: [{ bucket: "1_30", amount: 300, count: 2 }],
};

const D = normalizeCeoDashboard({
  period: "month",
  money: RAW_MONEY,
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

  test("Invoiced and its chart say they are by billing period", () => {
    const drill = makeDrill("month");
    const tiles = tilesOf(<MoneySection money={D.money!} drill={drill} />);
    expect(tiles.find((t) => t.label === "Invoiced").sub).toBe("this month, by billing period");
  });

  test("Billed in advance: after Outstanding and Overdue (under Outstanding), opens the advance invoices of any period", () => {
    const money = normalizeCeoDashboard({ money: { ...RAW_MONEY, billedInAdvance: 180000, billedInAdvanceCount: 2 } }).money!;
    const drill = makeDrill("quarter", 4);
    const tiles = tilesOf(<MoneySection money={money} drill={drill} />);
    expect(tiles.map((t) => t.label)).toEqual(["Invoiced", "Collected", "Outstanding", "Overdue", "Billed in advance"]);
    const tile = press(tiles, "Billed in advance");
    expect(tile).toMatchObject({ value: "PKR 180K", sub: "2 unpaid, for billing periods not started yet", accessibilityHint: "Opens the unpaid invoices for billing periods not started yet" });
    expect(drill.open).toHaveBeenCalledWith(
      {
        kind: "records",
        query: { kind: "invoices", params: { status: "advance", locationId: 4 } },
        title: "Billed in advance",
        keepTitle: true,
        timeless: true,
      },
      ["Money", "Billed in advance"],
    );
  });

  test("Billed in advance: PKR 0 is shown; hidden when an older API does not send it", () => {
    const zero = normalizeCeoDashboard({ money: { ...RAW_MONEY, billedInAdvance: 0 } }).money!;
    expect(tilesOf(<MoneySection money={zero} drill={makeDrill()} />).find((t) => t.label === "Billed in advance")).toMatchObject({
      value: "PKR 0",
      sub: "0 unpaid, for billing periods not started yet",
    });
    expect(tilesOf(<MoneySection money={D.money!} drill={makeDrill()} />).map((t) => t.label)).not.toContain("Billed in advance");
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
    expect(invoiced).toMatchObject({ sub: "in this range, by billing period", accessibilityHint: "Opens invoiced in this range by location" });
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

describe("CP_02 wording and drills (same rules as the CMS)", () => {
  function rootOf(element: React.ReactElement) {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(element);
    });
    return renderer!.root;
  }

  test("the funnel shows each stage's share of the stage before it, never above 100%", () => {
    const root = rootOf(<SalesSection sales={D.sales!} drill={makeDrill()} />);
    const funnel = root.findAll((n) => n.type === ("HBarList" as unknown))[0].props;
    // Bookings: no share of accepted (direct bookings are in it); "n from quotations" once the server says (CP_02).
    expect(funnel.items.map((i: any) => i.valueLabel)).toEqual(["10", "6 · 60% of tour inquiries", "3 · 50% of quotations", "2"]);
    const cp02 = rootOf(<SalesSection sales={{ ...D.sales!, bookingsFromQuotations: 1 }} drill={makeDrill()} />);
    expect(cp02.findAll((n) => n.type === ("HBarList" as unknown))[0].props.items[3].valueLabel).toBe("2 · 1 from quotations");
    const bigger = { ...D.sales!, funnel: [{ stage: "inquiries", label: "Tour inquiries", count: 2 }, { stage: "quotations", label: "Quotations", count: 5 }] };
    const items = rootOf(<SalesSection sales={bigger} drill={makeDrill()} />).findAll((n) => n.type === ("HBarList" as unknown))[0].props.items;
    expect(items.map((i: any) => i.valueLabel)).toEqual(["2", "5"]);
  });

  test("occupancy figures say now; the 'Other' space type (id 0) opens like the CMS", () => {
    const occupancy = { ...D.occupancy!, byType: [{ spaceTypeId: 0, name: "Other", total: 2, occupied: 1 }] };
    const drill = makeDrill();
    const root = rootOf(<OccupancySection occupancy={occupancy} drill={drill} />);
    const tiles = root.findAll((n) => n.type === ("KpiGrid" as unknown))[0].props.tiles;
    expect(tiles[0].sub).toBe("19 of 30 spaces in use now");
    const byType = root.findAll((n) => n.type === ("HBarList" as unknown)).find((n) => n.props.label === "Occupancy by space type")!.props;
    act(() => byType.onPressItem(byType.items[0], 0));
    expect(drill.breakdown).toHaveBeenCalledWith({ metric: "occupancy-type", spaceTypeId: 0 }, ["Occupancy", "Other"]);
  });

  test("Outstanding says billed in advance is not inside it (when the server sends that figure)", () => {
    const tiles = tilesOf(<MoneySection money={{ ...D.money!, billedInAdvance: 10, billedInAdvanceCount: 1 }} drill={makeDrill()} />);
    expect(tiles.find((t) => t.label === "Outstanding").sub).toBe("3 open, not billed in advance");
    expect(tilesOf(<MoneySection money={D.money!} drill={makeDrill()} />).find((t) => t.label === "Outstanding").sub).toBe("3 open invoices");
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

describe("CP_02 contract (money, occupancy by room category, sales, team, outlook)", () => {
  function rootOf(element: React.ReactElement) {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(element);
    });
    return renderer!.root;
  }
  const tilesIn = (root: ReactTestInstance) => root.findAll((n) => n.type === ("KpiGrid" as unknown))[0].props.tiles;

  const CP02 = normalizeCeoDashboard({
    period: "month",
    money: {
      ...RAW_MONEY,
      securityDeposits: 400,
      securityDepositsPrev: 100,
      securityDepositsCount: 2,
      received: 700,
      receivedPrev: 350,
      receivedCount: 5,
      receivedSeries: [{ month: "2026-10", received: 700, count: 5 }],
      billedInAdvance: 50,
      billedInAdvanceCount: 1,
    },
    occupancy: {
      totalSpaces: 161,
      occupiedSpaces: 13,
      occupancyPct: 8.1,
      activeBookings: 13,
      newBookings: 26,
      byType: [],
      categories: [
        { categoryCode: "SharedSpace", label: "Shared Space", rooms: 74, occupied: 0, occupancyPct: 0, occupancyPctPrev: 0, seats: 74, seatsSold: 0, seatOccupancyPct: 0 },
        { categoryCode: "PrivateOffice", label: "Private Office", rooms: 87, occupied: 13, occupancyPct: 14.9, occupancyPctPrev: 10, seats: 360, seatsSold: 61, seatOccupancyPct: 16.9 },
      ],
      months: [
        {
          month: "2026-10",
          occupancyPct: 8.1,
          newBookings: 26,
          categories: [
            { categoryCode: "PrivateOffice", label: "Private Office", rooms: 87, occupied: 13, occupancyPct: 14.9 },
            { categoryCode: "SharedSpace", label: "Shared Space", rooms: 74, occupied: 0, occupancyPct: 0 },
          ],
        },
      ],
      byLocation: [
        {
          locationId: 1,
          name: "I-8",
          total: 125,
          occupied: 13,
          seats: 398,
          seatsSold: 61,
          categories: [
            { categoryCode: "PrivateOffice", label: "Private Office", rooms: 56, occupied: 13, occupancyPct: 23.2, seats: 329, seatsSold: 61, seatOccupancyPct: 18.5 },
            { categoryCode: "SharedSpace", label: "Shared Space", rooms: 69, occupied: 0, occupancyPct: 0, seats: 69, seatsSold: 0, seatOccupancyPct: 0 },
          ],
        },
        { locationId: 0, name: "No location", total: 1, occupied: 0, categories: [{ categoryCode: "PrivateOffice", label: "Private Office", rooms: 1, occupied: 0, occupancyPct: 0, seats: 1, seatsSold: 0, seatOccupancyPct: 0 }] },
      ],
      leasesExpiring: [],
      leasesExpiringCount: 0,
    },
    sales: {
      funnel: [
        { stage: "inquiries", count: 4 },
        { stage: "quotations", count: 39 },
        { stage: "accepted", count: 27 },
        { stage: "bookings", count: 26 },
      ],
      quotationsBooked: 7,
      conversionRate: 17.9,
      quotationValue: 76176360,
      bookingValue: 21000000,
      bookingValueBasis: "contract",
      bookingsFromQuotations: 7,
      inquiriesNoBranch: 1,
      inquiriesAllLocations: false,
    },
    team: {
      revenueBasis: "bookings",
      perLocation: [{ locationId: 1, name: "I-8", salesExecutives: 3, quotations: 1, converted: 0, salesExecutivesOnly: true }],
      people: [{ userId: 4, name: "Muhammad Hamza", role: "Sales Executive", locations: "I-8", quotations: 1, converted: 0, revenue: 500000, bookings: 2 }],
      salesExecutives: 1,
      revenue: 500000,
    },
  });

  test("money: Received and Security deposits after Collected; Collected opens the invoices with payments", () => {
    const drill = makeDrill("month", 2);
    const tiles = tilesOf(<MoneySection money={CP02.money!} drill={drill} />);
    expect(tiles.map((t) => t.label)).toEqual(["Invoiced", "Collected", "Received", "Security deposits", "Outstanding", "Overdue", "Billed in advance"]);
    expect(tiles[0].sub).toBe("this month, by billing period, without deposits");
    expect(tiles[2]).toMatchObject({ sub: "5 receipts and payments" });
    expect(tiles[3]).toMatchObject({ sub: "2 invoices, not in Invoiced" });
    press(tiles, "Received");
    expect(drill.records.mock.calls[0]).toEqual([{ kind: "receipts", params: { period: "month", locationId: 2 } }, ["Money", "Received this month"], "Money received"]);
    press(tiles, "Security deposits");
    const [deposits] = drill.records.mock.calls[1];
    expect(deposits).toMatchObject({ kind: "invoices", params: { status: "deposit", locationId: 2 } });
    expect(deposits.params.from).toMatch(/^\d{4}-\d{2}-01$/);
    press(tiles, "Collected");
    expect(drill.open.mock.calls[0][0]).toMatchObject({ kind: "breakdown", recordsParams: { status: "collected" } });
  });

  test("money: the chart adds Received; older answers keep two series and no new cards", () => {
    const root = rootOf(<MoneySection money={CP02.money!} drill={makeDrill()} />);
    const chart = root.findAll((n) => n.type === ("BarChart" as unknown))[0].props;
    expect(chart.series.map((x: any) => x.label)).toEqual(["Invoiced", "Collected", "Received"]);
    expect(chart.data[0].values).toEqual([900, 600, 700]);
    const old = tilesOf(<MoneySection money={D.money!} drill={makeDrill()} />);
    expect(old.map((t) => t.label)).toEqual(["Invoiced", "Collected", "Outstanding", "Overdue"]);
  });

  test("occupancy: one card per room category (Private Office first), never one mixed figure", () => {
    const drill = makeDrill("month", null);
    const root = rootOf(<OccupancySection occupancy={CP02.occupancy!} drill={drill} />);
    const tiles = tilesIn(root);
    expect(tiles.map((t: any) => [t.label, t.value, t.sub])).toEqual([
      ["Private Office occupancy", "14.9%", "13 of 87 rooms in use now · 61 of 360 seats sold"],
      ["Shared Space occupancy", "0%", "0 of 74 rooms in use now · 0 of 74 seats sold"],
      ["Active bookings", "13", "confirmed, running today"],
      ["New bookings", "26", "this month"],
      ["Leases expiring", "0", "in the next 90 days"],
    ]);
    expect(tiles[0].trend.label).toMatch(/4\.9 pts/);
    expect(tiles[1].onPress).toBeUndefined();
    act(() => tiles[0].onPress());
    expect(drill.open).toHaveBeenCalledWith(
      { kind: "breakdown", query: { metric: "occupancy-category", category: "PrivateOffice", period: "month", locationId: null }, recordsParams: { occupied: true } },
      ["Occupancy", "Private Office"],
    );
    const chart = root.findAll((n) => n.type === ("BarChart" as unknown))[0].props;
    expect(chart.series.map((x: any) => x.label)).toEqual(["Private Office", "Shared Space"]);
    expect(chart.data[0].values).toEqual([14.9, 0]);
    const bars = root.findAll((n) => n.type === ("HBarList" as unknown));
    const byCategory = bars.find((n) => n.props.label === "Occupancy by room category")!.props;
    act(() => byCategory.onPressItem(byCategory.items[1], 1));
    expect(drill.breakdown).toHaveBeenCalledWith({ metric: "occupancy-category", category: "SharedSpace" }, ["Occupancy", "Shared Space"]);
    // By location: a heading per location, a bar per category opening its rooms ("No location": locationId=none).
    const atNone = bars.find((n) => n.props.label === "Occupancy at No location")!.props;
    act(() => atNone.onPressItem(atNone.items[0], 0));
    expect(drill.records).toHaveBeenCalledWith({ kind: "spaces", params: { locationId: "none", category: "PrivateOffice" } }, ["Occupancy", "No location", "Private Office"], "No location: Private Office");
    expect(bars.some((n) => n.props.label === "Occupancy by space type")).toBe(false);
  });

  test("sales: Booked is the contract value, opens the sales bookings; inquiries without a branch are named", () => {
    const drill = makeDrill("month", 1);
    const root = rootOf(<SalesSection sales={CP02.sales!} drill={drill} />);
    const tiles = tilesIn(root);
    expect(tiles.map((t: any) => t.label)).toEqual(["Tour inquiries", "Conversion", "Quotation value", "Booked (contract value)"]);
    expect(tiles[0].sub).toBe("this month, +1 without a branch (not included)");
    act(() => tiles[3].onPress());
    expect(drill.records.mock.calls[0][0]).toEqual({ kind: "bookings", params: { period: "month", locationId: 1, sales: true } });
    const funnel = root.findAll((n) => n.type === ("HBarList" as unknown))[0].props;
    expect(funnel.items[3].valueLabel).toBe("26 · 7 from quotations");
    act(() => funnel.onPressItem(funnel.items[3]));
    expect(drill.records.mock.calls[1][0]).toMatchObject({ params: { sales: true } });
  });

  test("team: revenue counts the bookings sold; a bar opens that seller's bookings", () => {
    const drill = makeDrill("quarter", 2);
    const root = rootOf(<TeamSection team={CP02.team!} drill={drill} />);
    expect(tilesIn(root)[1].sub).toBe("Bookings sold this quarter");
    const rows = root.findAll((n) => n.type === ("ListRow" as unknown)).map((n) => n.props);
    expect(rows.find((r) => r.avatar)?.subtitle).toBe("I-8 · 1 quotes · 0 won (0%) · 2 bookings sold");
    expect(rows.find((r) => r.title === "I-8" && !r.avatar)?.subtitle).toBe("3 sales executives · their quotations");
    const bars = root.findAll((n) => n.type === ("HBarList" as unknown))[0].props;
    act(() => bars.onPressItem(bars.items[0], 0));
    expect(drill.records.mock.calls[0]).toEqual([{ kind: "bookings", params: { period: "quarter", locationId: 2, sellerId: 4 } }, ["Team", "Muhammad Hamza", "Revenue"], "Muhammad Hamza: bookings sold"]);
  });

  test("outlook: Expected is the confirmed rent, with the pending rent under it", () => {
    const month = (m: string, expectedRent: number, confirmedRent: number, pendingRent: number | null) => ({
      month: m,
      label: m,
      expectedRent,
      confirmedRent,
      pendingRent,
      totalSpaces: 10,
      occupiedSpaces: 5,
      occupancyPct: 50,
      leasesEnding: 0,
      leasesStarting: 1,
      pendingStarting: 0,
    });
    const forecast = { months: 3, fromMonth: "2026-11", generatedAt: "", locations: [], totals: [month("Nov 2026", 4259400, 2924400, 1335000), month("Dec 2026", 100, 100, null), month("Jan 2027", 300, 100, null)] };
    const root = rootOf(<OutlookSection forecast={forecast} />);
    expect(root.findAll((n) => n.type === ("BarChart" as unknown))[0].props.data.map((d: any) => d.values[0])).toEqual([2924400, 100, 100]);
    const texts = root.findAll((n) => n.type === ("AppText" as unknown)).map((n) => n.props.children);
    expect(texts).toContain("+ PKR 1.33M pending confirmation");
    // An older API (no pendingRent): expected - confirmed; nothing when there is none.
    expect(texts).toContain("+ PKR 200 pending confirmation");
    expect(texts.filter((t: any) => typeof t === "string" && t.includes("pending confirmation"))).toHaveLength(2);
  });
});
