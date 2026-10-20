/**
 * The CEO dashboard's Seats section: it loads on its own (GET api/ceo/seats, mocked here) and shows loading /
 * error with retry / "not available yet" (only the server's message) / the figures: KPI tiles, the 12-month seats
 * vs rooms chart, seats by shift, by location and by space type. A location / space type row (or the Empty seats /
 * Rent not earned tile) opens the room sheet, most rent not earned first, with "Show more". The dashboard's
 * refreshKey reloads it quietly only when it changes from one time to another. React Native primitives, the UI kit,
 * charts and the CEO display blocks are mocked so this runs in plain Node; useCeoQuery and the services are real.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  View: "View",
  useWindowDimensions: () => ({ width: 390, height: 800, fontScale: 1, scale: 3 }),
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
jest.mock("../../../components/charts", () => ({ BarChart: "BarChart", HBarList: "HBarList" }));
jest.mock("../../../components/ui", () => {
  const R = jest.requireActual("react");
  return {
    AppText: "AppText",
    // Children only while open (as the real sheet).
    BottomSheet: ({ children, ...props }: any) => R.createElement("BottomSheet", props, props.visible ? children : null),
    Button: "Button",
    Card: "Card",
    Divider: "Divider",
    EmptyState: "EmptyState",
    StatusPill: "StatusPill",
  };
});
jest.mock("../../../theme", () => ({ spacing: jest.requireActual("../../../theme/tokens").spacing }));
jest.mock("./parts", () => {
  const R = jest.requireActual("react");
  return {
    // The real loading hook; the display blocks as host elements.
    useCeoQuery: jest.requireActual("./parts").useCeoQuery,
    CeoErrorState: "CeoErrorState",
    // Heading props kept; children only once loaded (as the real one: skeletons while loading).
    CeoSection: ({ children, ...props }: any) => R.createElement("CeoSection", props, props.loading ? null : children),
    ChartCard: ({ children, ...props }: any) => R.createElement("ChartCard", props, children),
    ChartGrid: ({ children }: any) => R.createElement("ChartGrid", null, children),
    InlineEmpty: "InlineEmpty",
    SectionEmpty: "SectionEmpty",
    StaleBanner: "StaleBanner",
  };
});
jest.mock("../Staff/Dashboard/parts", () => ({ FigureTable: "FigureTable", KpiGrid: "KpiGrid" }));
jest.mock("../../../services/ceo/seats", () => ({ ...jest.requireActual("../../../services/ceo/seats"), getCeoSeats: jest.fn() }));

import { ApiError } from "../../../services/apiClient";
import type { CeoScope } from "../../../services/ceo";
import { SEAT_RULE_NOTE, SEATS_PAGE, SEATS_UNAVAILABLE_MESSAGE, getCeoSeats, normalizeCeoSeats } from "../../../services/ceo/seats";
import { SeatsBlock } from "./SeatsSection";
import type { Drill } from "./sections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const getSeats = getCeoSeats as jest.Mock;

const room = (spaceId: number, name: string, locationId: number | null, location: string | null, spaceTypeId: number, spaceType: string, over: object = {}) => ({
  spaceId,
  name,
  code: name,
  locationId,
  location,
  spaceTypeId,
  spaceType,
  seats: 4,
  seatsSold: 4,
  emptySeats: 0,
  seats247: 4,
  bookingsNow: 1,
  occupiedNow: true,
  listSeatPrice: 30000,
  soldMonthly: 120000,
  rentNotEarned: 0,
  ...over,
});

const ROOMS = [
  room(1, "PO-1", 1, "I-8", 3, "Private Office"),
  room(2, "PO-2", 1, "I-8", 3, "Private Office", { seats: 9, seatsSold: 5, emptySeats: 4, seats247: 2, seatsMorning: 3, seatsEvening: 1, oneShiftSeats: 2, rentNotEarned: 120000 }),
  room(3, "SS-1", 2, "F-7", 4, "Shared Space", { seats: 8, seatsSold: 0, emptySeats: 8, seats247: 0, bookingsNow: 0, occupiedNow: false, listSeatPrice: 20000, rentNotEarned: 160000 }),
  room(4, "Pool", null, null, 4, "Shared Space", { seats: 3, seatsSold: 1, emptySeats: 2, seats247: 1, listSeatPrice: null, rentNotEarned: null }),
];

const grp = (over: object) => ({ rooms: 2, roomsOccupied: 2, roomOccupancyPct: 100, seats: 13, seatsSold: 9, emptySeats: 4, seatOccupancyPct: 69.2, rentNotEarned: 120000, ...over });

const ANSWER = {
  isSuccessful: true,
  data: {
    available: true,
    period: "month",
    periodLabel: "October 2026",
    summary: {
      rooms: 4,
      roomsOccupied: 3,
      roomOccupancyPct: 75,
      seats: 24,
      seatsSold: 10,
      emptySeats: 14,
      seatOccupancyPct: 41.7,
      gapPts: 33.3,
      partlyFilledRooms: 2,
      partlyFilledEmptySeats: 6,
      oneShiftSeats: 2,
      soldMonthly: 300000,
      revenuePerSeat: 30000,
      listSeatPriceSold: 30000,
      revenueVsListPct: 0,
      rentNotEarned: 280000,
      emptySeatsUnpriced: 2,
      periodSeatOccupancyPct: 38.5,
      periodRoomOccupancyPct: 70.1,
    },
    byShift: [
      { shift: "24/7", seats: 7, bookings: 3 },
      { shift: "Morning", seats: 3, bookings: 1 },
      { shift: "Evening", seats: 1, bookings: 1 },
    ],
    byLocation: [
      grp({ locationId: 2, name: "F-7", rooms: 1, roomsOccupied: 0, roomOccupancyPct: 0, seats: 8, seatsSold: 0, emptySeats: 8, seatOccupancyPct: 0, rentNotEarned: 160000 }),
      grp({ locationId: 1, name: "I-8" }),
      grp({ locationId: null, name: "No location", rooms: 1, seats: 3, seatsSold: 1, emptySeats: 2, seatOccupancyPct: 33.3, rentNotEarned: 0, emptySeatsUnpriced: 2 }),
    ],
    bySpaceType: [
      grp({ spaceTypeId: 3, name: "Private Office" }),
      grp({ spaceTypeId: 4, name: "Shared Space", seats: 11, seatsSold: 1, seatOccupancyPct: 9.1, rentNotEarned: 160000 }),
    ],
    months: [
      { month: "2026-09", roomOccupancyPct: 70, seatOccupancyPct: 40 },
      { month: "2026-10", roomOccupancyPct: 75, seatOccupancyPct: 41.7 },
    ],
    rooms: ROOMS,
  },
};
const REPORT = normalizeCeoSeats(ANSWER);

function makeDrill(period: Drill["period"] = "month"): Drill {
  return { period, locationId: null, focus: jest.fn(), target: jest.fn(() => jest.fn()) } as any;
}

const SCOPE: CeoScope = { period: "month", locationId: null };

/** Lets the mocked answer arrive (its promise callbacks run inside act). */
const settle = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});

