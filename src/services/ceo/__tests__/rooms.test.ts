// The CEO room report (GET api/ceo/rooms): the contract's answer read as typed data, partial / older / differently
// spelled answers read without failing, `available: false` kept as the server's message only, the list filters
// (shift, pricing, vacant) and the texts of the room cards.

import {
  ALL_ROOMS,
  ROOMS_UNAVAILABLE_MESSAGE,
  countRows,
  filterRooms,
  normalizeCeoRooms,
  normalizeRoomPricing,
  normalizeRoomShift,
  pricingFor,
  roomCardView,
  roomFilterCounts,
  roomPricingFilters,
  roomSaleView,
  roomsShownText,
  signedMoney,
  signedMoneyCompact,
  signedPct,
  summarizeRooms,
} from "../rooms";
import type { CeoRoom, CeoRoomReport, CeoRooms } from "../types";

const SALE_ACME = {
  bookingId: 101,
  customer: "Acme Traders",
  shift: "24/7",
  seatsSold: 4,
  startOn: "2026-01-01",
  endOn: "2026-12-31",
  listSeatPriceAtSale: 35000,
  shiftDiscountCapPct: 0,
  expectedSeatPrice: 35000,
  expectedMonthly: 140000,
  soldMonthly: 120000,
  soldSeatPrice: 30000,
  varianceMonthly: -20000,
  variancePct: -14.29,
  pricing: "under",
};

const SALE_BETA = {
  bookingId: 102,
  customer: "Beta Labs",
  shift: "24/7",
  seatsSold: 5,
  startOn: "2026-10-01",
  endOn: null,
  listSeatPriceAtSale: 17500,
  shiftDiscountCapPct: 0,
  expectedSeatPrice: 17500,
  expectedMonthly: 87500,
  soldMonthly: 87500,
  soldSeatPrice: 17500,
  varianceMonthly: 0,
  variancePct: 0,
  pricing: "at",
};

const SALE_GAMMA = {
  bookingId: 103,
  customer: "Gamma Studio",
  shift: "Morning",
  seatsSold: 4,
  startOn: "2026-09-15",
  endOn: "2027-03-14",
  listSeatPriceAtSale: 17500,
  shiftDiscountCapPct: 20,
  expectedSeatPrice: 14000,
  expectedMonthly: 56000,
  soldMonthly: 68000,
  soldSeatPrice: 17000,
  varianceMonthly: 12000,
  variancePct: 21.43,
  pricing: "over",
};

const ROOMS = [
  {
    spaceId: 11,
    name: "Office 1",
    code: "PO-1",
    locationId: 1,
    location: "I-8",
    spaceType: "Private Office",
    categoryCode: "PrivateOffice",
    seats: 4,
    listSeatPrice: 35000,
    listRoomPrice: 140000,
    occupiedNow: true,
    periodOccupancyPct: 100,
    sales: [SALE_ACME],
  },
  {
    spaceId: 12,
    name: "Shared A",
    code: "SS-A",
    locationId: 1,
    location: "I-8",
    spaceType: "Shared Space",
    categoryCode: "SharedSpace",
    seats: 10,
    listSeatPrice: 17500,
    listRoomPrice: 175000,
    occupiedNow: true,
    periodOccupancyPct: 65.6,
    sales: [SALE_BETA, SALE_GAMMA],
  },
  {
    spaceId: 13,
    name: "Office 2",
    code: "PO-2",
    locationId: 2,
    location: "F-7",
    spaceType: "Private Office",
    categoryCode: "PrivateOffice",
    seats: 2,
    listSeatPrice: 40000,
    listRoomPrice: 80000,
    occupiedNow: false,
    periodOccupancyPct: 0,
    sales: [],
  },
];

const SUMMARY = {
  rooms: 3,
  occupiedNow: 2,
  vacantNow: 1,
  occupancyNowPct: 66.7,
  periodOccupancyPct: 55.2,
  sales: 3,
  under: 1,
  at: 1,
  over: 1,
  unpriced: 0,
  listMonthly: 283500,
  soldMonthly: 275500,
  varianceMonthly: -8000,
  underMonthly: -20000,
  overMonthly: 12000,
  byShift: [
    { shift: "24/7", sales: 2, under: 1, at: 1, over: 0, unpriced: 0, expectedMonthly: 227500, soldMonthly: 207500, varianceMonthly: -20000 },
    { shift: "Morning", sales: 1, under: 0, at: 0, over: 1, unpriced: 0, expectedMonthly: 56000, soldMonthly: 68000, varianceMonthly: 12000 },
    { shift: "Evening", sales: 0, under: 0, at: 0, over: 0, unpriced: 0, expectedMonthly: 0, soldMonthly: 0, varianceMonthly: 0 },
  ],
};

