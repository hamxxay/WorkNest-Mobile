/**
 * My Meeting Rooms: the 503 "Database update needed" message with Retry, the no-private-office state (API message,
 * Book a tour, no booking controls), and with free hours the allowance, durations beyond the hours left disabled,
 * start times greyed out with their reason in Pakistan time, booking with startOn as sent by the website, and
 * cancelling with a reason. React Native primitives, the UI kit and the requests are mocked (the rules are the real
 * ones); the clock is fixed at 10:00 in Pakistan on 20 Oct 2026.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({
  Platform: { OS: "android", select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default },
  StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1 },
  ActivityIndicator: "ActivityIndicator",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  RefreshControl: "RefreshControl",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
jest.mock("react-native-vector-icons/Ionicons", () => "Ionicons");
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
let mockUser: object | null = { name: "Ayesha Khan", email: "ayesha@example.com" };
jest.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { spaceConfig: { list: "/space-config" } } }));
jest.mock("../../../services/apiClient", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    errorMessage: (error: unknown, fallback = "Something went wrong.") => (error instanceof Error ? error.message : fallback),
    serverMessage: () => null,
  };
});
jest.mock("../../../services/meetingRoomService", () => ({
  ...jest.requireActual("../../../services/meetingRoomService"),
  getMeetingRoomEntitlement: jest.fn(),
  getFreeMeetingRooms: jest.fn(),
  getMyFreeMeetingRooms: jest.fn(),
  getMeetingRoomSpaceConfig: jest.fn(),
  bookFreeMeetingRoom: jest.fn(),
  cancelFreeMeetingRoom: jest.fn(),
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("../../../components/ui", () => ({
  AppHeader: "AppHeader",
  AppText: "AppText",
  Banner: "Banner",
  BottomSheet: "BottomSheet",
  Button: "Button",
  Card: "Card",
  Chip: "Chip",
  DateField: "DateField",
  EmptyState: "EmptyState",
  ErrorState: "ErrorState",
  FieldLabel: "FieldLabel",
  FieldMessage: "FieldMessage",
  InfoRow: "InfoRow",
  KpiSkeleton: "KpiSkeleton",
  ListSkeleton: "ListSkeleton",
  ResponsiveGrid: "ResponsiveGrid",
  Screen: "Screen",
  SectionHeader: "SectionHeader",
  STAT_CARD_MIN_WIDTH: 148,
  StatCard: "StatCard",
  StatusPill: "StatusPill",
  TextField: "TextField",
  useToast: () => mockToast,
}));
jest.mock("../../../components/motion/ScalePressable", () => {
  const R = jest.requireActual("react");
  return {
    ScalePressable: ({ children, style: _style, ...props }: any) =>
      R.createElement("Pressable", props, typeof children === "function" ? children({ pressed: false }) : children),
  };
});
jest.mock("../../../utils/haptics", () => ({ haptics: { selection: jest.fn(), success: jest.fn() } }));
jest.mock("./shared/TitleRow", () => ({ TitleRow: "TitleRow" }));
jest.mock("./shared/ScrollableState", () => {
  const R = jest.requireActual("react");
  return { ScrollableState: ({ children }: any) => R.createElement("ScrollableState", null, children) };
});
jest.mock("../../../theme", () => {
  const tokens = jest.requireActual("../../../theme/tokens");
  const { lightColors, lightTones } = jest.requireActual("../../../theme/colors");
  const typo = jest.requireActual("../../../theme/typography");
  const theme = {
    colors: lightColors,
    tones: lightTones,
    spacing: tokens.spacing,
    radii: tokens.radii,
    typography: typo.typography,
    touchTarget: 44,
  };
  return {
    spacing: tokens.spacing,
    useTheme: () => theme,
    useThemedStyles: <T,>(create: (c: unknown, t: unknown) => T) => create(lightColors, theme),
  };
});

import { ApiError } from "../../../services/apiClient";
import * as rooms from "../../../services/meetingRoomService";
import MyMeetingRoomsScreen from "./MyMeetingRoomsScreen";
import { ChoiceTile } from "./meetingRooms/ChoiceTile";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const api = rooms as jest.Mocked<typeof rooms>;

const NOT_INSTALLED =
  "Database update needed: run the script MR_01_meeting_rooms_TEST (MR_01_meeting_rooms_LIVE on the live database).";

const ENTITLED = rooms.normalizeEntitlement({
  hasEntitlement: true,
  date: "2026-10-20",
  status: "Active",
  monthStart: "2026-10-01",
  allocatedMinutes: 600,
  usedMinutes: 480,
  remainingMinutes: 120,
  maxBookingHours: 3,
  privateSpaceName: "Office 309",
  locationId: 2,
  locationName: "I-8",
});

const ROOM = rooms.normalizeMeetingRoom({
  spaceId: 7,
  spaceName: "Board room",
  capacity: 8,
  locationId: 2,
  locationName: "I-8",
  busy: [{ startOn: "2026-10-20T12:00:00.000", endOn: "2026-10-20T13:00:00.000" }],
});

const BOOKING = rooms.normalizeFreeBooking({
  bookingId: 91,
  spaceName: "Board room",
  locationName: "I-8",
  startOn: "2026-10-21T09:00:00.000",
  endOn: "2026-10-21T11:00:00.000",
  durationMinutes: 120,
  bookingStatusCode: "Confirmed",
  bookingStatusLabel: "Confirmed",
  canCancel: true,
  isPast: false,
});

let renderer: TestRenderer.ReactTestRenderer | undefined;

async function render(): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = TestRenderer.create(<MyMeetingRoomsScreen />);
  });
  await flush();
  return renderer!.root;
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const buttons = (root: ReactTestInstance, title: string) => byType(root, "Button").filter((b) => b.props.title === title);
const texts = (root: ReactTestInstance) => byType(root, "AppText").map((n) => [].concat(n.props.children).join(""));

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-20T05:00:00Z"), doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
  jest.clearAllMocks();
  mockUser = { name: "Ayesha Khan", email: "ayesha@example.com" };
  api.getMeetingRoomSpaceConfig.mockResolvedValue([{ spaceCategory: "Meeting", locationId: 2, openingTime: "08:00", closingTime: "20:00", status: 1 }]);
  api.getMyFreeMeetingRooms.mockResolvedValue([]);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.useRealTimers();
});

test("the API's 503 'Database update needed' message is shown with Retry", async () => {
  api.getMeetingRoomEntitlement.mockRejectedValue(new ApiError(NOT_INSTALLED, 503));
  const root = await render();
  const error = byType(root, "ErrorState")[0];
  expect(error.props).toMatchObject({ title: "Meeting rooms are not available right now", message: NOT_INSTALLED });
  expect(api.getMeetingRoomEntitlement).toHaveBeenCalledWith("2026-10-20");

  api.getMeetingRoomEntitlement.mockResolvedValue(rooms.normalizeEntitlement({ hasEntitlement: false, message: "No office." }, "2026-10-20"));
  await act(async () => {
    await error.props.onRetry();
  });
  await flush();
  expect(byType(root, "ErrorState")).toHaveLength(0);
  expect(api.getMyFreeMeetingRooms).toHaveBeenCalledTimes(2);
});

test("no private office: the API's message, another date to check and Book a tour, no booking controls", async () => {
  const message = "Free meeting-room hours come with a confirmed private office booking. None of your private office bookings covers this date.";
  api.getMeetingRoomEntitlement.mockResolvedValue(rooms.normalizeEntitlement({ hasEntitlement: false, message }, "2026-10-20"));
  const root = await render();
  expect(byType(root, "EmptyState")[0].props).toMatchObject({ title: "Free meeting-room hours come with a private office", message });
  expect(byType(root, "DateField")[0].props.label).toBe("Private office starting later? Check another date");
  expect(buttons(root, "Book with free hours")).toHaveLength(0);
  expect(api.getFreeMeetingRooms).not.toHaveBeenCalled();

  act(() => buttons(root, "Book a tour")[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("BookTour");

  // Another date: its allowance is asked for (never a date before today in Pakistan).
  await act(async () => byType(root, "DateField")[0].props.onChange(new Date(2026, 10, 2)));
  expect(api.getMeetingRoomEntitlement).toHaveBeenLastCalledWith("2026-11-02");
});

test("with free hours: allowance, durations, start times in Pakistan time and Book with free hours", async () => {
  api.getMeetingRoomEntitlement.mockResolvedValue(ENTITLED);
  api.getFreeMeetingRooms.mockResolvedValue([ROOM]);
  api.bookFreeMeetingRoom.mockResolvedValue("Meeting room booked with your free hours.");
  const root = await render();

  expect(texts(root)).toEqual(expect.arrayContaining(["Free hours for October 2026", "2 of 10 hours left", "With Office 309 · I-8"]));
  expect(byType(root, "StatCard").map((s) => [s.props.label, s.props.value])).toEqual([
    ["Hours per month", "10"],
    ["Used", "8"],
    ["Remaining", "2"],
    ["Per booking", 3],
  ]);

  // 3 hours is more than the 2 hours left.
  const chips = byType(root, "Chip");
  expect(chips.map((c) => [c.props.label, c.props.disabled])).toEqual([
    ["1 hour", false],
    ["2 hours", false],
    ["3 hours", true],
  ]);

  // The only room is chosen; 10:00 has passed (start = now), 12:00 is taken, 19:00 is the last 1-hour start.
  const tiles = root.findAllByType(ChoiceTile);
  expect(tiles[0].props).toMatchObject({ title: "Board room", subtitle: "8 seats · I-8", selected: true });
  const slot = (start: string) => tiles.find((t) => t.props.title.startsWith(start))!;
  expect(slot("9:00 AM").props).toMatchObject({ disabled: true, subtitle: "Passed" });
  expect(slot("10:00 AM").props).toMatchObject({ disabled: true, subtitle: "Passed" });
  expect(slot("11:00 AM").props).toMatchObject({ disabled: false, subtitle: undefined, title: "11:00 AM - 12:00 PM" });
  expect(slot("12:00 PM").props).toMatchObject({ disabled: true, subtitle: "Taken" });
  expect(slot("7:00 PM").props).toMatchObject({ disabled: false, title: "7:00 PM - 8:00 PM" });
  expect(buttons(root, "Book with free hours")[0].props.disabled).toBe(true);

  act(() => slot("11:00 AM").props.onPress());
  expect(texts(root)).toContain("Board room, Tue, 20 Oct 2026, 11:00 AM - 12:00 PM. Uses 1 of your 2 remaining hours.");
  act(() => byType(root, "TextField")[0].props.onChangeText("Client meeting"));
  expect(buttons(root, "Book with free hours")[0].props.disabled).toBe(false);

  await act(async () => {
    await buttons(root, "Book with free hours")[0].props.onPress();
  });
  await flush();
  expect(api.bookFreeMeetingRoom).toHaveBeenCalledWith({
    spaceId: 7,
    date: "2026-10-20",
    start: "11:00",
    durationHours: 1,
    notes: "Client meeting",
  });
  expect(rooms.freeStartOn("2026-10-20", "11:00")).toBe("2026-10-20T11:00:00");
  expect(mockToast.success).toHaveBeenCalledWith("Meeting room booked with your free hours.", { title: "Meeting room booked" });
  // The allowance, rooms and bookings are read again.
  expect(api.getMeetingRoomEntitlement).toHaveBeenCalledTimes(2);
  expect(api.getMyFreeMeetingRooms).toHaveBeenCalledTimes(2);
});

test("a longer duration greys out starts that would end after closing", async () => {
  api.getMeetingRoomEntitlement.mockResolvedValue({ ...ENTITLED, remainingMinutes: 360 });
  api.getFreeMeetingRooms.mockResolvedValue([{ ...ROOM, busy: [] }]);
  const root = await render();
  act(() => byType(root, "Chip").find((c) => c.props.label === "3 hours")!.props.onPress());
  const tiles = root.findAllByType(ChoiceTile);
  expect(tiles.find((t) => t.props.title.startsWith("5:00 PM"))!.props).toMatchObject({ disabled: false, title: "5:00 PM - 8:00 PM" });
  expect(tiles.find((t) => t.props.title.startsWith("6:00 PM"))!.props).toMatchObject({ disabled: true, subtitle: "After closing" });
});

test("all hours used: no room or time choices", async () => {
  api.getMeetingRoomEntitlement.mockResolvedValue({ ...ENTITLED, usedMinutes: 600, remainingMinutes: 0 });
  api.getFreeMeetingRooms.mockResolvedValue([ROOM]);
  const root = await render();
  expect(byType(root, "Banner")[0].props.message).toBe(rooms.NO_FREE_HOURS_TEXT);
  expect(root.findAllByType(ChoiceTile)).toHaveLength(0);
  expect(buttons(root, "Book with free hours")).toHaveLength(0);
});

test("an upcoming booking can be cancelled with a reason after confirming", async () => {
  api.getMeetingRoomEntitlement.mockResolvedValue(ENTITLED);
  api.getFreeMeetingRooms.mockResolvedValue([ROOM]);
  api.getMyFreeMeetingRooms.mockResolvedValue([BOOKING, { ...BOOKING, bookingId: 80, canCancel: false, isPast: true }]);
  api.cancelFreeMeetingRoom.mockResolvedValue("Booking cancelled. The hours are back in your monthly allowance.");
  const root = await render();

  const cancels = buttons(root, "Cancel");
  expect(cancels).toHaveLength(1);
  expect(cancels[0].props.accessibilityLabel).toBe("Cancel Board room, Wed, 21 Oct 2026, 9:00 AM - 11:00 AM");
  act(() => cancels[0].props.onPress());

  const sheet = byType(root, "BottomSheet")[0];
  expect(sheet.props.title).toBe("Cancel this booking?");
  expect(texts(root)).toContain("Board room, Wed, 21 Oct 2026, 9:00 AM - 11:00 AM. The 2 hours go back to that month's free hours.");
  act(() => byType(root, "TextField").find((f) => f.props.label === "Reason (optional)")!.props.onChangeText("Plans changed"));

  const confirm = [].concat(byType(root, "BottomSheet")[0].props.footer.props.children).find((b: any) => b.props.title === "Cancel booking") as any;
  await act(async () => {
    await confirm.props.onPress();
  });
  await flush();
  expect(api.cancelFreeMeetingRoom).toHaveBeenCalledWith(91, "Plans changed");
  expect(mockToast.success).toHaveBeenCalledWith("Booking cancelled. The hours are back in your monthly allowance.", { title: "Booking cancelled" });
  expect(byType(root, "BottomSheet")).toHaveLength(0);
});

test("signed out: sign in, then back to this screen", async () => {
  mockUser = null;
  const root = await render();
  const empty = byType(root, "EmptyState")[0];
  expect(empty.props.actionLabel).toBe("Sign in");
  act(() => empty.props.onAction());
  expect(mockNavigate).toHaveBeenCalledWith("Login", { redirectAfterLogin: { screen: "MyMeetingRooms" } });
  expect(api.getMeetingRoomEntitlement).not.toHaveBeenCalled();
});