async function mount(props: Partial<React.ComponentProps<typeof SeatsBlock>> = {}) {
  let renderer: ReactTestRenderer | undefined;
  const element = (over: Partial<React.ComponentProps<typeof SeatsBlock>> = {}) => (
    <SeatsBlock scope={SCOPE} drill={makeDrill()} refreshKey={null} {...props} {...over} />
  );
  await act(async () => {
    renderer = TestRenderer.create(element());
  });
  await settle();
  const r = renderer!;
  return {
    root: r.root,
    update: async (over: Partial<React.ComponentProps<typeof SeatsBlock>>) => {
      await act(async () => {
        r.update(element(over));
      });
      await settle();
    },
  };
}

const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const section = (root: ReactTestInstance) => byType(root, "CeoSection")[0];
const sheet = (root: ReactTestInstance) => byType(root, "BottomSheet")[0];
const texts = (root: ReactTestInstance) => byType(root, "AppText").map((n) => String(n.props.children));
/** Room names listed in the sheet, in order. */
const listed = (root: ReactTestInstance) =>
  root.findAll((n) => typeof n.type === "function" && (n.type as { name?: string }).name === "SeatRoomRow").map((n) => n.props.view.title);
const bars = (root: ReactTestInstance, label: string) => byType(root, "HBarList").find((n) => n.props.label === label)!;