const ANSWER = {
  isSuccessful: true,
  data: { available: true, period: "month", periodLabel: "October 2026", generatedAt: "2026-10-16T10:00:00Z", summary: SUMMARY, rooms: ROOMS },
};

function report(raw: unknown = ANSWER): CeoRoomReport {
  const r: CeoRooms = normalizeCeoRooms(raw);
  if (!r.available) throw new Error("expected a report");
  return r;
}

describe("normalizeCeoRooms: the contract", () => {
  const r = report();

  it("reads the period, the summary and every shift in order (a shift without sales as zeros)", () => {
    expect(r).toMatchObject({ available: true, period: "month", periodLabel: "October 2026", generatedAt: "2026-10-16T10:00:00Z" });
    expect(r.summary).toMatchObject({
      rooms: 3,
      occupiedNow: 2,
      vacantNow: 1,
      occupancyNowPct: 66.7,
      periodOccupancyPct: 55.2,
      sales: 3,
      under: 1,
      at: 1,
      over: 1,
      listMonthly: 283500,
      soldMonthly: 275500,
      varianceMonthly: -8000,
      unpriced: 0,
      underMonthly: -20000,
      overMonthly: 12000,
    });
    expect(r.summary.byShift.map((s) => [s.shift, s.sales, s.under, s.at, s.over, s.varianceMonthly])).toEqual([
      ["24/7", 2, 1, 1, 0, -20000],
      ["Morning", 1, 0, 0, 1, 12000],
      ["Evening", 0, 0, 0, 0, 0],
    ]);
  });

  it("reads rooms in the server's order with their sales", () => {
    expect(r.rooms.map((x) => x.name)).toEqual(["Office 1", "Shared A", "Office 2"]);
    expect(r.rooms[0]).toMatchObject({
      spaceId: 11,
      code: "PO-1",
      locationId: 1,
      location: "I-8",
      spaceType: "Private Office",
      categoryCode: "PrivateOffice",
      seats: 4,
      listSeatPrice: 35000,
      listRoomPrice: 140000,
      occupiedNow: true,
      periodOccupancyPct: 100,
    });
    expect(r.rooms[0].sales[0]).toMatchObject({
      bookingId: 101,
      customer: "Acme Traders",
      shift: "24/7",
      seatsSold: 4,
      startOn: "2026-01-01",
      endOn: "2026-12-31",
      expectedSeatPrice: 35000,
      soldSeatPrice: 30000,
      varianceMonthly: -20000,
      pricing: "under",
    });
    expect(r.rooms[0].sales[0].variancePct).toBe(-14.29);
    expect(r.rooms[1].sales.map((s) => [s.customer, s.shift, s.pricing])).toEqual([
      ["Beta Labs", "24/7", "at"],
      ["Gamma Studio", "Morning", "over"],
    ]);
    expect(r.rooms[2].sales).toEqual([]);
  });

  it("works the summary out from the rooms when the server sent none (the same figures)", () => {
    const worked = report({ ...ANSWER.data, summary: undefined }).summary;
    expect(worked).toMatchObject({ rooms: 3, occupiedNow: 2, vacantNow: 1, sales: 3, under: 1, at: 1, over: 1 });
    expect(worked.listMonthly).toBe(283500);
    expect(worked.soldMonthly).toBe(275500);
    expect(worked.varianceMonthly).toBe(-8000);
    expect(worked.occupancyNowPct).toBe(66.7);
    expect(worked.periodOccupancyPct).toBe(55.2);
    // The gap of the under-priced sales and the premium of the over-priced ones.
    expect([worked.underMonthly, worked.overMonthly, worked.unpriced]).toEqual([-20000, 12000, 0]);
    expect(worked.byShift).toEqual(report().summary.byShift);
    expect(summarizeRooms([]).byShift.map((s) => s.shift)).toEqual(["24/7", "Morning", "Evening"]);
  });
});

