import { getToken } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import {
  BOOKED_MESSAGE,
  bookFreeMeetingRoom,
  bookingRoomName,
  bookingSummary,
  bookingWhenText,
  buildFreeBookBody,
  buildMeetingRoomSlots,
  canBookFreeMeetingRoom,
  CANCELLED_MESSAGE,
  cancelFreeMeetingRoom,
  clampDuration,
  clampMeetingRoomDate,
  dayOf,
  DEFAULT_CLOSING_HOUR,
  DEFAULT_OPENING_HOUR,
  durationOptions,
  freeStartOn,
  getFreeMeetingRooms,
  getMeetingRoomEntitlement,
  getMeetingRoomSpaceConfig,
  getMyFreeMeetingRooms,
  hourLabel,
  hoursLabel,
  hoursText,
  hoursUnit,
  isDurationAllowed,
  isMeetingRoomsUnavailable,
  MEETING_ROOM_ENDPOINTS,
  meetingRoomOpeningHours,
  meetingRoomToday,
  monthLabel,
  normalizeEntitlement,
  normalizeFreeBookings,
  normalizeMeetingRooms,
  seatsText,
  timeOf,
  usedPercent,
  type MeetingRoomSlot,
} from "./meetingRoomService";

jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null } as unknown as Headers,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function installFetch(...responses: Partial<Response>[]): FetchMock {
  const fetchMock: FetchMock = jest.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

/** The instant of a Pakistan wall-clock time (UTC+5). */
const pkt = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h - 5, min);

const NOT_INSTALLED =
  "Database update needed: run the script MR_01_meeting_rooms_TEST (MR_01_meeting_rooms_LIVE on the live database).";

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionExpiredState();
  setSessionRefresher(null);
  (getToken as jest.Mock).mockResolvedValue("api-jwt");
});

describe("endpoints", () => {
  it("are the API's routes under booking/meeting-room", () => {
    expect(MEETING_ROOM_ENDPOINTS.entitlement("2026-10-20")).toBe("/booking/meeting-room/entitlement?date=2026-10-20");
    expect(MEETING_ROOM_ENDPOINTS.rooms("2026-10-20")).toBe("/booking/meeting-room/rooms?date=2026-10-20");
    expect(MEETING_ROOM_ENDPOINTS.book).toBe("/booking/meeting-room/book");
    expect(MEETING_ROOM_ENDPOINTS.cancel(42)).toBe("/booking/meeting-room/42/cancel");
    expect(MEETING_ROOM_ENDPOINTS.my).toBe("/booking/meeting-room/my");
  });
});