beforeEach(() => {
  getSeats.mockReset();
  getSeats.mockResolvedValue(REPORT);
});

describe("SeatsBlock states", () => {
  test("heading, the period words and the seat rule; skeletons while loading", async () => {
    getSeats.mockReturnValue(new Promise(() => undefined));
    const { root } = await mount();
    expect(getSeats).toHaveBeenCalledWith(SCOPE);
    expect(section(root).props).toMatchObject({
      title: "Seats",
      subtitle: "Seat occupancy now and this month, revenue per seat and rent not earned",
      note: SEAT_RULE_NOTE,
      loading: true,
    });
    expect(byType(root, "KpiGrid")).toHaveLength(0);
  });

  test("a custom range: the subtitle says so", async () => {
    getSeats.mockReturnValue(new Promise(() => undefined));
    const { root } = await mount({ drill: makeDrill("custom") });
    expect(section(root).props.subtitle).toBe("Seat occupancy now and in this range, revenue per seat and rent not earned");
  });

  test("not available yet: the server's message and nothing else", async () => {
    getSeats.mockResolvedValue(normalizeCeoSeats({ isSuccessful: true, data: { available: false, message: null, summary: null } }));
    const { root } = await mount();
    expect(byType(root, "SectionEmpty").map((n) => n.props)).toEqual([{ title: "Not available yet", message: SEATS_UNAVAILABLE_MESSAGE }]);
    expect(section(root).props.note).toBeUndefined();
    for (const type of ["KpiGrid", "ChartCard", "BarChart", "HBarList", "FigureTable", "StaleBanner", "BottomSheet"]) expect(byType(root, type)).toHaveLength(0);
  });

  test("a failed load shows its own error; Try again loads again", async () => {
    const error = new ApiError("Something went wrong on our side.", 500);
    getSeats.mockRejectedValueOnce(error);
    const { root } = await mount();
    const state = byType(root, "CeoErrorState")[0];
    expect(state.props).toMatchObject({ compact: true, error });
    await act(async () => state.props.onRetry());
    await settle();
    expect(getSeats).toHaveBeenCalledTimes(2);
    expect(byType(root, "CeoErrorState")).toHaveLength(0);
    expect(byType(root, "KpiGrid")).toHaveLength(1);
  });

  test("no rooms: the empty state", async () => {
    getSeats.mockResolvedValue(normalizeCeoSeats({ available: true }));
    const { root } = await mount();
    expect(byType(root, "SectionEmpty")[0].props.title).toBe("No rooms");
    expect(byType(root, "KpiGrid")).toHaveLength(0);
  });
});

