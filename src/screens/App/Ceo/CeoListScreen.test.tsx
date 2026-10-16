/**
 * CeoListScreen: a list built from the dashboard's figures is shown like a breakdown (same view, no API call), its
 * rows read their figures, and a row opens its breakdown (with the records filters it carries) or its records, with
 * the breadcrumb extended. Navigation and the shared view are mocked.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

const mockPush = jest.fn();
let mockParams: any;
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ push: mockPush }), useRoute: () => ({ params: mockParams }) }));
jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../services/apiClient", () => ({ ApiError: class extends Error {}, apiRequest: jest.fn(), errorMessage: () => "x", serverMessage: () => null }));
jest.mock("./BreakdownView", () => ({ BreakdownView: "BreakdownView" }));

import { revenueTarget, agingTarget, normalizeAging, type CeoDrillList } from "../../../services/ceo";
import CeoListScreen from "./CeoListScreen";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

function view(list: CeoDrillList): ReactTestInstance {
  mockParams = { list, trail: ["Money", "Invoiced this year"], scopeLabel: "2026 · All locations" };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<CeoListScreen />);
  });
  return renderer!.root.findAll((n) => n.type === ("BreakdownView" as unknown))[0];
}

beforeEach(() => mockPush.mockReset());

test("the months of the period: shown like a breakdown; a month opens it by location, Collected then paid invoices", async () => {
  const target = revenueTarget({ months: [{ month: "2026-10", invoiced: 900, collected: 600 }] }, "collected", { period: "year" }, new Date(2026, 9, 16));
  if (target.kind !== "list") throw new Error("expected a list");
  const v = view(target.list);
  expect(v.props).toMatchObject({ fallbackTitle: "Collected by month", trail: ["Money", "Invoiced this year"], rowAccessibilityHint: "Opens this month by location" });
  const loaded = await v.props.load();
  expect(loaded).toMatchObject({ title: "Collected by month", valueLabel: "Collected", value2Label: "Invoiced" });
  const october = loaded.rows[9];
  expect(v.props.rowDetail(loaded, october)).toBe("Collected PKR 600 · Invoiced PKR 900");
  expect(v.props.rowMeta(october)).toBe("PKR 600");
  const step = v.props.recordsFor(october);
  act(() => v.props.onOpenRecords(october, step));
  expect(mockPush).toHaveBeenCalledWith("CeoBreakdown", {
    query: { metric: "revenue", month: "2026-10", period: "year", locationId: null },
    recordsParams: { status: "paid" },
    trail: ["Money", "Invoiced this year", "Oct 2026"],
    scopeLabel: "2026 · All locations",
  });
});

test("a row without a next step is not tappable; a records step opens the records with its title", async () => {
  const target = agingTarget({ aging: normalizeAging([{ bucket: "1_30", amount: 10, count: 1 }]) }, { period: "month" });
  if (target.kind !== "list") throw new Error("expected a list");
  const list: CeoDrillList = {
    ...target.list,
    rows: [
      { ...target.list.rows[0], open: null },
      { ...target.list.rows[1], open: { kind: "records", query: { kind: "invoices", params: { bucket: "1_30" } }, title: "Invoices 1-30 days", keepTitle: true } },
    ],
  };
  const v = view(list);
  const loaded = await v.props.load();
  expect(v.props.recordsFor(loaded.rows[0])).toBeNull();
  act(() => v.props.onOpenRecords(loaded.rows[1], v.props.recordsFor(loaded.rows[1])));
  expect(mockPush).toHaveBeenCalledWith("CeoRecords", {
    query: { kind: "invoices", params: { bucket: "1_30" } },
    title: "Invoices 1-30 days",
    keepTitle: true,
    trail: ["Money", "Invoiced this year", "1-30 days"],
    scopeLabel: "2026 · All locations",
  });
});