describe("normalizeCeoRooms: not available yet", () => {
  it("keeps only the server's message", () => {
    const message = "Run CEO_02_room_report on the database to see the room report.";
    expect(normalizeCeoRooms({ isSuccessful: true, data: { available: false, message } })).toEqual({ available: false, message });
    expect(normalizeCeoRooms({ Available: false, Message: "Not yet." })).toEqual({ available: false, message: "Not yet." });
    expect(normalizeCeoRooms({ isSuccessful: true, message: "From the envelope.", data: { available: "false" } })).toEqual({
      available: false,
      message: "From the envelope.",
    });
    expect(normalizeCeoRooms({ available: false })).toEqual({ available: false, message: ROOMS_UNAVAILABLE_MESSAGE });
  });

  it("anything else is a report, even an empty or broken answer", () => {
    for (const raw of [null, undefined, "x", [], {}, { isSuccessful: true, data: null }]) {
      const r = normalizeCeoRooms(raw);
      if (!r.available) throw new Error("expected a report");
      expect(r.rooms).toEqual([]);
      expect(r.summary).toMatchObject({ rooms: 0, sales: 0, occupancyNowPct: 0, periodOccupancyPct: 0 });
      expect(r.summary.byShift).toHaveLength(3);
      expect(r.period).toBe("month");
    }
    expect(normalizeCeoRooms({}, "year")).toMatchObject({ available: true, period: "year" });
  });
});

describe("normalizeCeoRooms: tolerant reading", () => {
  it("reads PascalCase keys", () => {
    const r = report({
      Available: true,
      Period: "quarter",
      Rooms: [{ SpaceId: 5, Name: "Office 5", Capacity: 3, ListSeatPrice: 30000, OccupiedNow: 1, Sales: [{ BookingId: 9, Customer: "Delta", ShiftRaw: "shift_evening", SoldMonthly: 60000 }] }],
    });
    expect(r.period).toBe("quarter");
    expect(r.rooms[0]).toMatchObject({ spaceId: 5, name: "Office 5", seats: 3, listRoomPrice: 90000, occupiedNow: true });
    expect(r.rooms[0].sales[0]).toMatchObject({ bookingId: 9, customer: "Delta", shift: "Evening", seatsSold: 3 });
  });

  it("works out missing sale figures from the prices and the shift cap", () => {
    const r = report({
      rooms: [
        {
          spaceId: 1,
          name: "Office 1",
          seats: 4,
          listSeatPrice: 35000,
          sales: [
            { customer: "Shift tenant", shift: "Evening", seatsSold: 2, listSeatPriceAtSale: 30000, shiftDiscountCapPct: 25, soldMonthly: 46000 },
            // A cap stored for 24/7 does not apply to it: compared with the full list price.
            { customer: "Full time", shift: null, shiftDiscountCapPct: 10, soldMonthly: 140000 },
            // The server's percent (two decimals) wins when sent.
            { customer: "Server percent", shift: "24/7", seatsSold: 1, soldMonthly: 33250, expectedSeatPrice: 35000, variancePct: -5 },
          ],
        },
      ],
    });
    const [shift, full, sent] = r.rooms[0].sales;
    expect(shift).toMatchObject({
      expectedSeatPrice: 22500,
      expectedMonthly: 45000,
      soldSeatPrice: 23000,
      varianceMonthly: 1000,
      pricing: "over",
    });
    expect(shift.variancePct).toBeCloseTo(2.222, 2);
    // No seats and no list price at sale: the room's.
    expect(full).toMatchObject({ shift: "24/7", seatsSold: 4, listSeatPriceAtSale: 35000, expectedSeatPrice: 35000, soldSeatPrice: 35000, varianceMonthly: 0, pricing: "at" });
    expect(sent).toMatchObject({ variancePct: -5, pricing: "under" });
  });

  it("keeps the server's pricing word, in any spelling", () => {
    const r = report({ rooms: [{ name: "R", seats: 1, sales: [{ pricing: "UNDER", soldMonthly: 1, expectedSeatPrice: 1 }, { pricing: "Above", expectedSeatPrice: 1 }] }] });
    expect(r.rooms[0].sales.map((s) => s.pricing)).toEqual(["under", "over"]);
  });

  it("names a room by its code or id when it has no name, and clamps occupancy to 0..100", () => {
    const r = report({ rooms: [{ code: "SS-9", periodOccupancyPct: 140 }, { spaceId: 4, periodOccupancyPct: -3 }, {}] });
    expect(r.rooms.map((x) => [x.name, x.periodOccupancyPct])).toEqual([
      ["SS-9", 100],
      ["Room 4", 0],
      ["Room", 0],
    ]);
  });
});

