// The CEO seat report (GET api/ceo/seats): the contract's answer read as typed data, partial / empty / odd answers
// read without failing, `available: false` kept as the server's message only (the contract's text by default), the
// request (period, location, custom range, 503), the drill-down filter (locationId null = "No location") and sort
// (most rent not earned first), and the texts of the tiles, rows and room sheet. apiClient / config / authStorage are
// mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "ceo@worknest.test" })),
}));
jest.mock("../../apiClient", () => {
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
    errorMessage: (error: unknown, fallback = "Something went wrong. Please try again.") =>
      error instanceof ApiError ? error.message : fallback,
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { ApiError, apiRequest } from "../../apiClient";
import { CEO_DB_UPDATE_TITLE, ceoErrorView } from "../errors";
import {
  NO_LOCATION_NAME,
  SEAT_RULE_NOTE,
  SEATS_UNAVAILABLE_MESSAGE,
  gapText,
  getCeoSeats,
  normalizeCeoSeats,
  oneShiftText,
  pointsText,
  seatDrillMatches,
  seatDrillOf,
  seatDrillOverline,
  seatDrillRooms,
  seatDrillSubtitle,
  seatGroupItem,
  seatGroupItems,
  seatGroupName,
  seatRoomView,
  seatShiftRows,
  seatTiles,
  seatTotalsText,
  seatTrendData,
  seatTrendText,
  summarizeSeatRooms,
  unpricedText,
  type CeoSeatGroup,
  type CeoSeatReport,
  type CeoSeats,
} from "../seats";

const api = apiRequest as jest.Mock;

const ROOM_305 = {
  spaceId: 75,
  name: "305",
  code: "305",
  locationId: 1,
  location: "I-8",
  spaceTypeId: 3,
  spaceType: "Private Office",
  categoryCode: "PrivateOffice",
  seats: 5,
  seatsSold: 5,
  emptySeats: 0,
  seatOccupancyPct: 100.0,
  seats247: 5,
  seatsMorning: 0,
  seatsEvening: 0,
  oneShiftSeats: 0,
  bookingsNow: 1,
  occupiedNow: true,
  listSeatPrice: 35000.0,
  soldMonthly: 175000.0,
  revenuePerSeat: 35000.0,
  rentNotEarned: 0.0,
  periodSeatOccupancyPct: 26.3,
  periodRoomOccupancyPct: 26.3,
};

/** A 9-seat office sold for 5 seats: 2 on 24/7, 3 Morning and 1 Evening (2 seats with one shift free). */
const ROOM_9 = {
  spaceId: 9,
  name: "Office 9",
  code: "PO-9",
  locationId: 1,
  location: "I-8",
  spaceTypeId: 3,
  spaceType: "Private Office",
  seats: 9,
  seatsSold: 5,
  emptySeats: 4,
  seatOccupancyPct: 55.6,
  seats247: 2,
  seatsMorning: 3,
  seatsEvening: 1,
  oneShiftSeats: 2,
  bookingsNow: 3,
  occupiedNow: true,
  listSeatPrice: 30000,
  soldMonthly: 140000,
  revenuePerSeat: 28000,
  rentNotEarned: 120000,
  periodSeatOccupancyPct: 50,
  periodRoomOccupancyPct: 60,
};

const ROOM_10 = {
  spaceId: 10,
  name: "Shared 10",
  code: "SS-10",
  locationId: 2,
  location: "F-7",
  spaceTypeId: 4,
  spaceType: "Shared Space",
  seats: 8,
  seatsSold: 0,
  emptySeats: 8,
  seatOccupancyPct: 0,
  bookingsNow: 0,
  occupiedNow: false,
  listSeatPrice: 20000,
  soldMonthly: 0,
  revenuePerSeat: 0,
  rentNotEarned: 160000,
  periodSeatOccupancyPct: 0,
  periodRoomOccupancyPct: 0,
};

/** A room with no location and no list price. */
const ROOM_POOL = {
  spaceId: 11,
  name: "Desk Pool",
  code: "DP-1",
  locationId: null,
  location: null,
  spaceTypeId: 4,
  spaceType: "Shared Space",
  seats: 3,
  seatsSold: 1,
  emptySeats: 2,
  seatOccupancyPct: 33.3,
  seats247: 1,
  bookingsNow: 1,
  occupiedNow: true,
  listSeatPrice: null,
  soldMonthly: 15000,
  revenuePerSeat: 15000,
  rentNotEarned: null,
  periodSeatOccupancyPct: 30,
  periodRoomOccupancyPct: 40,
};

const SUMMARY = {
  locationId: null,
  spaceTypeId: null,
  name: "",
  rooms: 125,
  roomsOccupied: 15,
  roomOccupancyPct: 12.0,
  seats: 398,
  seatsSold: 64,
  emptySeats: 334,
  seatOccupancyPct: 16.1,
  gapPts: -4.1,
  partlyFilledRooms: 2,
  partlyFilledEmptySeats: 7,
  oneShiftSeats: 3,
  soldMonthly: 2240000.0,
  revenuePerSeat: 35000.0,
  listSeatPriceSold: 36000.0,
  listSeatPriceAll: 35000.0,
  revenueVsListPct: -2.8,
  rentNotEarned: 11690000.0,
  emptySeatsUnpriced: 4,
  periodSeatOccupancyPct: 10.2,
  periodRoomOccupancyPct: 9.9,
  periodDays: 19,
};

const group = (over: Record<string, unknown>) => ({ ...SUMMARY, ...over });

const months = Array.from({ length: 12 }, (_, i) => {
  const m = new Date(2025, 10 + i, 1);
  return {
    month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    rooms: 125,
    roomsOccupied: 10 + i,
    roomOccupancyPct: 8 + i,
    seats: 398,
    seatsSold: 50 + i,
    seatOccupancyPct: 12.6 + i,
  };
});

const ANSWER = {
  isSuccessful: true,
  message: "Success",
  data: {
    available: true,
    message: null,
    period: "month",
    periodLabel: "October 2026",
    from: null,
    to: null,
    generatedAt: "2026-10-19T12:00:00Z",
    asOf: "2026-10-19",
    summary: SUMMARY,
    byShift: [
      { shift: "24/7", seats: 40, bookings: 8 },
      { shift: "Morning", seats: 3, bookings: 1 },
      { shift: "Evening", seats: 1, bookings: 1 },
    ],
    byLocation: [
      group({ locationId: 2, name: "F-7", seats: 8, seatsSold: 0, seatOccupancyPct: 0, roomOccupancyPct: 0, rentNotEarned: 160000, emptySeats: 8, emptySeatsUnpriced: 0 }),
      group({ locationId: 1, name: "I-8", seats: 14, seatsSold: 10, seatOccupancyPct: 71.4, roomOccupancyPct: 100, rentNotEarned: 120000, emptySeats: 4, emptySeatsUnpriced: 0 }),
      group({ locationId: null, name: "No location", seats: 3, seatsSold: 1, seatOccupancyPct: 33.3, roomOccupancyPct: 100, rentNotEarned: 0, emptySeats: 2, emptySeatsUnpriced: 2 }),
    ],
    bySpaceType: [
      group({ spaceTypeId: 3, name: "Private Office", seats: 14, seatsSold: 10, seatOccupancyPct: 71.4 }),
      group({ spaceTypeId: 4, name: "Shared Space", seats: 11, seatsSold: 1, seatOccupancyPct: 9.1 }),
    ],
    months,
    rooms: [ROOM_305, ROOM_9, ROOM_10, ROOM_POOL],
  },
};

const report = (raw: unknown = ANSWER): CeoSeatReport => {
  const r = normalizeCeoSeats(raw);
  if (!r.available) throw new Error("expected the report");
  return r;
};

describe("normalizeCeoSeats", () => {
  test("reads the contract's answer (envelope)", () => {
    const r = report();
    expect(r).toMatchObject({ available: true, period: "month", periodLabel: "October 2026", generatedAt: "2026-10-19T12:00:00Z", asOf: "2026-10-19" });
    expect(r.range).toBeUndefined();
    expect(r.summary).toEqual(SUMMARY);
    expect(r.byShift).toEqual([
      { shift: "24/7", seats: 40, bookings: 8 },
      { shift: "Morning", seats: 3, bookings: 1 },
      { shift: "Evening", seats: 1, bookings: 1 },
    ]);
    expect(r.byLocation.map((g) => [g.locationId, g.name, g.seats, g.rentNotEarned])).toEqual([
      [2, "F-7", 8, 160000],
      [1, "I-8", 14, 120000],
      [null, "No location", 3, 0],
    ]);
    expect(r.bySpaceType.map((g) => [g.spaceTypeId, g.name])).toEqual([
      [3, "Private Office"],
      [4, "Shared Space"],
    ]);
    expect(r.months).toHaveLength(12);
    expect(r.months[0]).toEqual({ month: "2025-11", rooms: 125, roomsOccupied: 10, roomOccupancyPct: 8, seats: 398, seatsSold: 50, seatOccupancyPct: 12.6 });
    expect(r.rooms.map((x) => x.name)).toEqual(["305", "Office 9", "Shared 10", "Desk Pool"]);
    expect(r.rooms[0]).toEqual({ ...ROOM_305 });
    expect(r.rooms[3]).toMatchObject({ locationId: null, location: null, listSeatPrice: null, rentNotEarned: null, seatsMorning: 0, seatsEvening: 0 });
  });

  test("a bare object (no envelope), a custom range and PascalCase keys", () => {
    const r = report({
      Available: true,
      Period: "custom",
      From: "2026-10-01",
      To: "2026-10-15",
      Summary: { Seats: 10, SeatsSold: 4 },
      Rooms: [{ SpaceId: 3, Name: "Office 3", Seats: 10, SeatsSold: 4 }],
    });
    expect(r.period).toBe("custom");
    expect(r.range).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(r.summary).toMatchObject({ seats: 10, seatsSold: 4, emptySeats: 6, seatOccupancyPct: 40 });
    expect(r.rooms[0]).toMatchObject({ spaceId: 3, name: "Office 3", emptySeats: 6, seatOccupancyPct: 40, occupiedNow: true });
  });

  test("not available: only the server's message; the contract's text when none is sent", () => {
    expect(normalizeCeoSeats({ isSuccessful: true, data: { available: false, message: "Run SEAT_01 first.", summary: null } })).toEqual({
      available: false,
      message: "Run SEAT_01 first.",
    });
    expect(normalizeCeoSeats({ isSuccessful: true, message: "Success", data: { available: false, message: null } })).toEqual({
      available: false,
      message: SEATS_UNAVAILABLE_MESSAGE,
    });
    expect(normalizeCeoSeats({ available: "false" })).toEqual({ available: false, message: SEATS_UNAVAILABLE_MESSAGE });
    expect(SEATS_UNAVAILABLE_MESSAGE).toBe(
      "Database update needed: run the script SEAT_01_ceo_seats_TEST (SEAT_01_ceo_seats_LIVE on the live database) to see the seat figures.",
    );
  });

  test("an empty or odd answer never throws: zeros, nulls, empty lists, the requested period", () => {
    for (const raw of [null, undefined, "", 42, [], {}, { isSuccessful: true, data: null }, { data: { available: true } }]) {
      const r = normalizeCeoSeats(raw, "quarter");
      expect(r.available).toBe(true);
      if (!r.available) continue;
      expect(r).toMatchObject({ period: "quarter", periodLabel: "", generatedAt: null, asOf: null, byLocation: [], bySpaceType: [], months: [], rooms: [] });
      expect(r.byShift).toEqual([
        { shift: "24/7", seats: 0, bookings: 0 },
        { shift: "Morning", seats: 0, bookings: 0 },
        { shift: "Evening", seats: 0, bookings: 0 },
      ]);
      expect(r.summary).toMatchObject({ rooms: 0, seats: 0, seatsSold: 0, seatOccupancyPct: 0, rentNotEarned: 0, listSeatPriceSold: null, revenueVsListPct: null });
    }
  });

  test("a partial group: missing numbers as 0, prices as null, percents worked out, bad values ignored", () => {
    const r = report({
      available: true,
      summary: { rooms: "4", roomsOccupied: 3, seats: 20, seatsSold: "5", rentNotEarned: "abc", listSeatPriceSold: 0, revenueVsListPct: null },
      byLocation: [{ name: " I-8 ", seats: 9 }, "junk", null],
      bySpaceType: "not a list",
    });
    expect(r.summary).toMatchObject({
      name: "",
      rooms: 4,
      roomsOccupied: 3,
      roomOccupancyPct: 75,
      seats: 20,
      seatsSold: 5,
      emptySeats: 15,
      seatOccupancyPct: 25,
      gapPts: 50,
      rentNotEarned: 0,
      listSeatPriceSold: null,
      listSeatPriceAll: null,
      revenueVsListPct: null,
      revenuePerSeat: 0,
      periodDays: 0,
    });
    expect(r.byLocation).toHaveLength(1);
    expect(r.byLocation[0]).toMatchObject({ name: "I-8", locationId: null, seats: 9, seatsSold: 0, emptySeats: 9 });
    expect(r.bySpaceType).toEqual([]);
  });

  test("no summary: worked out from the rooms", () => {
    const { summary: _summary, ...data } = ANSWER.data;
    const r = report({ isSuccessful: true, data });
    expect(r.summary).toEqual(summarizeSeatRooms(r.rooms));
    expect(r.summary).toMatchObject({
      rooms: 4,
      roomsOccupied: 3,
      roomOccupancyPct: 75,
      seats: 25,
      seatsSold: 11,
      emptySeats: 14,
      seatOccupancyPct: 44,
      gapPts: 31,
      partlyFilledRooms: 2,
      partlyFilledEmptySeats: 6,
      oneShiftSeats: 2,
      soldMonthly: 330000,
      revenuePerSeat: 30000,
      listSeatPriceSold: 32500,
      listSeatPriceAll: 27500,
      revenueVsListPct: -3.1,
      rentNotEarned: 280000,
      emptySeatsUnpriced: 2,
      periodSeatOccupancyPct: 26.9,
      periodRoomOccupancyPct: 31.6,
    });
  });

  test("by shift: always 24/7, Morning, Evening in order; other spellings read, repeats added up", () => {
    const r = report({
      available: true,
      byShift: [{ shift: "shift_evening", seats: 2, bookings: 1 }, { shift: "Night", seats: 1, bookings: 1 }, { shift: "24_7", seats: 6, bookings: 2 }],
    });
    expect(r.byShift).toEqual([
      { shift: "24/7", seats: 6, bookings: 2 },
      { shift: "Morning", seats: 0, bookings: 0 },
      { shift: "Evening", seats: 3, bookings: 2 },
    ]);
  });

  test("months: oldest first, at most the last 12", () => {
    const many = [...months, { month: "2025-10", seatOccupancyPct: 1 }, { month: "2025-09", seatOccupancyPct: 1 }].reverse();
    const r = report({ available: true, months: many });
    expect(r.months.map((m) => m.month)).toEqual(months.map((m) => m.month));
  });

  test("a room: empty seats, rent not earned and occupancy worked out when missing", () => {
    const r = report({
      available: true,
      rooms: [
        { spaceId: 1, code: "PO-1", seats: 6, seatsSold: 2, listSeatPrice: 25000 },
        { spaceId: 2, seats: 4, seatsSold: 0, listSeatPrice: 0 },
        { name: "Bare" },
      ],
    });
    expect(r.rooms[0]).toMatchObject({ name: "PO-1", emptySeats: 4, rentNotEarned: 100000, occupiedNow: true, revenuePerSeat: 0, seatOccupancyPct: 33.3 });
    expect(r.rooms[1]).toMatchObject({ name: "Room 2", emptySeats: 4, listSeatPrice: null, rentNotEarned: null, occupiedNow: false });
    expect(r.rooms[2]).toMatchObject({ spaceId: null, name: "Bare", seats: 0, emptySeats: 0, occupiedNow: false });
  });
});

describe("getCeoSeats", () => {
  beforeEach(() => api.mockReset());
  const lastCall = () => {
    const [path, options] = api.mock.calls[api.mock.calls.length - 1];
    return { path, ...options };
  };

  test("GET ceo/seats with period and location, authenticated; all locations sends no location", async () => {
    api.mockResolvedValueOnce(ANSWER);
    const r = await getCeoSeats({ period: "quarter", locationId: 2 });
    expect(lastCall()).toMatchObject({ path: "/ceo/seats?period=quarter&locationId=2", method: "GET", requiresAuth: true, unwrapData: false });
    expect(r.available && r.summary.seats).toBe(398);
    api.mockResolvedValueOnce({ isSuccessful: true, data: { available: true } });
    await getCeoSeats({ period: "month", locationId: null });
    expect(lastCall().path).toBe("/ceo/seats?period=month");
    api.mockResolvedValueOnce({ isSuccessful: true, data: { available: true } });
    await getCeoSeats({ period: "year", locationId: 0 });
    expect(lastCall().path).toBe("/ceo/seats?period=year");
  });

  test("a custom range sends from / to; a calendar period never does", async () => {
    api.mockResolvedValue({ isSuccessful: true, data: { available: true } });
    const r = await getCeoSeats({ period: "custom", locationId: 3, range: { from: "2026-10-01", to: "2026-10-15" } });
    expect(lastCall().path).toBe("/ceo/seats?period=custom&from=2026-10-01&to=2026-10-15&locationId=3");
    expect(r.available && r.period).toBe("custom");
    await getCeoSeats({ period: "month", range: { from: "2026-10-01", to: "2026-10-15" } });
    expect(lastCall().path).toBe("/ceo/seats?period=month");
  });

  test("not available answers come back as the message; a 503 becomes the database update error", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { available: false, message: null } });
    await expect(getCeoSeats({ period: "month" })).resolves.toEqual({ available: false, message: SEATS_UNAVAILABLE_MESSAGE });
    api.mockRejectedValueOnce(new ApiError("Service unavailable", 503));
    const error = await getCeoSeats({ period: "month" }).catch((e) => e);
    expect(ceoErrorView(error).title).toBe(CEO_DB_UPDATE_TITLE);
  });
});

