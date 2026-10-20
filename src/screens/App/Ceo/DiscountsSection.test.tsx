/**
 * The CEO dashboard's Discounts section: loading / error / "not available yet" (only the server's message) / empty /
 * report states, the KPI tiles, the breakdowns by location / salesperson / shift, the biggest discounts, the records
 * sheet a tile, bar or row opens (GET api/ceo/discounts/records/{kind}) and the quiet reload after the dashboard's.
 * React Native primitives, the UI kit, charts and the CEO building blocks are mocked so this runs in plain Node; the
 * services are the real, pure ones over a mocked transport.
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
jest.mock("../../../components/charts", () => ({ HBarList: "HBarList" }));
jest.mock("../../../components/ui", () => {
  const R = jest.requireActual("react");
  return {
    BottomSheet: ({ children, ...props }: any) => R.createElement("BottomSheet", props, props.visible ? children : null),
    Card: "Card",
    Divider: "Divider",
    EmptyState: "EmptyState",
    ListRow: "ListRow",
    ListSkeleton: "ListSkeleton",
    StatusPill: "StatusPill",
  };
});
jest.mock("../../../theme", () => ({ spacing: jest.requireActual("../../../theme/tokens").spacing }));
const mockQuiet = jest.fn();
jest.mock("./parts", () => {
  const R = jest.requireActual("react");
  return {
    CeoErrorState: "CeoErrorState",
    CeoSection: ({ children, ...props }: any) => R.createElement("CeoSection", props, props.loading ? null : children),
    ChartCard: ({ children, ...props }: any) => R.createElement("ChartCard", props, children),
    ChartGrid: ({ children }: any) => R.createElement("ChartGrid", null, children),
    InlineEmpty: "InlineEmpty",
    SectionEmpty: "SectionEmpty",
    StaleBanner: "StaleBanner",
    // A small stand-in for the real hook: loads on mount and whenever `load` changes.
    useCeoQuery: (load: () => Promise<unknown>) => {
      const [s, set] = R.useState({ data: null, error: null, loading: true, refreshing: false, loadedAt: null });
      R.useEffect(() => {
        let alive = true;
        load().then(
          (data: unknown) => alive && set({ data, error: null, loading: false, refreshing: false, loadedAt: Date.now() }),
          (error: unknown) => alive && set((p: any) => ({ ...p, error, loading: false })),
        );
        return () => {
          alive = false;
        };
      }, [load]);
      return { ...s, reload: jest.fn(), refresh: jest.fn(), quietRefresh: mockQuiet };
    },
  };
});
jest.mock("../Staff/Dashboard/parts", () => ({ KpiGrid: "KpiGrid" }));

import { ApiError, apiRequest } from "../../../services/apiClient";
import { discountsErrorView } from "../../../services/ceo/discounts";
import { BIGGEST_SHOWN, DiscountsBlock } from "./DiscountsSection";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const api = apiRequest as jest.Mock;

const booking = (bookingId: number, customer: string, discountMonthly: number, over: Record<string, unknown> = {}) => ({
  bookingId,
  customer,
  room: `Office ${bookingId}`,
  locationId: 1,
  location: "I-8",
  shift: "24/7",
  seats: 3,
  expectedMonthly: 105000,
  rentMonthly: 105000 - discountMonthly,
  soldMonthly: 105000 - discountMonthly,
  belowPriceMonthly: discountMonthly,
  fixedMonthly: 0,
  discountMonthly,
  discountPct: Math.round((discountMonthly * 1000) / 105000) / 10,
  baseMonthly: 105000,
  sellerId: 2,
  seller: "Luqman Ahmad",
  sellerRole: "Super Admin",
  ...over,
});

const BIGGEST = [1, 2, 3, 4, 5, 6].map((i) => booking(500 + i, `Customer ${i}`, 7000 - i * 1000));

const ANSWER = {
  available: true,
  period: "month",
  periodLabel: "October 2026",
  summary: {
    bookings: 15, priced: 15, discounted: 6, expectedMonthly: 2345000, baseMonthly: 2345000, soldMonthly: 2324000, discountMonthly: 21000,
    discountPct: 0.9, averageDiscountPct: 3.3, belowPriceMonthly: 20000, belowPriceBookings: 5, fixedMonthly: 1000, fixedBookings: 1,
    newBookings: 11, newDiscounted: 2, newDiscountMonthly: 11000, invoiceDiscount: 482491.95, invoicesDiscounted: 16, invoiceDiscountPaid: 212741.94,
  },
  byLocation: [
    { key: "1", name: "I-8", bookings: 12, discounted: 5, baseMonthly: 2000000, discountMonthly: 20000, discountPct: 1 },
    { key: "2", name: "F-11", bookings: 3, discounted: 1, baseMonthly: 345000, discountMonthly: 1000, discountPct: 0.3 },
  ],
  bySeller: [
    { key: "2", name: "Luqman Ahmad", role: "Super Admin", bookings: 4, discounted: 4, baseMonthly: 420000, discountMonthly: 15000, discountPct: 3.6 },
    { key: null, name: "No salesperson recorded", bookings: 2, discounted: 2, baseMonthly: 210000, discountMonthly: 6000, discountPct: 2.9 },
  ],
  byShift: [{ key: "24/7", name: "24/7", bookings: 15, discounted: 6, discountMonthly: 21000, baseMonthly: 2345000 }],
  biggest: BIGGEST,
};

const ok = (data: unknown) => ({ isSuccessful: true, data });

let renderer: TestRenderer.ReactTestRenderer | undefined;
async function render(element: React.ReactElement): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  await flush();
  return renderer!.root;
}
const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

const byType = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
const section = (root: ReactTestInstance) => byType(root, "CeoSection")[0];
const sheet = (root: ReactTestInstance) => byType(root, "BottomSheet")[0];
const bars = (root: ReactTestInstance, title: string) => byType(root, "ChartCard").find((c) => c.props.title === title)!.findByType("HBarList" as any);
const lastPath = () => api.mock.calls[api.mock.calls.length - 1][0];

beforeEach(() => {
  api.mockReset();
  mockQuiet.mockReset();
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

describe("DiscountsBlock states", () => {
  test("heading, the pricing note and skeletons while loading", async () => {
    api.mockReturnValueOnce(new Promise(() => undefined));
    let root!: ReactTestInstance;
    await act(async () => {
      renderer = TestRenderer.create(<DiscountsBlock scope={{ period: "month" }} />);
    });
    root = renderer!.root;
    expect(section(root).props).toMatchObject({
      title: "Discounts",
      subtitle: "Rooms sold below their price this month",
      note: "24/7 is compared with the room price, Morning and Evening with the shift price",
      loading: true,
    });
    expect(lastPath()).toBe("/ceo/discounts?period=month");
  });

  test("before the database update only the server's message shows", async () => {
    const message = "Database update needed: run the script DD_01_ceo_discounts_TEST (DD_01_ceo_discounts_LIVE on the live database) to see the discounts.";
    api.mockResolvedValueOnce(ok({ available: false, message }));
    const root = await render(<DiscountsBlock scope={{ period: "month" }} />);
    expect(section(root).props.note).toBeUndefined();
    expect(byType(root, "SectionEmpty")[0].props).toMatchObject({ title: "Not available yet", message });
    expect(byType(root, "KpiGrid")).toHaveLength(0);
  });

  test("an error stays in the section and names the database update", async () => {
    api.mockRejectedValueOnce(new ApiError("Database update needed: run the script DD_01_ceo_discounts_TEST to see the discounts.", 503));
    const root = await render(<DiscountsBlock scope={{ period: "quarter", locationId: 2 }} />);
    expect(lastPath()).toBe("/ceo/discounts?period=quarter&locationId=2");
    const err = byType(root, "CeoErrorState")[0];
    expect(err.props.describe).toBe(discountsErrorView);
    expect(discountsErrorView(err.props.error).message).toContain("DD_01_ceo_discounts_TEST");
  });

  test("no bookings: an empty state", async () => {
    api.mockResolvedValueOnce(ok({ available: true, summary: { bookings: 0 } }));
    const root = await render(<DiscountsBlock scope={{ period: "year" }} />);
    expect(byType(root, "SectionEmpty")[0].props.title).toBe("No bookings this year");
  });
});

describe("DiscountsBlock figures", () => {
  test("KPI tiles, breakdowns and the biggest discounts", async () => {
    api.mockResolvedValueOnce(ok(ANSWER));
    const root = await render(<DiscountsBlock scope={{ period: "month" }} />);
    const tiles = byType(root, "KpiGrid")[0].props.tiles;
    expect(tiles.map((t: any) => [t.label, t.value, t.sub])).toEqual([
      ["Discount a month", "PKR 21K", "0.9% of the expected rent"],
      ["Bookings discounted", "6 of 15", "3.3% off on average"],
      ["New deals discounted", "2 of 11", "PKR 11K a month off"],
      ["Discount on invoices", "PKR 482.5K", "16 invoices, PKR 212.7K on paid"],
    ]);
    expect(tiles[0].tone).toBe("danger");

    const loc = bars(root, "By location");
    expect(loc.props.items.map((i: any) => [i.label, i.valueLabel, i.detail])).toEqual([
      ["I-8", "PKR 20K", "5 of 12 discounted · 1%"],
      ["F-11", "PKR 1K", "1 of 3 discounted · 0.3%"],
    ]);
    expect(bars(root, "By salesperson").props.items.map((i: any) => i.label)).toEqual(["Luqman Ahmad (Super Admin)", "No salesperson recorded"]);
    expect(bars(root, "By shift").props.items.map((i: any) => i.label)).toEqual(["24/7", "Morning", "Evening"]);

    const biggest = byType(root, "ChartCard").find((c) => c.props.title === "Biggest discounts")!;
    const rows = biggest.findAll((n) => typeof n.type === "function" && (n.type as { name?: string }).name === "BookingRow");
    expect(rows).toHaveLength(BIGGEST_SHOWN);
    expect(rows[0].props.booking.customer).toBe("Customer 1");
    const first = rows[0].findByType("ListRow" as any);
    expect(first.props.meta).toBe("PKR 6K · 5.7%");
    expect(first.props.subtitle).toBe("Office 501 · 24/7 · 3 seats · I-8\nExpected PKR 105K, sold PKR 99K · Sold by Luqman Ahmad (Super Admin)");
    // More discounted bookings than shown: a row for all of them.
    expect(biggest.findAllByType("ListRow" as any).some((r) => r.props.title === "All 6 discounted bookings")).toBe(true);
  });

  test("a location opens its discounted bookings in the sheet", async () => {
    api.mockResolvedValueOnce(ok(ANSWER));
    const root = await render(<DiscountsBlock scope={{ period: "custom", range: { from: "2026-10-01", to: "2026-10-15" } }} />);
    expect(sheet(root).props.visible).toBe(false);
    api.mockResolvedValueOnce(ok({ title: "Discounted bookings: F-11, running between 1 Oct 2026 and 15 Oct 2026", total: 1, discountTotal: 1000, baseTotal: 70000, discountPct: 1.4, rows: [booking(542, "Beta", 1000, { location: "F-11", locationId: 2 })] }));
    await act(async () => bars(root, "By location").props.onPressItem({}, 1));
    await flush();
    expect(lastPath()).toBe("/ceo/discounts/records/bookings?period=custom&periodFrom=2026-10-01&periodTo=2026-10-15&locationId=2");
    const s = sheet(root);
    expect(s.props.visible).toBe(true);
    expect(s.props.title).toBe("Discounted bookings: F-11, running between 1 Oct 2026 and 15 Oct 2026");
    expect(s.props.subtitle).toBe("1 booking · PKR 1,000 a month off PKR 70,000 expected (1.4%)");
    expect(s.findAllByType("ListRow" as any).map((r) => r.props.title)).toEqual(["Beta"]);
    await act(async () => s.props.onClose());
    expect(sheet(root).props.visible).toBe(false);
  });

  test("no salesperson and the invoices open their own lists; a big discount is marked in its location's list", async () => {
    api.mockResolvedValueOnce(ok(ANSWER));
    const root = await render(<DiscountsBlock scope={{ period: "month", locationId: 1 }} />);

    api.mockResolvedValueOnce(ok({ rows: [], total: 0 }));
    await act(async () => bars(root, "By salesperson").props.onPressItem({}, 1));
    await flush();
    expect(lastPath()).toBe("/ceo/discounts/records/bookings?period=month&locationId=1&sellerId=none");
    expect(sheet(root).findAllByType("EmptyState" as any)).toHaveLength(1);

    api.mockResolvedValueOnce(ok({ rows: [{ invoiceId: 395, invoiceNumber: "INV-2026-00395", customer: "Beta", issuedOn: "2026-10-07", subTotal: 252428.57, discount: 3000, total: 386348.57, status: "Paid", paid: true }], total: 1, discountTotal: 3000, baseTotal: 252428.57, discountPct: 1.2 }));
    await act(async () => byType(root, "KpiGrid")[0].props.tiles[3].onPress());
    await flush();
    expect(lastPath()).toBe("/ceo/discounts/records/invoices?period=month&locationId=1");
    const inv = sheet(root).findAllByType("ListRow" as any)[0];
    expect(inv.props).toMatchObject({ title: "INV-2026-00395 · Beta", meta: "PKR 3K off" });
    expect(inv.props.right.props).toMatchObject({ label: "Paid", tone: "success" });

    api.mockResolvedValueOnce(ok({ rows: [BIGGEST[0], BIGGEST[1]], total: 2 }));
    const biggest = byType(root, "ChartCard").find((c) => c.props.title === "Biggest discounts")!;
    await act(async () => biggest.findAllByType("ListRow" as any)[1].props.onPress());
    await flush();
    const marked = sheet(root).findAllByType("ListRow" as any);
    expect(marked[0].props.right).toBeUndefined();
    expect(marked[1].props.right.props.label).toBe("Selected");
  });

  test("nothing discounted: Discount a month and a 0-discounted row still open their bookings (all of them)", async () => {
    const none = { ...ANSWER, summary: { ...ANSWER.summary, discountMonthly: 0, discounted: 0, discountPct: 0 }, byLocation: [{ key: "1", name: "I-8", bookings: 4, discounted: 0 }] };
    api.mockResolvedValueOnce(ok(none));
    const root = await render(<DiscountsBlock scope={{ period: "month" }} />);
    const tile = byType(root, "KpiGrid")[0].props.tiles[0];
    expect(tile.accessibilityHint).toBe("Opens the bookings");
    api.mockResolvedValueOnce(ok({ rows: [], total: 0 }));
    await act(async () => tile.onPress());
    await flush();
    expect(lastPath()).toBe("/ceo/discounts/records/bookings?period=month&all=true");
    api.mockResolvedValueOnce(ok({ rows: [], total: 0 }));
    await act(async () => bars(root, "By location").props.onPressItem({}, 0));
    await flush();
    expect(lastPath()).toBe("/ceo/discounts/records/bookings?period=month&locationId=1&all=true");
  });

  test("the dashboard's reload reloads the section quietly, not right after its own answer", async () => {
    api.mockResolvedValue(ok(ANSWER));
    const scope = { period: "month" as const };
    const root = await render(<DiscountsBlock scope={scope} reloadKey={1} />);
    expect(root).toBeTruthy();
    await act(async () => renderer!.update(<DiscountsBlock scope={scope} reloadKey={2} />));
    expect(mockQuiet).not.toHaveBeenCalled();   // the section loaded a moment ago
    const now = Date.now();
    const spy = jest.spyOn(Date, "now").mockReturnValue(now + 60_000);
    await act(async () => renderer!.update(<DiscountsBlock scope={scope} reloadKey={3} />));
    expect(mockQuiet).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
