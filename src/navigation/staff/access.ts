// Which staff role may open which screen, which tabs each role gets and what its "More" menu lists.
// Pure data + helpers (no React), shared by the staff navigators and unit-tested on its own.
//
// Mirrors the web CMS (WorkNest_FE):
//   - guards/admin.guard.ts SALES_EXECUTIVE_ROUTES: what a sales executive may open (dashboard, profile, KYC,
//     quotations, agreements, invoices, bookings, attendants & access, tour inquiries, complaints, ...).
//   - pages/admin/layout/admin-layout.ts: `adminOnly` (Access Dashboard / Activity Log / Analytics: admin and
//     super admin) and `superAdminOnly` (Space Config, Challan Validity) menu items; Users, Locations and
//     Spaces are admin pages (not in the sales executive list).
//   - Capacity requests: a sales executive asks (POST bookings/{id}/capacity-requests) from Attendants & Access;
//     only admins / super admins approve or reject (API [Authorize(Roles = "admin,...,SuperAdmin")]).
// Difference from the CMS: the CMS sales executive has no Customers page (customers are picked / created inside
// the quotation form), but the API lets sales executives list, create and edit customers
// (CustomerController: staff roles), and the mobile plan gives them a Customers tab.

import type { StaffRole } from "../../context/roles";
import type { StaffRouteName, StaffTabName } from "../staffTypes";

const ALL_STAFF: readonly StaffRole[] = ["sales_executive", "admin", "super_admin"];
const ADMIN_UP: readonly StaffRole[] = ["admin", "super_admin"];
const SUPER_ONLY: readonly StaffRole[] = ["super_admin"];

/** Roles allowed on each pushed screen. */
export const STAFF_ROUTE_ROLES: Record<StaffRouteName, readonly StaffRole[]> = {
  CustomerList: ALL_STAFF,
  CustomerCreate: ALL_STAFF,
  CustomerDetail: ALL_STAFF,
  CustomerEdit: ALL_STAFF,
  QuotationList: ALL_STAFF,
  QuotationCreate: ALL_STAFF,
  Quotation: ALL_STAFF,
  QuotationDetail: ALL_STAFF,
  BookingList: ALL_STAFF,
  BookingCreate: ALL_STAFF,
  BookingDetail: ALL_STAFF,
  TourInquiries: ALL_STAFF,
  KycList: ALL_STAFF,
  KycDocuments: ALL_STAFF,
  AgreementList: ALL_STAFF,
  InvoiceList: ALL_STAFF,
  InvoiceDetail: ALL_STAFF,
  Attendants: ALL_STAFF,
  Complaints: ALL_STAFF,
  StaffNotifications: ALL_STAFF,
  StaffProfile: ALL_STAFF,
  CapacityRequests: ADMIN_UP,
  AccessActivity: ADMIN_UP,
  Users: ADMIN_UP,
  Locations: ADMIN_UP,
  Spaces: ADMIN_UP,
  ChallanValidity: SUPER_ONLY,
};

/** Bottom tabs per role, in display order. */
export const STAFF_TABS: Record<StaffRole, readonly StaffTabName[]> = {
  sales_executive: ["Dashboard", "Inquiries", "Quotations", "Customers", "More"],
  admin: ["Dashboard", "Approvals", "Bookings", "Customers", "More"],
  super_admin: ["Dashboard", "Approvals", "Bookings", "Customers", "More"],
};

/** Roles allowed on each tab (a tab is never shown to a role that may not open its screen). */
export const STAFF_TAB_ROLES: Record<StaffTabName, readonly StaffRole[]> = {
  Dashboard: ALL_STAFF,
  Inquiries: ALL_STAFF,
  Quotations: ALL_STAFF,
  Customers: ALL_STAFF,
  Bookings: ALL_STAFF,
  More: ALL_STAFF,
  Approvals: ADMIN_UP,
};

export type StaffMenuItem = { route: StaffRouteName; label: string; icon: string };
export type StaffMenuSection = { title: string; items: StaffMenuItem[] };