describe("drill-down", () => {
  const r = report();
  const names = (drill: Parameters<typeof seatDrillRooms>[1]) => seatDrillRooms(r.rooms, drill).map((x) => x.name);

  test("a location's rooms, most rent not earned first", () => {
    expect(names(seatDrillOf(r.byLocation[1], "location"))).toEqual(["Office 9", "305"]);
    expect(names(seatDrillOf(r.byLocation[0], "location"))).toEqual(["Shared 10"]);
  });

  test("locationId null is the rooms with no location (\"No location\")", () => {
    const drill = seatDrillOf(r.byLocation[2], "location");
    expect(drill).toEqual({ kind: "location", locationId: null, name: "No location" });
    expect(names(drill)).toEqual(["Desk Pool"]);
    // The name comes from the server; without one the contract's wording.
    const nameless = { ...r.byLocation[2], name: "" };
    expect(seatGroupName(nameless, "location")).toBe(NO_LOCATION_NAME);
    expect(seatDrillOf(nameless, "location").name).toBe("No location");
  });

  test("a space type's rooms; a room without a list price counts as 0, then most empty seats", () => {
    expect(names(seatDrillOf(r.bySpaceType[1], "spaceType"))).toEqual(["Shared 10", "Desk Pool"]);
    expect(names(seatDrillOf(r.bySpaceType[0], "spaceType"))).toEqual(["Office 9", "305"]);
    expect(names({ kind: "all", name: "Every room" })).toEqual(["Shared 10", "Office 9", "Desk Pool", "305"]);
  });

  test("ties keep the server's order; the input is not changed", () => {
    const rooms = report({ available: true, rooms: [{ name: "A", seats: 2 }, { name: "B", seats: 2 }, { name: "C", seats: 4 }] }).rooms;
    expect(seatDrillRooms(rooms, { kind: "all", name: "x" }).map((x) => x.name)).toEqual(["C", "A", "B"]);
    expect(rooms.map((x) => x.name)).toEqual(["A", "B", "C"]);
    expect(seatDrillMatches(rooms[0], { kind: "location", locationId: null, name: "No location" })).toBe(true);
    expect(seatDrillMatches(rooms[0], { kind: "location", locationId: 1, name: "I-8" })).toBe(false);
  });

  test("the sheet's texts: overline, subtitle and totals", () => {
    const rooms = seatDrillRooms(r.rooms, seatDrillOf(r.byLocation[1], "location"));
    expect(seatDrillOverline({ kind: "location", locationId: 1, name: "I-8" })).toBe("Seats by location");
    expect(seatDrillOverline({ kind: "spaceType", spaceTypeId: 3, name: "Private Office" })).toBe("Seats by space type");
    expect(seatDrillOverline({ kind: "all", name: "Every room" })).toBe("Seats in every room");
    expect(seatDrillSubtitle(rooms)).toBe("71.4% of seats sold now (rooms 100%). Most rent not earned first.");
    expect(seatTotalsText(rooms)).toBe("Total: 2 rooms, 14 seats, 10 sold, 4 empty, PKR 120,000 a month not earned");
    expect(seatTotalsText(r.rooms)).toBe(
      "Total: 4 rooms, 25 seats, 11 sold, 14 empty, PKR 280,000 a month not earned, 2 empty seats have no list price",
    );
    expect(seatTotalsText([])).toBe("Total: 0 rooms, 0 seats, 0 sold, 0 empty, PKR 0 a month not earned");
  });
});