describe("sales without a list price", () => {
  const raw = {
    available: true,
    summary: { rooms: 1, sales: 2, under: 0, at: 1, over: 0, unpriced: 1, byShift: [{ shift: "Evening", sales: 2, at: 1, unpriced: 1 }] },
    rooms: [
      {
        spaceId: 7,
        name: "Office 7",
        seats: 3,
        listSeatPrice: null,
        listRoomPrice: null,
        occupiedNow: true,
        sales: [
          // As the API sends it: no price, nothing compared.
          { bookingId: 70, customer: "Epsilon", shift: "Evening", seatsSold: 3, listSeatPriceAtSale: null, shiftDiscountCapPct: 15, expectedSeatPrice: null, expectedMonthly: null, soldMonthly: 45000, soldSeatPrice: 15000, varianceMonthly: null, variancePct: null, pricing: null },
          { bookingId: 71, customer: "Zeta", shift: "Evening", seatsSold: 1, listSeatPriceAtSale: 20000, shiftDiscountCapPct: 15, expectedSeatPrice: 17000, soldMonthly: 17000, soldSeatPrice: 17000, varianceMonthly: 0, variancePct: 0, pricing: "at" },
        ],
      },
    ],
  };

  it("are read as unpriced, counted on their own and not compared", () => {
    const r = report(raw);
    const [unpriced, at] = r.rooms[0].sales;
    expect(r.rooms[0]).toMatchObject({ listSeatPrice: null, listRoomPrice: null });
    expect(unpriced).toMatchObject({ pricing: "unpriced", listSeatPriceAtSale: null, expectedSeatPrice: null, expectedMonthly: null, varianceMonthly: null, variancePct: null, soldSeatPrice: 15000 });
    expect(at.pricing).toBe("at");
    expect(r.summary).toMatchObject({ sales: 2, at: 1, unpriced: 1 });
    expect(r.summary.byShift[2]).toMatchObject({ shift: "Evening", sales: 2, at: 1, unpriced: 1 });
    const worked = summarizeRooms(r.rooms);
    expect(worked).toMatchObject({ sales: 2, at: 1, unpriced: 1, listMonthly: 17000, soldMonthly: 62000, varianceMonthly: 0 });
  });

  it("have their own chip only when there are any, and their own card texts", () => {
    const rooms = report(raw).rooms;
    expect(roomPricingFilters(rooms)).toEqual(["all", "under", "at", "over", "unpriced", "vacant"]);
    expect(roomPricingFilters(report().rooms)).toEqual(["all", "under", "at", "over", "vacant"]);
    expect(roomPricingFilters(report().rooms, "unpriced")).toContain("unpriced");
    expect(filterRooms(rooms, { ...ALL_ROOMS, shift: "all", pricing: "unpriced" }).map((i) => i.sales.map((x) => x.customer))).toEqual([["Epsilon"]]);
    const view = roomCardView(filterRooms(rooms, ALL_ROOMS)[0], "month");
    expect(view.facts).toBe("No list price · 0% occupied this month");
    const [sale, atSale] = view.sales;
    expect(sale).toMatchObject({
      pricingLabel: "No list price",
      tone: "warning",
      figures: [
        { label: "Sold per seat", value: "PKR 15,000" },
        { label: "Sold a month", value: "PKR 45,000" },
      ],
      note: "No list price was set for this room, so this booking is not compared",
    });
    expect(sale.accessibilityLabel).toContain("Epsilon, Evening · 3 seats, No list price, Sold per seat PKR 15,000");
    expect(atSale.note).toBe("Evening price: list less the 15% shift discount");
  });

  it("a 24/7 booking never says a shift discount applies", () => {
    const sale = report({ rooms: [{ name: "R", seats: 1, listSeatPrice: 30000, sales: [{ shift: "24/7", shiftDiscountCapPct: 10, soldMonthly: 30000 }] }] }).rooms[0].sales[0];
    expect(sale).toMatchObject({ expectedSeatPrice: 30000, pricing: "at" });
    expect(roomSaleView(sale, 0).note).toBeNull();
  });
});