describe("reading the API", () => {
  it("reads an entitlement", () => {
    const e = normalizeEntitlement({
      hasEntitlement: true,
      date: "2026-10-20",
      status: "Active",
      monthStart: "2026-10-01",
      monthEnd: "2026-10-31",
      allocatedMinutes: 600,
      usedMinutes: 120,
      remainingMinutes: 480,
      maxBookingHours: 3,
      privateSpaceName: "Office 309",
      locationId: 2,
      locationName: "I-8",
      message: null,
    });
    expect(e).toEqual({
      hasEntitlement: true,
      date: "2026-10-20",
      status: "Active",
      monthStart: "2026-10-01",
      monthEnd: "2026-10-31",
      allocatedMinutes: 600,
      usedMinutes: 120,
      remainingMinutes: 480,
      maxBookingHours: 3,
      privateSpaceName: "Office 309",
      locationId: 2,
      locationName: "I-8",
      message: null,
    });
  });

  it("reads no private office (the API's message) and PascalCase fields", () => {
    const e = normalizeEntitlement({ HasEntitlement: false, Message: "None of your private office bookings covers this date." }, "2026-11-02");
    expect(e).toMatchObject({
      hasEntitlement: false,
      date: "2026-11-02",
      allocatedMinutes: 0,
      remainingMinutes: 0,
      maxBookingHours: 0,
      locationId: null,
      message: "None of your private office bookings covers this date.",
    });
  });

  it("reads rooms with their taken times and drops rooms without an id", () => {
    const rooms = normalizeMeetingRooms({
      date: "2026-10-20",
      rooms: [
        {
          spaceId: 7,
          spaceCode: "MR-1",
          spaceName: "Board room",
          capacity: 8,
          locationId: 2,
          locationName: "I-8",
          busy: [{ startOn: "2026-10-20T10:00:00.000", endOn: "2026-10-20T12:00:00.000" }, { startOn: "" }],
        },
        { spaceId: 8, spaceCode: "MR-2", spaceName: "" },
        { spaceName: "No id" },
      ],
    });
    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toEqual({
      spaceId: 7,
      spaceCode: "MR-1",
      spaceName: "Board room",
      capacity: 8,
      locationId: 2,
      locationName: "I-8",
      busy: [{ startOn: "2026-10-20T10:00:00.000", endOn: "2026-10-20T12:00:00.000" }],
    });
    expect(rooms[1]).toMatchObject({ spaceId: 8, spaceName: "MR-2", capacity: null, busy: [] });
    expect(normalizeMeetingRooms(null)).toEqual([]);
  });

  it("reads the free bookings", () => {
    const list = normalizeFreeBookings([
      {
        bookingId: 91,
        spaceName: "Board room",
        locationName: "I-8",
        startOn: "2026-10-20T10:00:00.000",
        endOn: "2026-10-20T12:00:00.000",
        durationMinutes: 120,
        bookingStatusCode: "Confirmed",
        bookingStatusLabel: "Confirmed",
        challanNumber: "MR-000091",
        notes: "Client meeting",
        canCancel: true,
        isPast: false,
      },
      { bookingId: 0, startOn: "2026-10-20T10:00:00" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ bookingId: 91, canCancel: true, isPast: false, cancelReason: null, challanNumber: "MR-000091" });
    expect(normalizeFreeBookings({})).toEqual([]);
  });
});

describe("requests", () => {
  it("loads the entitlement, rooms and bookings with the sign-in token", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, { isSuccessful: true, data: { hasEntitlement: true, remainingMinutes: 360, maxBookingHours: 3 } }),
      jsonResponse(200, { isSuccessful: true, data: { date: "2026-10-20", rooms: [{ spaceId: 7, spaceName: "Board room" }] } }),
      jsonResponse(200, { isSuccessful: true, data: [{ bookingId: 5, startOn: "2026-10-21T09:00:00", endOn: "2026-10-21T10:00:00" }] }),
    );
    await expect(getMeetingRoomEntitlement("2026-10-20")).resolves.toMatchObject({ hasEntitlement: true, date: "2026-10-20", remainingMinutes: 360 });
    await expect(getFreeMeetingRooms("2026-10-20")).resolves.toMatchObject([{ spaceId: 7 }]);
    await expect(getMyFreeMeetingRooms()).resolves.toMatchObject([{ bookingId: 5 }]);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/booking\/meeting-room\/entitlement\?date=2026-10-20$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/booking\/meeting-room\/rooms\?date=2026-10-20$/);
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/booking\/meeting-room\/my$/);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer api-jwt");
  });

  it("books with startOn as Pakistan wall-clock text (no offset) and returns the API's message", async () => {
    const fetchMock = installFetch(
      jsonResponse(201, { isSuccessful: true, message: "Meeting room booked with your free hours.", data: { bookingId: 91 } }),
    );
    const message = await bookFreeMeetingRoom({ spaceId: 7, date: "2026-10-20", start: "10:00", durationHours: 2, notes: "  " });
    expect(message).toBe("Meeting room booked with your free hours.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/booking\/meeting-room\/book$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ spaceId: 7, startOn: "2026-10-20T10:00:00", durationHours: 2 });
  });

  it("keeps notes (trimmed, at most 500 characters)", () => {
    expect(buildFreeBookBody({ spaceId: 7, date: "2026-10-20", start: "09:00", durationHours: 1, notes: " Client " })).toEqual({
      spaceId: 7,
      startOn: "2026-10-20T09:00:00",
      durationHours: 1,
      notes: "Client",
    });
    expect(buildFreeBookBody({ spaceId: 7, date: "2026-10-20", start: "09:00", durationHours: 1, notes: "x".repeat(600) }).notes).toHaveLength(500);
    expect(freeStartOn("2026-10-20", "14:00")).toBe("2026-10-20T14:00:00");
  });

  it("cancels with the reason (null when blank)", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, { isSuccessful: true, message: "Booking cancelled. The hours are back in your monthly allowance.", data: { bookingId: 91 } }),
      jsonResponse(200, { isSuccessful: true, data: { bookingId: 92 } }),
    );
    await expect(cancelFreeMeetingRoom(91, " Plans changed ")).resolves.toBe(CANCELLED_MESSAGE);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/booking\/meeting-room\/91\/cancel$/);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ cancelReason: "Plans changed" });
    await cancelFreeMeetingRoom(92);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ cancelReason: null });
  });

  it("shows the API's message when it refuses a booking", async () => {
    installFetch(jsonResponse(400, { isSuccessful: false, message: "This meeting room is already booked for that time." }));
    await expect(
      bookFreeMeetingRoom({ spaceId: 7, date: "2026-10-20", start: "10:00", durationHours: 1 }),
    ).rejects.toThrow("This meeting room is already booked for that time.");
  });

  it("passes the 503 'Database update needed' message through", async () => {
    installFetch(jsonResponse(503, { isSuccessful: false, message: NOT_INSTALLED }));
    const error = await getMeetingRoomEntitlement("2026-10-20").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(NOT_INSTALLED);
    expect(isMeetingRoomsUnavailable(error)).toBe(true);
    expect(isMeetingRoomsUnavailable(new ApiError("x", 500))).toBe(false);
    expect(isMeetingRoomsUnavailable(new Error("x"))).toBe(false);
  });

  it("reads space-config, and gives no rows when it can't (the default hours are used)", async () => {
    installFetch(
      jsonResponse(200, { isSuccessful: true, data: [{ spaceCategory: "Meeting", openingTime: "09:00" }] }),
      jsonResponse(500, { message: "Something" }),
    );
    await expect(getMeetingRoomSpaceConfig()).resolves.toEqual([{ spaceCategory: "Meeting", openingTime: "09:00" }]);
    await expect(getMeetingRoomSpaceConfig()).resolves.toEqual([]);
  });

  it("has a default success message", () => {
    expect(BOOKED_MESSAGE).toBe("Meeting room booked with your free hours.");
  });
});