describe("texts", () => {
  test("the rule note", () => {
    expect(SEAT_RULE_NOTE).toBe("A seat is sold when any shift on it is sold (24/7 + the larger of Morning and Evening, up to the room's seats)");
  });

  test("KPI tiles from the summary", () => {
    const tiles = seatTiles(report().summary, "month");
    expect(tiles.map((t) => [t.label, t.value, t.sub, t.tone])).toEqual([
      ["Seat occupancy now", "16.1%", "64 of 398 seats", "warning"],
      ["Rooms occupied now", "12%", "15 of 125 rooms, 4.1 points below seats", "info"],
      ["Empty seats", "334", "7 in 2 rooms already let", "warning"],
      ["Revenue per seat a month", "PKR 35K", "list PKR 36K a seat, -2.8%", "warning"],
      ["Rent not earned a month", "PKR 11.69M", "plus 4 empty seats with no list price", "warning"],
      ["Seats this month", "10.2%", "of seat-days sold, rooms 9.9%", "info"],
    ]);
    expect(tiles.every((t) => !!t.icon)).toBe(true);
  });

  test("tiles for a full house, a premium, no list price and nothing sold", () => {
    const full: CeoSeatGroup = {
      ...report().summary,
      seats: 10,
      seatsSold: 10,
      emptySeats: 0,
      seatOccupancyPct: 100,
      roomOccupancyPct: 100,
      gapPts: 0,
      partlyFilledEmptySeats: 0,
      partlyFilledRooms: 0,
      revenueVsListPct: 4.24,
      listSeatPriceSold: 30000,
      rentNotEarned: 0,
      emptySeatsUnpriced: 0,
    };
    const t = (g: CeoSeatGroup, period: "month" | "year" | "custom" = "month") =>
      Object.fromEntries(seatTiles(g, period).map((x) => [x.key, [x.value, x.sub, x.tone]]));
    expect(t(full)).toMatchObject({
      seats: ["100%", "10 of 10 seats", "success"],
      rooms: ["100%", "15 of 125 rooms, same as seats", "info"],
      empty: ["0", "every seat is sold", "success"],
      revenue: ["PKR 35K", "list PKR 30K a seat, +4.2%", "success"],
      rent: ["PKR 0", "every seat is sold", "success"],
    });
    expect(t({ ...full, revenueVsListPct: 0.3 }).revenue[2]).toBe("primary");
    expect(t({ ...full, listSeatPriceSold: null, revenueVsListPct: null }).revenue).toEqual(["PKR 35K", "no list price to compare", "neutral"]);
    expect(t({ ...full, seatsSold: 0, revenuePerSeat: 0 }).revenue).toEqual(["PKR 0", "no seat sold now", "neutral"]);
    expect(t({ ...full, emptySeats: 3, emptySeatsUnpriced: 3 }).rent).toEqual(["PKR 0", "3 empty seats have no list price", "success"]);
    expect(t({ ...full, emptySeats: 1, partlyFilledEmptySeats: 0 }).empty).toEqual(["1", "none in rooms already let", "warning"]);
    expect(t({ ...full, rentNotEarned: 30000, emptySeatsUnpriced: 0 }).rent).toEqual(["PKR 30K", "empty seats at the list price", "warning"]);
    expect(seatTiles(full, "year")[5].label).toBe("Seats this year");
    expect(seatTiles(full, "custom")[5].label).toBe("Seats in this range");
  });

  test("gap, points, one shift and unpriced wording", () => {
    expect(gapText(8.24)).toBe("8.2 points above seats");
    expect(gapText(-4.1)).toBe("4.1 points below seats");
    expect(gapText(1)).toBe("1 point above seats");
    expect(gapText(0.04)).toBe("same as seats");
    expect(pointsText(12)).toBe("12 points");
    expect(oneShiftText(0)).toBe("No seat has only one shift sold");
    expect(oneShiftText(1)).toBe("1 seat has one shift free to sell");
    expect(oneShiftText(12)).toBe("12 seats have one shift free to sell");
    expect(unpricedText(1)).toBe("1 empty seat has no list price");
  });

  test("seats by shift rows", () => {
    expect(seatShiftRows(report().byShift).map((x) => x.cells)).toEqual([
      ["24/7", "40", "8"],
      ["Morning", "3", "1"],
      ["Evening", "1", "1"],
    ]);
  });

  test("the 12-month chart and its figures as text", () => {
    const r = report();
    const data = seatTrendData(r.months);
    expect(data[0]).toEqual({ label: "Nov", title: "Nov 2025", values: [12.6, 8] });
    expect(data[11]).toEqual({ label: "Oct", title: "Oct 2026", values: [23.6, 19] });
    expect(seatTrendText(r.months)).toBe("Oct 2026: seats 23.6%, rooms 19%. Nov 2025: seats 12.6%, rooms 8%.");
    expect(seatTrendText(r.months.slice(0, 1))).toBe("Nov 2025: seats 12.6%, rooms 8%.");
    expect(seatTrendText([])).toBeNull();
  });

  test("location / space type rows: seat occupancy bar, sold of seats, rooms and rent not earned", () => {
    const r = report();
    expect(seatGroupItems(r.byLocation, "location").map((x) => x.item)).toEqual([
      { key: "location-2-0", label: "F-7", value: 0, valueLabel: "0% · 0/8 seats", detail: "rooms 0% · PKR 160K a month not earned" },
      { key: "location-1-1", label: "I-8", value: 71.4, valueLabel: "71.4% · 10/14 seats", detail: "rooms 100% · PKR 120K a month not earned" },
      { key: "location-none-2", label: "No location", value: 33.3, valueLabel: "33.3% · 1/3 seats", detail: "rooms 100% · 2 empty seats have no list price" },
    ]);
    const full = { ...r.byLocation[1], emptySeats: 0, rentNotEarned: 0, emptySeatsUnpriced: 0 };
    expect(seatGroupItem(full, "location").detail).toBe("rooms 100% · every seat sold");
    expect(seatGroupItem({ ...r.bySpaceType[0], name: "" }, "spaceType").label).toBe("Space type 3");
    // A group without rooms or seats is left out.
    expect(seatGroupItems([{ ...r.byLocation[0], seats: 0, rooms: 0 }], "location")).toEqual([]);
  });

  test("a room in the sheet: status, figures, shift split only with shift seats", () => {
    const r = report();
    const office9 = seatRoomView(r.rooms[1], "location");
    expect(office9).toMatchObject({
      key: "seat-room-9",
      title: "Office 9",
      subtitle: "PO-9 · Private Office",
      status: { label: "Partly filled", tone: "warning" },
      shifts: "24/7 2 · Morning 3 · Evening 1 · 2 seats have one shift free to sell",
    });
    expect(office9.figures.map((f) => [f.label, f.value, f.tone])).toEqual([
      ["Seats", "9", undefined],
      ["Sold", "5", undefined],
      ["Empty", "4", undefined],
      ["List a seat", "PKR 30,000", undefined],
      ["Rent not earned", "PKR 120,000", "warning"],
    ]);
    expect(office9.accessibilityLabel).toContain("Office 9, PO-9 · Private Office, Partly filled, Seats 9, Sold 5, Empty 4");

    const room305 = seatRoomView(r.rooms[0], "spaceType");
    expect(room305).toMatchObject({ subtitle: "I-8", status: { label: "Full", tone: "success" }, shifts: null });
    const pool = seatRoomView(r.rooms[3], "all");
    expect(pool.subtitle).toBe("DP-1 · No location · Shared Space");
    expect(pool.figures.slice(3).map((f) => f.value)).toEqual(["No list price", "Not priced"]);
    expect(seatRoomView(r.rooms[2], "location").status).toEqual({ label: "Vacant now", tone: "neutral" });
  });

  test("no emojis in any text", () => {
    const r = report();
    const texts = [
      SEAT_RULE_NOTE,
      SEATS_UNAVAILABLE_MESSAGE,
      ...seatTiles(r.summary, "month").flatMap((t) => [t.label, t.value, t.sub]),
      ...r.rooms.map((x) => seatRoomView(x, "all").accessibilityLabel),
      ...seatGroupItems(r.byLocation, "location").flatMap((x) => [x.item.label, x.item.valueLabel, x.item.detail]),
      seatTotalsText(r.rooms),
    ];
    expect(texts.join(" ")).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

// Keeps the union type in use for the type check.
const _typed: CeoSeats = { available: false, message: "" };
void _typed;
