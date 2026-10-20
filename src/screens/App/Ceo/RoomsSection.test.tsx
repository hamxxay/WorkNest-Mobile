/**
 * The CEO dashboard's Rooms section: loading / error / "not available yet" (only the server's message) / empty /
 * report states, the KPI tiles, the pricing by shift chart and the room list with its shift and pricing filters
 * (tiles and chart columns filter the list and scroll to it) and "Show more". React Native primitives, the UI kit,
 * charts and the CEO building blocks are mocked so this runs in plain Node; the services are the real, pure ones.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  View: "View",
  useWindowDimensions: () => ({ width: 390, height: 800, fontScale: 1, scale: 3 }),
}));
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
jest.mock("../../../components/charts", () => ({ BarChart: "BarChart" }));
jest.mock("../../../components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Card: "Card",
  Divider: "Divider",
  EmptyState: "EmptyState",
  FilterChips: "FilterChips",
  ResponsiveGrid: "ResponsiveGrid",
  StatusPill: "StatusPill",
  useScreenColumnWidth: () => 390,
}));
jest.mock("../../../theme", () => ({ spacing: jest.requireActual("../../../theme/tokens").spacing }));
jest.mock("./parts", () => {
  const R = jest.requireActual("react");
  return {
    CeoErrorState: "CeoErrorState",
    // Heading props kept; children only once loaded (as the real one: skeletons while loading).
    CeoSection: ({ children, ...props }: any) => R.createElement("CeoSection", props, props.loading ? null : children),
    ChartCard: ({ children, ...props }: any) => R.createElement("ChartCard", props, children),
    SectionEmpty: "SectionEmpty",
    StaleBanner: "StaleBanner",
  };
});
jest.mock("../Staff/Dashboard/parts", () => ({ FigureTable: "FigureTable", KpiGrid: "KpiGrid" }));

import { ApiError } from "../../../services/apiClient";
import { normalizeCeoRooms, type CeoRooms } from "../../../services/ceo";
import type { CeoQuery } from "./parts";
import { ROOMS_PAGE, RoomsBlock } from "./RoomsSection";
import type { Drill } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const sale = (bookingId: number, customer: string, shift: string, pricing: string, varianceMonthly: number) => ({
  bookingId,
  customer,
  shift,
  seatsSold: 2,
  listSeatPriceAtSale: 30000,
  shiftDiscountCapPct: shift === "24/7" ? 0 : 20,
  expectedSeatPrice: shift === "24/7" ? 30000 : 24000,
  soldSeatPrice: (shift === "24/7" ? 30000 : 24000) + varianceMonthly / 2,
  soldMonthly: 2 * (shift === "24/7" ? 30000 : 24000) + varianceMonthly,
  varianceMonthly,
  pricing,
});

const REPORT = normalizeCeoRooms({
  isSuccessful: true,
  data: {
    available: true,
    period: "month",
    periodLabel: "October 2026",
    summary: { rooms: 3, occupiedNow: 2, vacantNow: 1, occupancyNowPct: 66.7, periodOccupancyPct: 58.5, listMonthly: 168000, soldMonthly: 160000 },
    rooms: [
      { spaceId: 1, name: "Office 1", code: "PO-1", location: "I-8", categoryCode: "PrivateOffice", seats: 2, listSeatPrice: 30000, occupiedNow: true, periodOccupancyPct: 100, sales: [sale(11, "Acme", "24/7", "under", -10000)] },
      {
        spaceId: 2,
        name: "Shared A",
        location: "I-8",
        categoryCode: "SharedSpace",
        seats: 8,
        listSeatPrice: 30000,
        occupiedNow: true,
        periodOccupancyPct: 75.5,
        sales: [sale(12, "Beta", "24/7", "at", 0), sale(13, "Gamma", "Morning", "over", 2000)],
      },
      { spaceId: 3, name: "Office 2", location: "F-7", categoryCode: "PrivateOffice", seats: 2, listSeatPrice: 30000, occupiedNow: false, periodOccupancyPct: 0, sales: [] },
    ],
  },
});

function query(over: Partial<CeoQuery<CeoRooms>>): CeoQuery<CeoRooms> {
  return { data: null, error: null, loading: false, refreshing: false, loadedAt: null, reload: jest.fn(), refresh: jest.fn(), quietRefresh: jest.fn(), ...over };
}

function makeDrill(): Drill & { focus: jest.Mock; target: jest.Mock } {
  return { period: "month", locationId: null, focus: jest.fn(), target: jest.fn(() => jest.fn()) } as any;
}

function render(element: React.ReactElement): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}

const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const section = (root: ReactTestInstance) => byType(root, "CeoSection")[0];
/** The room cards' titles and the tenants inside them. */
const listed = (root: ReactTestInstance) =>
  root
    .findAll((n) => typeof n.type === "function" && (n.type as { name?: string }).name === "RoomCard")
    .map((card) => [card.props.view.title, ...card.props.view.sales.map((s: { tenant: string }) => s.tenant)]);