describe("SeatsContent", () => {
  test("tiles: seats and rooms now, empty seats, revenue per seat, rent not earned, seats in the period", async () => {
    const { root } = await mount();
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    expect(tiles.map((t: any) => [t.label, t.value, t.sub, t.tone])).toEqual([
      ["Seat occupancy now", "41.7%", "10 of 24 seats", "primary"],
      ["Rooms occupied now", "75%", "3 of 4 rooms, 33.3 points above seats", "info"],
      ["Empty seats", "14", "6 in 2 rooms already let", "warning"],
      ["Revenue per seat a month", "PKR 30K", "list PKR 30K a seat, 0%", "primary"],
      ["Rent not earned a month", "PKR 280K", "plus 2 empty seats with no list price", "warning"],
      ["Seats this month", "38.5%", "of seat-days sold, rooms 70.1%", "info"],
    ]);
    expect(tiles.filter((t: any) => t.onPress).map((t: any) => t.label)).toEqual(["Empty seats", "Revenue per seat a month", "Rent not earned a month"]);
  });

  test("the 12-month chart (seats and rooms), seats by shift and the one-shift line", async () => {
    const { root } = await mount();
    const chart = byType(root, "BarChart")[0].props;
    expect(chart.series.map((s: any) => s.label)).toEqual(["Seats", "Rooms"]);
    expect(chart.data).toEqual([
      { label: "Sep", title: "Sep 2026", values: [40, 70] },
      { label: "Oct", title: "Oct 2026", values: [41.7, 75] },
    ]);
    expect(chart.formatValue(41.7)).toBe("41.7%");
    expect(chart.formatTick(40)).toBe("40%");
    expect(texts(root)).toContain("Oct 2026: seats 41.7%, rooms 75%. Sep 2026: seats 40%, rooms 70%.");
    expect(byType(root, "FigureTable")[0].props.rows.map((r: any) => r.cells)).toEqual([
      ["24/7", "7", "3"],
      ["Morning", "3", "1"],
      ["Evening", "1", "1"],
    ]);
    expect(texts(root)).toContain("2 seats have one shift free to sell");
    expect(byType(root, "ChartCard").map((c) => c.props.title)).toEqual(["Seats vs rooms, 12 months", "Seats sold now by shift", "By location", "By space type"]);
  });

  test("by location / by space type rows are buttons with hints", async () => {
    const { root } = await mount();
    const loc = bars(root, "Seat occupancy by location").props;
    expect(loc.items.map((i: any) => [i.label, i.valueLabel])).toEqual([
      ["F-7", "0% · 0/8 seats"],
      ["I-8", "69.2% · 9/13 seats"],
      ["No location", "33.3% · 1/3 seats"],
    ]);
    expect(loc.itemAccessibilityHint).toBe("Lists this location's rooms, most rent not earned first");
    expect(loc.max).toBe(100);
    const types = bars(root, "Seat occupancy by space type").props;
    expect(types.items.map((i: any) => i.label)).toEqual(["Private Office", "Shared Space"]);
    expect(types.itemAccessibilityHint).toBe("Lists the rooms of this space type, most rent not earned first");
  });

  test("a location row opens its rooms in the sheet, most rent not earned first, with the totals", async () => {
    const { root } = await mount();
    expect(sheet(root).props.visible).toBe(false);
    act(() => bars(root, "Seat occupancy by location").props.onPressItem({}, 1));
    expect(sheet(root).props).toMatchObject({ visible: true, title: "I-8", overline: "Seats by location" });
    expect(sheet(root).props.subtitle).toBe("69.2% of seats sold now (rooms 100%). Most rent not earned first.");
    expect(listed(root)).toEqual(["PO-2", "PO-1"]);
    expect(texts(root)).toContain("Total: 2 rooms, 13 seats, 9 sold, 4 empty, PKR 240,000 a month sold (PKR 26,667 a seat), PKR 120,000 a month not earned");
    const office = root.findAll((n) => typeof n.type === "function" && (n.type as { name?: string }).name === "SeatRoomRow")[0];
    expect(office.props.view.shifts).toBe("24/7 2 · Morning 3 · Evening 1 · 2 seats have one shift free to sell");
    expect(byType(office, "StatusPill")[0].props).toMatchObject({ label: "Partly filled", tone: "warning" });

    // Closing keeps the rooms while the sheet slides away.
    act(() => sheet(root).props.onClose());
    expect(sheet(root).props).toMatchObject({ visible: false, title: "I-8" });

    // The rooms with no location; then a space type.
    act(() => bars(root, "Seat occupancy by location").props.onPressItem({}, 2));
    expect(sheet(root).props.title).toBe("No location");
    expect(listed(root)).toEqual(["Pool"]);
    act(() => bars(root, "Seat occupancy by space type").props.onPressItem({}, 1));
    expect(sheet(root).props).toMatchObject({ title: "Shared Space", overline: "Seats by space type" });
    expect(listed(root)).toEqual(["SS-1", "Pool"]);
  });

  test("the Rent not earned tile opens every room", async () => {
    const { root } = await mount();
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    act(() => tiles[4].onPress());
    expect(sheet(root).props).toMatchObject({ visible: true, title: "Every room", overline: "Seats in every room" });
    expect(listed(root)).toEqual(["SS-1", "PO-2", "Pool", "PO-1"]);
    expect(tiles[4].accessibilityHint).toBe("Lists the rooms, most rent not earned first");
  });

  test("a long list shows the first rooms and more on demand; another group starts again", async () => {
    const many = Array.from({ length: SEATS_PAGE + 4 }, (_, i) => room(100 + i, `R-${i + 1}`, 1, "I-8", 3, "Private Office", { rentNotEarned: 1000 * (i + 1), emptySeats: 1 }));
    getSeats.mockResolvedValue(normalizeCeoSeats({ isSuccessful: true, data: { ...ANSWER.data, rooms: [...many, ...ROOMS] } }));
    const { root } = await mount();
    act(() => bars(root, "Seat occupancy by location").props.onPressItem({}, 1));
    expect(listed(root)).toHaveLength(SEATS_PAGE);
    // PO-2 (PKR 120,000) first, then the generated rooms from the most rent not earned.
    expect(listed(root).slice(0, 3)).toEqual(["PO-2", `R-${SEATS_PAGE + 4}`, `R-${SEATS_PAGE + 3}`]);
    expect(texts(root)).toContain(`Showing ${SEATS_PAGE} of ${SEATS_PAGE + 6} rooms`);
    const more = byType(sheet(root), "Button")[0];
    expect(more.props.title).toBe("Show 6 more");
    act(() => more.props.onPress());
    expect(listed(root)).toHaveLength(SEATS_PAGE + 6);
    expect(byType(sheet(root), "Button")).toHaveLength(0);
    act(() => bars(root, "Seat occupancy by space type").props.onPressItem({}, 0));
    expect(listed(root)).toHaveLength(SEATS_PAGE);
  });

  test("no emojis anywhere in the section's text", async () => {
    const { root } = await mount();
    act(() => bars(root, "Seat occupancy by location").props.onPressItem({}, 1));
    const all = JSON.stringify(
      root.findAll(() => true).map((n) => [typeof n.props.children === "string" ? n.props.children : "", n.props.label ?? "", n.props.title ?? "", n.props.sub ?? ""]),
    );
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("refreshKey", () => {
  test("reloads quietly only when it changes from one time to another", async () => {
    const view = await mount();
    expect(getSeats).toHaveBeenCalledTimes(1);
    // null -> a time: the dashboard's first answer for a scope this section already loads.
    await view.update({ refreshKey: 1000 });
    expect(getSeats).toHaveBeenCalledTimes(1);
    // A time -> another time: pulled to refresh / auto refresh. Quiet: the figures stay, no skeleton.
    let resolve: (value: unknown) => void = () => undefined;
    getSeats.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await view.update({ refreshKey: 2000 });
    expect(getSeats).toHaveBeenCalledTimes(2);
    expect(section(view.root).props.loading).toBe(false);
    expect(byType(view.root, "KpiGrid")).toHaveLength(1);
    await act(async () => resolve(REPORT));
    // Same time again: nothing.
    await view.update({ refreshKey: 2000 });
    expect(getSeats).toHaveBeenCalledTimes(2);
    // A new scope: the dashboard goes back to null, then a time; this section loads once, for the new scope.
    const scope: CeoScope = { period: "year", locationId: 2 };
    await view.update({ scope, refreshKey: null });
    expect(getSeats).toHaveBeenCalledTimes(3);
    expect(getSeats).toHaveBeenLastCalledWith(scope);
    await view.update({ scope, refreshKey: 3000 });
    expect(getSeats).toHaveBeenCalledTimes(3);
    await view.update({ scope, refreshKey: 4000 });
    expect(getSeats).toHaveBeenCalledTimes(4);
  });

  test("a failed quiet refresh keeps the figures with a warning", async () => {
    const view = await mount({ refreshKey: 1000 });
    getSeats.mockRejectedValueOnce(new ApiError("Network down", 0));
    await view.update({ refreshKey: 2000 });
    expect(byType(view.root, "StaleBanner")[0].props.what).toBe("The seat figures below are");
    expect(byType(view.root, "KpiGrid")).toHaveLength(1);
  });
});