describe("opening hours", () => {
  const config = [
    { spaceCategory: "Private", openingTime: "06:00", closingTime: "23:00", status: 1 },
    { spaceCategory: "Meeting", locationId: 1, openingTime: "07:00", closingTime: "19:00", status: 1 },
    { spaceCategory: "meeting", locationId: 2, openingTime: "09:00:00", closingTime: "21:00:00", status: 1 },
    { spaceCategory: "Meeting", locationId: 3, openingTime: "10:00", closingTime: "18:00", status: 0 },
  ];

  it("uses the meeting row of the room's location", () => {
    expect(meetingRoomOpeningHours(config, 2)).toEqual({ open: 9, close: 21 });
    expect(meetingRoomOpeningHours(config, 1)).toEqual({ open: 7, close: 19 });
  });

  it("skips an inactive row of the location for the first active meeting row", () => {
    expect(meetingRoomOpeningHours(config, 3)).toEqual({ open: 7, close: 19 });
    expect(meetingRoomOpeningHours(config, null)).toEqual({ open: 7, close: 19 });
  });

  it("falls back to the first meeting row, then to the defaults", () => {
    expect(meetingRoomOpeningHours([{ spaceCategory: "Meeting", openingTime: "10:00", closingTime: "16:00", status: 0 }], 2)).toEqual({
      open: 10,
      close: 16,
    });
    expect(meetingRoomOpeningHours([], 2)).toEqual({ open: DEFAULT_OPENING_HOUR, close: DEFAULT_CLOSING_HOUR });
    expect(meetingRoomOpeningHours([{ spaceCategory: "Meeting", openingTime: "", closingTime: null }], 2)).toEqual({ open: 8, close: 20 });
  });
});

