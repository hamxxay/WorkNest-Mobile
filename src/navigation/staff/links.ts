// Deep links and tapped push notifications for the staff apps: which staff screen a link path opens.
// Pure (no React Native imports), unit-tested in links.test.ts; StaffNavigator wires it into its linking config.
//
// Accepts the customer app's link paths (a push is turned into one by services/notificationService
// notificationLink: quotation/{id}, bookings, payments, agreements, notifications, ...), the staff screens' own
// paths (customer/{id}, booking/{id}, invoice/{id}, inquiries, kyc, complaints, approvals, ...) and the CMS's
// /admin/... paths. A screen the role may not open, or an unknown path, gives no state: the app just opens.
// Every pushed screen is opened on top of the tabs, so back returns to the role's dashboard.

import type { NavigationState, PartialState } from "@react-navigation/native";
import type { StaffRole } from "../../context/roles";
import type { StaffRouteName, StaffStackParamList, StaffTabName, StaffTabParamList } from "../staffTypes";
import { canOpenRoute, tabsFor } from "./access";
import { APP_LINK_PREFIXES } from "../appLinks";

export type StaffLinkTarget =
  | { kind: "tab"; tab: StaffTabName; params?: StaffTabParamList[StaffTabName] }
  | { kind: "screen"; route: StaffRouteName; params?: StaffStackParamList[StaffRouteName] };

/** A positive int id from a path segment, else null (quotation numbers like QUO-1001 are not ids). */
function intId(segment: string | undefined): number | null {
  if (!segment || !/^\d+$/.test(segment)) return null;
  const n = Number(segment);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Path segments without prefix slashes, query or hash; the CMS "admin/" segment dropped. */
export function linkSegments(path: string): string[] {
  const clean = (path ?? "").split(/[?#]/)[0];
  const segments = clean.split("/").filter(Boolean).map(decode);
  return segments[0]?.toLowerCase() === "admin" ? segments.slice(1) : segments;
}

/** A query parameter of a link path (the first one with that name), or null. */
function queryParam(path: string, name: string): string | null {
  const query = (path ?? "").split("#")[0].split("?")[1];
  if (!query) return null;
  for (const pair of query.split("&")) {
    const [k, v = ""] = pair.split("=");
    if (decode(k) === name) return decode(v.replace(/\+/g, " "));
  }
  return null;
}

/** The staff screen a link path opens for this role, or null when it opens none. */
export function staffLinkTarget(path: string, role: StaffRole): StaffLinkTarget | null {
  const [head = "", second] = linkSegments(path);
  const key = head.toLowerCase();
  const id = intId(second);

  const tabs = tabsFor(role);
  const tab = (name: StaffTabName): StaffLinkTarget | null => (tabs.includes(name) ? { kind: "tab", tab: name } : null);
  const screen = <R extends StaffRouteName>(route: R, params?: StaffStackParamList[R]): StaffLinkTarget | null =>
    canOpenRoute(role, route) ? { kind: "screen", route, params } : null;
  /** The role's tab when it has one, otherwise the same list as a pushed screen. */
  const tabOr = (name: StaffTabName, route: StaffRouteName) => tab(name) ?? screen(route);

  switch (key) {
    case "":
    case "home":
    case "dashboard":
      return tab("Dashboard");
    case "notifications":
    case "announcements":
      return screen("StaffNotifications");
    case "quotation":
    case "quotations":
      return id ? screen("QuotationDetail", { quotationId: id }) : tabOr("Quotations", "QuotationList");
    case "booking":
    case "bookings":
    case "my-bookings":
      return id ? screen("BookingDetail", { bookingId: id }) : tabOr("Bookings", "BookingList");
    case "invoice":
    case "invoices":
      return id ? screen("InvoiceDetail", { invoiceId: id }) : screen("InvoiceList");
    case "payments":
    case "payment":
      // The Payments list for the roles that may open it (CMS /admin/payments: admins, super admins); others
      // (sales executives) keep the invoices, where they record and follow payments.
      return screen("PaymentList") ?? screen("InvoiceList");
    case "my-payments":
    case "challan":
      return screen("InvoiceList");
    case "agreement":
    case "agreements":
    case "my-agreements":
      return screen("AgreementList");
    case "customer":
    case "customers":
      return id ? screen("CustomerDetail", { customerId: id }) : tab("Customers");
    case "kyc":
      return id ? screen("KycCustomer", { customerId: id }) : screen("KycList");
    case "inquiries":
    case "inquiry":
    case "contacts":
    case "tour-inquiries":
    case "simple-inquiries": {
      // The Simple inquiries sub-tab: simple-inquiries, or ?category=general (the CMS's /admin/contacts?category=general).
      const general = key === "simple-inquiries" || queryParam(path, "category")?.toLowerCase() === "general";
      if (!general) return tabOr("Inquiries", "TourInquiries");
      const params = { category: "general" as const };
      return tabs.includes("Inquiries") ? { kind: "tab", tab: "Inquiries", params } : screen("TourInquiries", params);
    }
    case "complaints":
    case "complaint":
      return screen("Complaints");
    case "whatsapp":
    case "whatsapp-inbox":
      return screen("WhatsAppInbox");
    case "approvals":
    case "capacity-requests":
      return tabOr("Approvals", "CapacityRequests");
    case "attendants":
      return screen("Attendants");
    case "access-activity":
    case "access-dashboard":
      return screen("AccessActivity");
    case "challan-validity":
      return screen("ChallanValidity");
    case "profile":
      return screen("StaffProfile");
    default:
      return null;
  }
}

/**
 * Navigation state for a link path: the tabs (on the linked tab), or the tabs with the linked screen on top so
 * back returns to them. Undefined when the path opens nothing for this role.
 */
export function staffStateFromPath(path: string, role: StaffRole): PartialState<NavigationState> | undefined {
  const target = staffLinkTarget(path, role);
  if (!target) return undefined;
  if (target.kind === "tab") {
    const route = target.params ? { name: target.tab, params: target.params } : { name: target.tab };
    return { routes: [{ name: "StaffTabs", state: { routes: [route] } }] };
  }
  return {
    index: 1,
    routes: [{ name: "StaffTabs" }, target.params ? { name: target.route, params: target.params } : { name: target.route }],
  };
}

/** Link prefixes (the same as the customer app's: only one of the two navigators is mounted at a time). */
export const STAFF_LINK_PREFIXES = APP_LINK_PREFIXES;