describe("shift and pricing words", () => {
  it.each([
    ["24/7", "24/7"],
    ["24_7", "24/7"],
    ["24/7-I8", "24/7"],
    [null, "24/7"],
    ["", "24/7"],
    ["Morning", "Morning"],
    ["shift_morning", "Morning"],
    ["MORNING (9am - 3pm)", "Morning"],
    ["evening", "Evening"],
    ["Night", "Evening"],
    ["shift_evening", "Evening"],
    ["something else", "24/7"],
  ])("shift %p -> %p", (raw, shift) => {
    expect(normalizeRoomShift(raw)).toBe(shift);
  });

  it("pricing words and the 0.5% rule", () => {
    expect([normalizeRoomPricing("Under"), normalizeRoomPricing("at"), normalizeRoomPricing(" OVER "), normalizeRoomPricing("?")]).toEqual([
      "under",
      "at",
      "over",
      null,
    ]);
    expect([pricingFor(-0.6), pricingFor(-0.5), pricingFor(0), pricingFor(0.5), pricingFor(0.51), pricingFor(null)]).toEqual([
      "under",
      "at",
      "at",
      "at",
      "over",
      "at",
    ]);
  });
});

describe("filters", () => {
  const rooms: CeoRoom[] = report().rooms;
  const names = (filters = ALL_ROOMS) =>
    filterRooms(rooms, filters).map((item) => [item.room.name, item.vacant, item.sales.map((s) => s.customer)]);

  it("All: every room, a room without a booking as one vacant row", () => {
    expect(names()).toEqual([
      ["Office 1", false, ["Acme Traders"]],
      ["Shared A", false, ["Beta Labs", "Gamma Studio"]],
      ["Office 2", true, []],
    ]);
  });

  it("a shift keeps that shift's bookings (a vacant room has no shift)", () => {
    expect(names({ ...ALL_ROOMS, shift: "Morning", pricing: "all" })).toEqual([["Shared A", false, ["Gamma Studio"]]]);
    expect(names({ ...ALL_ROOMS, shift: "24/7", pricing: "all" })).toEqual([
      ["Office 1", false, ["Acme Traders"]],
      ["Shared A", false, ["Beta Labs"]],
    ]);
    expect(names({ ...ALL_ROOMS, shift: "Evening", pricing: "all" })).toEqual([]);
  });

  it("pricing keeps under / at / over bookings; Vacant keeps the rooms without one", () => {
    expect(names({ ...ALL_ROOMS, shift: "all", pricing: "under" })).toEqual([["Office 1", false, ["Acme Traders"]]]);
    expect(names({ ...ALL_ROOMS, shift: "all", pricing: "at" })).toEqual([["Shared A", false, ["Beta Labs"]]]);
    expect(names({ ...ALL_ROOMS, shift: "all", pricing: "over" })).toEqual([["Shared A", false, ["Gamma Studio"]]]);
    expect(names({ ...ALL_ROOMS, shift: "all", pricing: "vacant" })).toEqual([["Office 2", true, []]]);
    expect(names({ ...ALL_ROOMS, shift: "Morning", pricing: "vacant" })).toEqual([]);
    expect(names({ ...ALL_ROOMS, shift: "Morning", pricing: "under" })).toEqual([]);
  });

  it("counts what each chip would show, keeping the other filter", () => {
    expect(roomFilterCounts(rooms, ALL_ROOMS)).toEqual({
      shift: { all: 4, "24/7": 2, Morning: 1, Evening: 0 },
      pricing: { all: 4, under: 1, at: 1, over: 1, unpriced: 0, vacant: 1 },
      // Office 1 and Shared A (3 bookings) are in use; Office 2 is not.
      now: { all: 4, occupied: 3, vacant: 1 },
    });
    expect(roomFilterCounts(rooms, { ...ALL_ROOMS, shift: "Morning", pricing: "all" }).pricing).toEqual({ all: 1, under: 0, at: 0, over: 1, unpriced: 0, vacant: 0 });
    expect(roomFilterCounts(rooms, { ...ALL_ROOMS, shift: "all", pricing: "under" }).shift).toEqual({ all: 1, "24/7": 1, Morning: 0, Evening: 0 });
    expect(countRows([], ALL_ROOMS)).toBe(0);
  });

  it("right now: the rooms in use (with their bookings) or the vacant ones, with the other filters", () => {
    expect(names({ ...ALL_ROOMS, now: "occupied" })).toEqual([
      ["Office 1", false, ["Acme Traders"]],
      ["Shared A", false, ["Beta Labs", "Gamma Studio"]],
    ]);
    expect(names({ ...ALL_ROOMS, now: "vacant" })).toEqual([["Office 2", true, []]]);
    expect(names({ ...ALL_ROOMS, now: "occupied", pricing: "over" })).toEqual([["Shared A", false, ["Gamma Studio"]]]);
    expect(roomFilterCounts(rooms, { ...ALL_ROOMS, now: "vacant" }).pricing).toEqual({ all: 1, under: 0, at: 0, over: 0, unpriced: 0, vacant: 1 });
  });
});