describe("start times", () => {
  const hours = { open: 8, close: 20 };
  const reasons = (slots: MeetingRoomSlot[]) => Object.fromEntries(slots.map((s) => [s.start, s.reason]));

  it("lists whole hours from opening to closing with readable labels", () => {
    const slots = buildMeetingRoomSlots({ date: "2026-10-21", hours, durationHours: 2, busy: [], now: pkt(2026, 10, 20, 12) });
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ start: "08:00", hour: 8, label: "8:00 AM - 10:00 AM", available: true, reason: "" });
    expect(slots[4].label).toBe("12:00 PM - 2:00 PM");
  });

  it("greys out starts whose booking would end after closing", () => {
    const r = reasons(buildMeetingRoomSlots({ date: "2026-10-21", hours, durationHours: 3, busy: [], now: pkt(2026, 10, 20, 12) }));
    expect(r["17:00"]).toBe("");
    expect(r["18:00"]).toBe("After closing");
    expect(r["19:00"]).toBe("After closing");
  });

  it("greys out starts that have passed in Pakistan time (the start itself counts as passed)", () => {
    const slots = buildMeetingRoomSlots({ date: "2026-10-20", hours, durationHours: 1, busy: [], now: pkt(2026, 10, 20, 10) });
    const r = reasons(slots);
    expect(r["09:00"]).toBe("Passed");
    expect(r["10:00"]).toBe("Passed");
    expect(r["11:00"]).toBe("");
  });

  it("greys out starts that overlap a taken time (touching ends are free)", () => {
    const busy = [{ startOn: "2026-10-21T10:00:00.000", endOn: "2026-10-21T12:00:00.000" }];
    const r = reasons(buildMeetingRoomSlots({ date: "2026-10-21", hours, durationHours: 2, busy, now: pkt(2026, 10, 20, 12) }));
    expect(r["08:00"]).toBe("");
    expect(r["09:00"]).toBe("Taken");
    expect(r["10:00"]).toBe("Taken");
    expect(r["11:00"]).toBe("Taken");
    expect(r["12:00"]).toBe("");
  });

  it("reads taken times sent with an offset, and ignores unreadable ones", () => {
    const busy = [
      { startOn: "2026-10-21T09:00:00Z", endOn: "2026-10-21T10:00:00Z" }, // 14:00 - 15:00 in Pakistan
      { startOn: "soon", endOn: "later" },
    ];
    const r = reasons(buildMeetingRoomSlots({ date: "2026-10-21", hours, durationHours: 1, busy, now: pkt(2026, 10, 20, 12) }));
    expect(r["14:00"]).toBe("Taken");
    expect(r["13:00"]).toBe("");
    expect(r["15:00"]).toBe("");
  });

  it("has no start times without a date", () => {
    expect(buildMeetingRoomSlots({ date: "", hours, durationHours: 1, busy: [] })).toEqual([]);
  });

  it("labels hours on the 12-hour clock", () => {
    expect(hourLabel(0)).toBe("12:00 AM");
    expect(hourLabel(9)).toBe("9:00 AM");
    expect(hourLabel(12)).toBe("12:00 PM");
    expect(hourLabel(20)).toBe("8:00 PM");
    expect(hourLabel(24)).toBe("12:00 AM");
  });
});

describe("durations and hours", () => {
  it("offers 1 .. the longest booking, and only what fits in the hours left", () => {
    expect(durationOptions(3)).toEqual([1, 2, 3]);
    expect(durationOptions(0)).toEqual([]);
    expect(isDurationAllowed(2, 120)).toBe(true);
    expect(isDurationAllowed(3, 150)).toBe(false);
    expect(clampDuration(3, 3, 120)).toBe(1); // 3 does not fit: the shortest allowed one, like the website
    expect(clampDuration(2, 3, 120)).toBe(2);
    expect(clampDuration(2, 3, 30)).toBe(1);
  });

  it("writes minutes as hours", () => {
    expect(hoursText(360)).toBe("6");
    expect(hoursText(90)).toBe("1.5");
    expect(hoursText(null)).toBe("0");
    expect(hoursUnit(60)).toBe("hour");
    expect(hoursUnit(120)).toBe("hours");
    expect(hoursLabel(1)).toBe("1 hour");
    expect(hoursLabel(3)).toBe("3 hours");
  });

  it("shows the share used, 0..100", () => {
    expect(usedPercent({ allocatedMinutes: 600, usedMinutes: 120 })).toBe(20);
    expect(usedPercent({ allocatedMinutes: 600, usedMinutes: 900 })).toBe(100);
    expect(usedPercent({ allocatedMinutes: 0, usedMinutes: 0 })).toBe(0);
    expect(usedPercent(null)).toBe(0);
  });

  it("names the allowance month", () => {
    expect(monthLabel("2026-10-01", "2026-10-20")).toBe("October 2026");
    expect(monthLabel(null, "2026-12-05")).toBe("December 2026");
    expect(monthLabel(null, "")).toBe("");
  });
});