const chips = (root: ReactTestInstance, label: string) => byType(root, "FilterChips").find((c) => c.props.accessibilityLabel === label)!;

describe("RoomsBlock states", () => {
  test("heading and the shift note; skeletons while loading", () => {
    const root = render(<RoomsBlock query={query({ loading: true })} drill={makeDrill()} />);
    expect(section(root).props).toMatchObject({
      title: "Rooms",
      subtitle: "Occupancy and the price each room was sold at, this month",
      note: "Morning and Evening bookings are compared with their shift price",
      loading: true,
    });
    expect(byType(root, "KpiGrid")).toHaveLength(0);
  });

  test("not available yet: the server's message and nothing else", () => {
    const data = normalizeCeoRooms({ data: { available: false, message: "Run CEO_02_room_report on the database to see the room report." }, isSuccessful: true });
    const root = render(<RoomsBlock query={query({ data })} drill={makeDrill()} />);
    expect(byType(root, "SectionEmpty").map((n) => n.props)).toEqual([
      { title: "Not available yet", message: "Run CEO_02_room_report on the database to see the room report." },
    ]);
    expect(section(root).props.note).toBeUndefined();
    for (const type of ["KpiGrid", "ChartCard", "BarChart", "FilterChips", "StaleBanner"]) expect(byType(root, type)).toHaveLength(0);
  });

  test("a failed load shows its own error with retry", () => {
    const q = query({ error: new ApiError("Something went wrong on our side.", 500) });
    const root = render(<RoomsBlock query={q} drill={makeDrill()} />);
    const state = byType(root, "CeoErrorState")[0];
    expect(state.props).toMatchObject({ compact: true, error: q.error, onRetry: q.reload });
  });

  test("no rooms: the empty state; figures kept after a failed refresh get the warning", () => {
    const empty = render(<RoomsBlock query={query({ data: normalizeCeoRooms({ available: true, rooms: [] }) })} drill={makeDrill()} />);
    expect(byType(empty, "SectionEmpty")[0].props.title).toBe("No rooms");
    const stale = render(<RoomsBlock query={query({ data: REPORT, error: new ApiError("x", 500) })} drill={makeDrill()} />);
    expect(byType(stale, "StaleBanner")[0].props.what).toBe("The rooms below are");
    expect(byType(stale, "KpiGrid")).toHaveLength(1);
  });
});