describe("card texts", () => {
  const rooms = report().rooms;

  it("a room with a booking under the price", () => {
    const [item] = filterRooms(rooms, ALL_ROOMS);
    const card = roomCardView(item, "month");
    expect(card).toMatchObject({
      key: "room-11",
      title: "Office 1",
      subtitle: "PO-1 · I-8 · Private Office · 4 seats",
      now: { label: "Occupied now", tone: "success" },
      facts: "List PKR 35,000 a seat · PKR 140,000 a room · 100% occupied this month",
      vacant: false,
    });
    expect(card.accessibilityLabel).toBe("Office 1, PO-1 · I-8 · Private Office · 4 seats, Occupied now, " + card.facts);
    const [sale] = card.sales;
    expect(sale).toMatchObject({
      tenant: "Acme Traders",
      detail: "24/7 · 4 seats · 1 Jan 2026 to 31 Dec 2026",
      pricing: "under",
      pricingLabel: "Under price",
      tone: "danger",
      note: null,
    });
    expect(sale.figures).toEqual([
      { label: "List per seat", value: "PKR 35,000" },
      { label: "Expected per seat", value: "PKR 35,000" },
      { label: "Sold per seat", value: "PKR 30,000" },
      { label: "Difference a month", value: "-PKR 20,000 (-14.3%)", tone: "danger" },
    ]);
    expect(sale.accessibilityLabel).toContain("Acme Traders, 24/7 · 4 seats · 1 Jan 2026 to 31 Dec 2026, Under the expected price, List per seat PKR 35,000");
  });

  it("a shift booking over its shift price says how the expected price was worked out", () => {
    const sale = roomSaleView(rooms[1].sales[1], 1);
    expect(sale).toMatchObject({ pricingLabel: "Over price", tone: "success", note: "Morning price: list less the 20% shift discount" });
    expect(sale.detail).toBe("Morning · 4 seats · 15 Sep 2026 to 14 Mar 2027");
    expect(sale.figures[1]).toEqual({ label: "Expected per seat", value: "PKR 14,000" });
    expect(sale.figures[3]).toEqual({ label: "Difference a month", value: "+PKR 12,000 (+21.4%)", tone: "success" });
    const at = roomSaleView(rooms[1].sales[0], 0);
    expect(at).toMatchObject({ pricingLabel: "At price", tone: "neutral", detail: "24/7 · 5 seats · from 1 Oct 2026" });
    expect(at.figures[3]).toEqual({ label: "Difference a month", value: "PKR 0 (0%)" });
  });

  it("a vacant room", () => {
    const vacant = filterRooms(rooms, { ...ALL_ROOMS, shift: "all", pricing: "vacant" })[0];
    expect(roomCardView(vacant, "quarter")).toMatchObject({
      title: "Office 2",
      now: { label: "Vacant now", tone: "neutral" },
      facts: "List PKR 40,000 a seat · PKR 80,000 a room · 0% occupied this quarter",
      vacant: true,
      vacantText: "No booking this quarter",
      sales: [],
    });
  });

  it("signed amounts and the shown line", () => {
    expect([signedMoney(1500), signedMoney(-1500.5), signedMoney(0), signedMoney(-0.001)]).toEqual(["+PKR 1,500", "-PKR 1,500.50", "PKR 0", "PKR 0"]);
    expect([signedMoneyCompact(125000), signedMoneyCompact(-1250000), signedMoneyCompact(0)]).toEqual(["+PKR 125K", "-PKR 1.25M", "PKR 0"]);
    expect([signedPct(4.24), signedPct(-14.29), signedPct(0.02), signedPct(null)]).toEqual(["+4.2%", "-14.3%", "0%", "—"]);
    expect([roomsShownText(10, 34), roomsShownText(3, 3), roomsShownText(1, 1), roomsShownText(0, 0)]).toEqual([
      "Showing 10 of 34 rooms",
      "3 rooms",
      "1 room",
      "0 rooms",
    ]);
  });
});