describe("dates in Pakistan", () => {
  it("today is Pakistan's date, not the phone's", () => {
    expect(meetingRoomToday(new Date("2026-10-19T19:30:00Z"))).toBe("2026-10-20"); // 00:30 in Pakistan
    expect(meetingRoomToday(new Date("2026-10-19T18:59:00Z"))).toBe("2026-10-19");
  });

  it("never lets a date before today be chosen", () => {
    expect(clampMeetingRoomDate("2026-10-18", "2026-10-19")).toBe("2026-10-19");
    expect(clampMeetingRoomDate("2026-10-25", "2026-10-19")).toBe("2026-10-25");
  });

  it("reads the day and time of API wall-clock text as they are", () => {
    expect(dayOf("2026-10-20T14:30:00.000")).toBe("2026-10-20");
    expect(timeOf("2026-10-20T14:30:00.000")).toBe("2:30 PM");
    expect(timeOf("2026-10-20T00:15:00")).toBe("12:15 AM");
    expect(timeOf("2026-10-20")).toBe("");
    expect(bookingWhenText({ startOn: "2026-10-20T10:00:00.000", endOn: "2026-10-20T12:00:00.000" })).toBe(
      "Tue, 20 Oct 2026, 10:00 AM - 12:00 PM",
    );
  });
});

describe("display and the Book button", () => {
  it("names rooms and seats", () => {
    expect(bookingRoomName({ spaceName: null, spaceCode: "MR-1" })).toBe("MR-1");
    expect(bookingRoomName({ spaceName: null, spaceCode: null })).toBe("Meeting room");
    expect(seatsText({ capacity: 1 })).toBe("1 seat");
    expect(seatsText({ capacity: 6 })).toBe("6 seats");
    expect(seatsText({ capacity: null })).toBe("");
  });

  it("sums up the booking", () => {
    expect(
      bookingSummary({ roomName: "Board room", date: "2026-10-20", slotLabel: "10:00 AM - 12:00 PM", durationHours: 2, remainingMinutes: 360 }),
    ).toBe("Board room, Tue, 20 Oct 2026, 10:00 AM - 12:00 PM. Uses 2 of your 6 remaining hours.");
  });

  it("allows Book only with free hours, a room, a free start and a duration that fits", () => {
    const slots: MeetingRoomSlot[] = [
      { start: "10:00", hour: 10, label: "", available: true, reason: "" },
      { start: "11:00", hour: 11, label: "", available: false, reason: "Taken" },
    ];
    const entitlement = { hasEntitlement: true, remainingMinutes: 120 };
    const base = { entitlement, spaceId: 7, startSlot: "10:00", durationHours: 2, slots };
    expect(canBookFreeMeetingRoom(base)).toBe(true);
    expect(canBookFreeMeetingRoom({ ...base, startSlot: "11:00" })).toBe(false);
    expect(canBookFreeMeetingRoom({ ...base, startSlot: null })).toBe(false);
    expect(canBookFreeMeetingRoom({ ...base, spaceId: null })).toBe(false);
    expect(canBookFreeMeetingRoom({ ...base, durationHours: 3 })).toBe(false);
    expect(canBookFreeMeetingRoom({ ...base, entitlement: { hasEntitlement: false, remainingMinutes: 120 } })).toBe(false);
    expect(canBookFreeMeetingRoom({ ...base, entitlement: null })).toBe(false);
  });
});
