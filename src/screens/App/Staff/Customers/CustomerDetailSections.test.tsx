/**
 * Customer detail sections: each part shows its own loading, error and empty state (the overview's 503 "Database
 * update needed" shows its message without a retry; the other parts are untouched), the summary cards, "Show all"
 * on long lists and which rows open a detail screen. React Native, the UI kit and the dashboard grid are mocked so
 * this runs in plain Node; the overview service helpers are the real ones.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles }, View: "View", ActivityIndicator: "ActivityIndicator" }));
jest.mock("../../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));
jest.mock("../../../../services/staff", () => ({
  ...jest.requireActual("../../../../services/staff/customerOverview"),
  agreementStatusLabel: jest.requireActual("../../../../services/staff/agreements").agreementStatusLabel,
}));
jest.mock("../../../../components/ui", () => ({
  AppText: "AppText",
  Banner: "Banner",
  Button: "Button",
  Card: "Card",
  Divider: "Divider",
  EmptyState: "EmptyState",
  ErrorState: "ErrorState",
  KpiSkeleton: "KpiSkeleton",
  ListRow: "ListRow",
  ListSkeleton: "ListSkeleton",
  SectionHeader: "SectionHeader",
  StatusPill: "StatusPill",
}));
jest.mock("../../../../theme", () => ({
  spacing: jest.requireActual("../../../../theme/tokens").spacing,
  statusTone: jest.requireActual("../../../../theme/status").statusTone,
  useThemeColors: () => ({ primary: "#0f766e" }),
}));
jest.mock("../Dashboard/parts", () => ({ KpiGrid: "KpiGrid" }));

import {
  CUSTOMER_DETAIL_DB_MESSAGE,
  normalizeCustomerBooking,
  normalizeCustomerOverview,
  normalizeTimelineEvent,
  type SectionError,
} from "../../../../services/staff/customerOverview";
import { BookingRow, SectionBody, ShowAllFooter, SummarySection, TimelineRow, type SectionState } from "./CustomerDetailSections";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement): ReactTestInstance {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}
const all = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));

const DB_ERROR: SectionError = { status: 503, needsDbUpdate: true, notFound: false, message: CUSTOMER_DETAIL_DB_MESSAGE };
const NET_ERROR: SectionError = { status: 0, needsDbUpdate: false, notFound: false, message: "Can't reach the server." };
const OVERVIEW = normalizeCustomerOverview({
  summary: { activeBookings: 2, totalBookings: 3, totalInvoiced: 1000, totalPaid: 400, outstanding: 600, outstandingCount: 1 },
  bookings: [{ bookingId: 560, bookingStatusLabel: "Confirmed", spaceName: "PR-07", isActive: true }],
});
type Bookings = { bookings: unknown[] };

function bookingsBody(state: SectionState<Bookings>, onRetry = jest.fn()) {
  return render(
    <SectionBody
      state={state}
      what="Bookings"
      onRetry={onRetry}
      isEmpty={(d) => !d.bookings.length}
      empty={{ illustration: "calendar", title: "No bookings yet" }}
    >
      {(d) => React.createElement("rows", { count: d.bookings.length })}
    </SectionBody>,
  );
}

describe("SectionBody", () => {
  it("shows a skeleton until the section's answer is in", () => {
    expect(all(bookingsBody({ loading: true, result: null }), "ListSkeleton")).toHaveLength(1);
    expect(all(bookingsBody({ loading: false, result: null }), "ListSkeleton")).toHaveLength(1);
  });

  it("the database update message shows in the section, with no retry (it cannot help until the script has run)", () => {
    const root = bookingsBody({ loading: false, result: { ok: false, error: DB_ERROR } });
    const [state] = all(root, "ErrorState");
    expect(state.props.title).toBe("Bookings could not be loaded");
    expect(state.props.message).toBe("Database update needed: run the script CD_01_customer_detail_TEST");
    expect(state.props.onRetry).toBeUndefined();
    expect(all(root, "rows")).toHaveLength(0);
  });

  it("another failure offers a retry of that section only", () => {
    const retry = jest.fn();
    const [state] = all(bookingsBody({ loading: false, result: { ok: false, error: NET_ERROR } }, retry), "ErrorState");
    expect(state.props.message).toBe("Can't reach the server.");
    state.props.onRetry();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("an empty list shows its empty state; rows otherwise", () => {
    const empty = bookingsBody({ loading: false, result: { ok: true, data: { bookings: [] } } });
    expect(all(empty, "EmptyState")[0].props.title).toBe("No bookings yet");
    const rows = bookingsBody({ loading: false, result: { ok: true, data: { bookings: [1, 2] } } });
    expect(all(rows, "rows")[0].props.count).toBe(2);
  });
});

describe("SummarySection", () => {
  it("shows the five cards from the summary", () => {
    const root = render(<SummarySection state={{ loading: false, result: { ok: true, data: OVERVIEW } }} onRetry={jest.fn()} />);
    const tiles = all(root, "KpiGrid")[0].props.tiles as { label: string; value: string; sub: string }[];
    expect(tiles.map((t) => t.label)).toEqual(["Active bookings", "Total invoiced", "Paid", "Outstanding", "Security deposit held"]);
    expect(tiles[0]).toMatchObject({ value: "2", sub: "3 bookings in all" });
    expect(tiles[2].sub).toBe("40% of invoiced");
  });

  it("503: a warning banner with the message and no action; loading: card skeletons", () => {
    const root = render(<SummarySection state={{ loading: false, result: { ok: false, error: DB_ERROR } }} onRetry={jest.fn()} />);
    const [banner] = all(root, "Banner");
    expect(banner.props).toMatchObject({ tone: "warning", message: CUSTOMER_DETAIL_DB_MESSAGE });
    expect(banner.props.onAction).toBeUndefined();
    expect(all(render(<SummarySection state={{ loading: true, result: null }} onRetry={jest.fn()} />), "KpiSkeleton")).toHaveLength(1);
    const failed = all(render(<SummarySection state={{ loading: false, result: { ok: false, error: NET_ERROR } }} onRetry={jest.fn()} />), "Banner")[0];
    expect(failed.props).toMatchObject({ tone: "danger", actionLabel: "Try again" });
  });
});

describe("lists and rows", () => {
  it("Show all appears past 10 rows and says when the API's 100-row cap is reached", () => {
    expect(all(render(<ShowAllFooter total={10} expanded={false} onToggle={jest.fn()} />), "Button")).toHaveLength(0);
    expect(all(render(<ShowAllFooter total={12} expanded={false} onToggle={jest.fn()} />), "Button")[0].props.title).toBe("Show all 12");
    expect(all(render(<ShowAllFooter total={12} expanded onToggle={jest.fn()} />), "Button")[0].props.title).toBe("Show fewer");
    expect(all(render(<ShowAllFooter total={100} expanded={false} onToggle={jest.fn()} />), "AppText")).toHaveLength(1);
  });

  it("a booking row speaks its status and that it is running, and opens the booking", () => {
    const open = jest.fn();
    const booking = normalizeCustomerBooking({ bookingId: 560, bookingStatusLabel: "Confirmed", spaceName: "PR-07", locationName: "Blue Area", isActive: true });
    const [row] = all(render(<BookingRow booking={booking} onPress={open} />), "ListRow");
    expect(row.props.title).toBe("PR-07");
    expect(row.props.accessibilityLabel).toContain("Confirmed");
    expect(row.props.accessibilityLabel).toContain("running");
    row.props.onPress();
    expect(open).toHaveBeenCalled();
  });

  it("timeline: agreement events open the agreement, receipts open nothing", () => {
    const onOpen = jest.fn();
    const signed = normalizeTimelineEvent({ kind: "agreement", action: "Signed", title: "Agreement signed", refId: 12, eventDate: "2026-09-28" });
    const [row] = all(render(<TimelineRow event={signed} onOpen={onOpen} />), "ListRow");
    expect(row.props.leftIconTone).toBe("success");
    row.props.onPress();
    expect(onOpen).toHaveBeenCalledWith({ kind: "agreement", agreementId: 12 }, signed);

    const receipt = normalizeTimelineEvent({ kind: "receipt", action: "Recorded", title: "Receipt recorded", refId: 9, amount: 5000 });
    const [plain] = all(render(<TimelineRow event={receipt} onOpen={onOpen} />), "ListRow");
    expect(plain.props.onPress).toBeUndefined();
    expect(plain.props.meta).toBe("PKR 5,000");
  });
});