describe("RoomsContent", () => {
  test("tiles: one per room category (never mixed), under / at / over with the monthly gap and premium, sold a month", () => {
    // The server sent no byCategory: worked out from the rooms (private offices and shared spaces apart).
    const root = render(<RoomsBlock query={query({ data: REPORT })} drill={makeDrill()} />);
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    expect(tiles.map((t: any) => [t.label, t.value, t.sub, t.tone])).toEqual([
      ["Private Office", "1 of 2", "50% now · 1 vacant · 50% days occupied", "primary"],
      ["Shared Space", "1 of 1", "100% now · 0 vacant · 75.5% days occupied", "success"],
      ["Sold under price", "1", "PKR 10K a month below", "danger"],
      ["At price", "1", "within 0.5% of expected", "neutral"],
      ["Sold over price", "1", "PKR 2K a month above", "success"],
      ["Sold a month", "PKR 160K", "-PKR 8K vs PKR 168K expected", "warning"],
    ]);
  });

  test("the pricing by shift chart: stacked under / at / over per shift in the theme's tones, with the figures as text", () => {
    const root = render(<RoomsBlock query={query({ data: REPORT })} drill={makeDrill()} />);
    const chart = byType(root, "BarChart")[0].props;
    expect(chart.stacked).toBe(true);
    expect(chart.series).toEqual([
      { label: "Under", tone: "danger" },
      { label: "At", tone: "neutral" },
      { label: "Over", tone: "success" },
    ]);
    expect(chart.data.map((d: any) => [d.label, ...d.values])).toEqual([
      ["24/7", 1, 1, 0],
      ["Morning", 0, 0, 1],
      ["Evening", 0, 0, 0],
    ]);
    expect(byType(root, "FigureTable")[0].props.rows.map((r: any) => r.cells)).toEqual([
      ["24/7", "1", "1", "0", "-PKR 10K"],
      ["Morning", "0", "0", "1", "+PKR 2K"],
      ["Evening", "0", "0", "0", "PKR 0"],
    ]);
  });

  test("the room list: every room, a vacant one as vacant; chips carry their counts and filter the list", () => {
    const root = render(<RoomsBlock query={query({ data: REPORT })} drill={makeDrill()} />);
    expect(listed(root)).toEqual([["Office 1", "Acme"], ["Shared A", "Beta", "Gamma"], ["Office 2"]]);
    const vacant = root.findAll((n) => n.type === ("StatusPill" as unknown) && n.props.label === "Not let");
    expect(vacant).toHaveLength(1);
    expect(chips(root, "Category").props.options.map((o: any) => [o.label, o.value, o.count])).toEqual([
      ["All", "all", 4],
      ["Private Office", "PrivateOffice", 2],
      ["Shared Space", "SharedSpace", 2],
    ]);
    expect(chips(root, "Right now").props.options.map((o: any) => [o.label, o.count])).toEqual([
      ["All", 4],
      ["Occupied now", 3],
      ["Vacant now", 1],
    ]);
    expect(chips(root, "Shift").props.options.map((o: any) => [o.label, o.count])).toEqual([
      ["All", 4],
      ["24/7", 2],
      ["Morning", 1],
      ["Evening", 0],
    ]);
    expect(chips(root, "Pricing").props.options.map((o: any) => [o.label, o.count])).toEqual([
      ["All", 4],
      ["Under", 1],
      ["At", 1],
      ["Over", 1],
      ["Not let", 1],
    ]);

    act(() => chips(root, "Shift").props.onChange("Morning"));
    expect(listed(root)).toEqual([["Shared A", "Gamma"]]);
    expect(chips(root, "Pricing").props.options.map((o: any) => o.count)).toEqual([1, 0, 0, 1, 0]);

    act(() => chips(root, "Pricing").props.onChange("vacant"));
    expect(listed(root)).toEqual([]);
    const empty = byType(root, "EmptyState")[0];
    expect(empty.props.title).toBe("No rooms match");
    act(() => empty.props.onAction());
    expect(listed(root)).toHaveLength(3);
  });

  test("a pricing tile or a shift column shows just that in the list and scrolls to it", () => {
    const drill = makeDrill();
    const root = render(<RoomsBlock query={query({ data: REPORT })} drill={drill} />);
    expect(drill.target).toHaveBeenCalledWith("roomList");
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    act(() => tiles[2].onPress());
    expect(listed(root)).toEqual([["Office 1", "Acme"]]);
    expect(chips(root, "Pricing").props.value).toBe("under");
    act(() => byType(root, "BarChart")[0].props.onPressItem(1));
    expect(listed(root)).toEqual([["Shared A", "Gamma"]]);
    expect([chips(root, "Shift").props.value, chips(root, "Pricing").props.value]).toEqual(["Morning", "all"]);
    // A category tile: that category's rooms in use right now.
    act(() => tiles[0].onPress());
    expect(listed(root)).toEqual([["Office 1", "Acme"]]);
    expect([chips(root, "Category").props.value, chips(root, "Right now").props.value]).toEqual(["PrivateOffice", "occupied"]);
    act(() => tiles[1].onPress());
    expect(listed(root)).toEqual([["Shared A", "Beta", "Gamma"]]);
    expect(chips(root, "Category").props.value).toBe("SharedSpace");
    expect(drill.focus.mock.calls).toEqual([["roomList"], ["roomList"], ["roomList"], ["roomList"]]);
    expect(tiles.filter((t: any) => t.onPress).map((t: any) => t.accessibilityHint)).toEqual([
      "Shows the Private Office rooms in use now in the list below",
      "Shows the Shared Space rooms in use now in the list below",
      "Shows the bookings sold under the price in the list below",
      "Shows the bookings sold at the price in the list below",
      "Shows the bookings sold over the price in the list below",
    ]);
    // Tiles without a list behind them do nothing on press.
    expect(tiles[5].onPress).toBeUndefined();
  });

  test("category tiles take the server's byCategory (its labels); a category without rooms is a plain tile", () => {
    const data = normalizeCeoRooms({
      isSuccessful: true,
      data: {
        available: true,
        summary: {
          rooms: 3,
          occupiedNow: 2,
          byCategory: [
            { categoryCode: "PrivateOffice", label: "Private Suites", rooms: 3, occupiedNow: 2, vacantNow: 1, occupancyNowPct: 66.7, periodOccupancyPct: 40.5 },
            { categoryCode: "SharedSpace", label: "Co-working", rooms: 0, occupiedNow: 0, vacantNow: 0, occupancyNowPct: 0, periodOccupancyPct: 0 },
          ],
        },
        rooms: [
          { spaceId: 1, name: "Office 1", categoryCode: "PrivateOffice", occupiedNow: true, sales: [] },
          { spaceId: 2, name: "Office 2", categoryCode: "PrivateOffice", occupiedNow: true, sales: [] },
          { spaceId: 3, name: "Office 3", categoryCode: "PrivateOffice", sales: [] },
        ],
      },
    });
    const root = render(<RoomsBlock query={query({ data })} drill={makeDrill()} />);
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    expect(tiles.slice(0, 2).map((t: any) => [t.label, t.value, t.sub, t.tone, t.icon, typeof t.onPress])).toEqual([
      ["Private Suites", "2 of 3", "66.7% now · 1 vacant · 40.5% days occupied", "primary", "business-outline", "function"],
      ["Co-working", "0 of 0", "No rooms", "neutral", "people-outline", "undefined"],
    ]);
    // Only one category has rooms: no category chips.
    expect(chips(root, "Category")).toBeUndefined();
  });

  test("a long list shows the first rooms and more on demand", () => {
    const rooms = Array.from({ length: ROOMS_PAGE + 3 }, (_, i) => ({ spaceId: i + 1, name: `Office ${i + 1}`, seats: 1, sales: [] }));
    const root = render(<RoomsBlock query={query({ data: normalizeCeoRooms({ available: true, rooms }) })} drill={makeDrill()} />);
    expect(listed(root)).toHaveLength(ROOMS_PAGE);
    const texts = byType(root, "AppText").map((n) => String(n.props.children));
    expect(texts).toContain(`Showing ${ROOMS_PAGE} of ${ROOMS_PAGE + 3} rooms`);
    const more = byType(root, "Button")[0];
    expect(more.props.title).toBe("Show 3 more");
    act(() => more.props.onPress());
    expect(listed(root)).toHaveLength(ROOMS_PAGE + 3);
    expect(byType(root, "Button")).toHaveLength(0);
  });

  test("sales without a list price: their own chart part, chip and pill, not compared", () => {
    const data = normalizeCeoRooms({
      available: true,
      rooms: [
        {
          spaceId: 9,
          name: "Office 9",
          seats: 2,
          listSeatPrice: null,
          occupiedNow: true,
          sales: [{ bookingId: 90, customer: "Eta", shift: "Evening", seatsSold: 2, soldMonthly: 50000, soldSeatPrice: 25000, pricing: null }],
        },
      ],
    });
    const root = render(<RoomsBlock query={query({ data })} drill={makeDrill()} />);
    const chart = byType(root, "BarChart")[0].props;
    expect(chart.series.map((x: any) => [x.label, x.tone])).toEqual([
      ["Under", "danger"],
      ["At", "neutral"],
      ["Over", "success"],
      ["No list price", "warning"],
    ]);
    expect(chart.data[2].values).toEqual([0, 0, 0, 1]);
    expect(byType(root, "FigureTable")[0].props.columns.map((c: any) => c.label)).toEqual(["Shift", "Under", "At", "Over", "No price", "Net a month"]);
    expect(chips(root, "Pricing").props.options.map((o: any) => [o.label, o.count])).toEqual([
      ["All", 1],
      ["Under", 0],
      ["At", 0],
      ["Over", 0],
      ["No list price", 1],
      ["Not let", 0],
    ]);
    expect(root.findAll((n) => n.type === ("StatusPill" as unknown) && n.props.label === "No list price")[0].props.tone).toBe("warning");
  });

  test("no emojis anywhere in the section's text", () => {
    const root = render(<RoomsBlock query={query({ data: REPORT })} drill={makeDrill()} />);
    const all = JSON.stringify(root.findAll(() => true).map((n) => (typeof n.props.children === "string" ? n.props.children : n.props.label ?? "")));
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