const ITEM = {
  quotations: { route: "QuotationList", label: "Quotations", icon: "document-text-outline" },
  inquiries: { route: "TourInquiries", label: "Tour Inquiries", icon: "walk-outline" },
  bookings: { route: "BookingList", label: "Bookings", icon: "calendar-outline" },
  agreements: { route: "AgreementList", label: "Agreements", icon: "document-attach-outline" },
  kyc: { route: "KycList", label: "KYC Portal", icon: "id-card-outline" },
  complaints: { route: "Complaints", label: "Complaints", icon: "chatbox-ellipses-outline" },
  invoices: { route: "InvoiceList", label: "Invoices & Billing", icon: "receipt-outline" },
  challanValidity: { route: "ChallanValidity", label: "Challan Validity", icon: "time-outline" },
  attendants: { route: "Attendants", label: "Attendants & Access", icon: "people-circle-outline" },
  accessActivity: { route: "AccessActivity", label: "Access Activity Log", icon: "pulse-outline" },
  locations: { route: "Locations", label: "Locations", icon: "location-outline" },
  spaces: { route: "Spaces", label: "Spaces", icon: "business-outline" },
  users: { route: "Users", label: "Users", icon: "person-outline" },
  profile: { route: "StaffProfile", label: "Profile", icon: "person-circle-outline" },
} as const satisfies Record<string, StaffMenuItem>;

/** "More" tab per role, grouped like the CMS sidebar (Sales, Finance, Access Control, Spaces, Administration). */
export const STAFF_MORE_MENU: Record<StaffRole, readonly StaffMenuSection[]> = {
  sales_executive: [
    { title: "Sales", items: [ITEM.bookings, ITEM.agreements, ITEM.kyc, ITEM.complaints] },
    { title: "Finance", items: [ITEM.invoices] },
    { title: "Access Control", items: [ITEM.attendants] },
    { title: "Account", items: [ITEM.profile] },
  ],
  admin: [
    { title: "Sales", items: [ITEM.quotations, ITEM.inquiries, ITEM.agreements, ITEM.kyc, ITEM.complaints] },
    { title: "Finance", items: [ITEM.invoices] },
    { title: "Access Control", items: [ITEM.attendants, ITEM.accessActivity] },
    { title: "Spaces", items: [ITEM.locations, ITEM.spaces] },
    { title: "Administration", items: [ITEM.users] },
    { title: "Account", items: [ITEM.profile] },
  ],
  super_admin: [
    { title: "Sales", items: [ITEM.quotations, ITEM.inquiries, ITEM.agreements, ITEM.kyc, ITEM.complaints] },
    { title: "Finance", items: [ITEM.invoices, ITEM.challanValidity] },
    { title: "Access Control", items: [ITEM.attendants, ITEM.accessActivity] },
    { title: "Spaces", items: [ITEM.locations, ITEM.spaces] },
    { title: "Administration", items: [ITEM.users] },
    { title: "Account", items: [ITEM.profile] },
  ],
};

export function canOpenRoute(role: StaffRole, route: StaffRouteName): boolean {
  return STAFF_ROUTE_ROLES[route]?.includes(role) ?? false;
}

export function canOpenTab(role: StaffRole, tab: StaffTabName): boolean {
  return STAFF_TAB_ROLES[tab]?.includes(role) ?? false;
}

/** The role's tabs, never including one it may not open. */
export function tabsFor(role: StaffRole): StaffTabName[] {
  return (STAFF_TABS[role] ?? []).filter((tab) => canOpenTab(role, tab));
}

/** Every pushed screen the role may open (what its navigator registers). */
export function routesFor(role: StaffRole): StaffRouteName[] {
  return (Object.keys(STAFF_ROUTE_ROLES) as StaffRouteName[]).filter((route) => canOpenRoute(role, route));
}

/** The role's "More" menu, with any item it may not open removed (and empty sections dropped). */
export function moreMenuFor(role: StaffRole): StaffMenuSection[] {
  return (STAFF_MORE_MENU[role] ?? [])
    .map((section) => ({ ...section, items: section.items.filter((item) => canOpenRoute(role, item.route)) }))
    .filter((section) => section.items.length > 0);
}
