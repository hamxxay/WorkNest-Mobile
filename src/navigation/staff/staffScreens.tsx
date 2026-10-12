import type { ComponentType } from "react";
import type { StaffRole } from "../../context/roles";
import type { StaffRouteName, StaffTabName } from "../staffTypes";

import SaleDashboard from "../../screens/App/Sales/SaleDashboard";
import AdminDashboard from "../../screens/App/Admin/AdminDashboard";
import CustomerCreateScreen from "../../screens/App/Sales/CustomerCreateScreen";
import CustomerListScreen from "../../screens/App/Sales/CustomerListScreen";
import KycDocumentsScreen from "../../screens/App/Sales/KycDocumentsScreen";
import SaleBookingCreateScreen from "../../screens/App/Sales/SaleBookingCreateScreen";
import SaleBookingListScreen from "../../screens/App/Sales/SaleBookingListScreen";
import SaleQuotationCreateScreen from "../../screens/App/Sales/SaleQuotationCreateScreen";
import SaleQuotationListScreen from "../../screens/App/Sales/SaleQuotationListScreen";
import TourInquiriesScreen from "../../screens/App/Sales/TourInquiriesScreen";
import QuotationScreen from "../../screens/App/General/QuotationScreen";
import StaffMoreScreen from "../../screens/App/Staff/StaffMoreScreen";
import StaffPlaceholderScreen from "../../screens/App/Staff/StaffPlaceholderScreen";
import StaffProfileScreen from "../../screens/App/Staff/StaffProfileScreen";

// Route name -> screen for the staff navigators. Screens that exist today are wired in; the rest show a
// placeholder until stage 2 builds them with the UI kit.
//
// `ownHeader`: the screen draws its own header (the existing Sales / Admin screens). The others get the
// navigator's header with `title`, which also gives them a back button.

export type StaffScreenDef = {
  title: string;
  component: ComponentType<any>;
  ownHeader?: boolean;
};

export const STAFF_SCREENS: Record<StaffRouteName, StaffScreenDef> = {
  CustomerList: { title: "Customers", component: CustomerListScreen, ownHeader: true },
  CustomerCreate: { title: "New Customer", component: CustomerCreateScreen, ownHeader: true },
  CustomerDetail: { title: "Customer", component: StaffPlaceholderScreen },
  CustomerEdit: { title: "Edit Customer", component: StaffPlaceholderScreen },
  QuotationList: { title: "Quotations", component: SaleQuotationListScreen, ownHeader: true },
  QuotationCreate: { title: "New Quotation", component: SaleQuotationCreateScreen, ownHeader: true },
  Quotation: { title: "Quotation", component: QuotationScreen, ownHeader: true },
  QuotationDetail: { title: "Quotation", component: StaffPlaceholderScreen },
  BookingList: { title: "Bookings", component: SaleBookingListScreen, ownHeader: true },
  BookingCreate: { title: "New Booking", component: SaleBookingCreateScreen, ownHeader: true },
  BookingDetail: { title: "Booking", component: StaffPlaceholderScreen },
  TourInquiries: { title: "Tour Inquiries", component: TourInquiriesScreen, ownHeader: true },
  KycList: { title: "KYC Portal", component: StaffPlaceholderScreen },
  KycDocuments: { title: "KYC Documents", component: KycDocumentsScreen, ownHeader: true },
  AgreementList: { title: "Agreements", component: StaffPlaceholderScreen },
  InvoiceList: { title: "Invoices & Billing", component: StaffPlaceholderScreen },
  InvoiceDetail: { title: "Invoice", component: StaffPlaceholderScreen },
  Attendants: { title: "Attendants & Access", component: StaffPlaceholderScreen },
  CapacityRequests: { title: "Capacity Requests", component: StaffPlaceholderScreen },
  Complaints: { title: "Complaints", component: StaffPlaceholderScreen },
  AccessActivity: { title: "Access Activity Log", component: StaffPlaceholderScreen },
  Users: { title: "Users", component: StaffPlaceholderScreen },
  Locations: { title: "Locations", component: StaffPlaceholderScreen },
  Spaces: { title: "Spaces", component: StaffPlaceholderScreen },
  ChallanValidity: { title: "Challan Validity", component: StaffPlaceholderScreen },
  StaffNotifications: { title: "Notifications", component: StaffPlaceholderScreen },
  StaffProfile: { title: "Profile", component: StaffProfileScreen },
};

export type StaffTabDef = StaffScreenDef & {
  label: string;
  icon: string;
  activeIcon: string;
};

/** Tab screens. The dashboard differs by role (stage 2: one role dashboard on GET dashboard/role). */
export function staffTabScreen(role: StaffRole, tab: StaffTabName): StaffTabDef {
  switch (tab) {
    case "Dashboard":
      return role === "sales_executive"
        ? { title: "Dashboard", label: "Dashboard", icon: "grid-outline", activeIcon: "grid", component: SaleDashboard, ownHeader: true }
        : { title: "Dashboard", label: "Dashboard", icon: "grid-outline", activeIcon: "grid", component: AdminDashboard, ownHeader: true };
    case "Inquiries":
      return { title: "Tour Inquiries", label: "Inquiries", icon: "walk-outline", activeIcon: "walk", component: TourInquiriesScreen, ownHeader: true };
    case "Quotations":
      return { title: "Quotations", label: "Quotations", icon: "document-text-outline", activeIcon: "document-text", component: SaleQuotationListScreen, ownHeader: true };
    case "Customers":
      return { title: "Customers", label: "Customers", icon: "people-outline", activeIcon: "people", component: CustomerListScreen, ownHeader: true };
    case "Approvals":
      return { title: "Approvals", label: "Approvals", icon: "checkmark-done-circle-outline", activeIcon: "checkmark-done-circle", component: StaffPlaceholderScreen };
    case "Bookings":
      return { title: "Bookings", label: "Bookings", icon: "calendar-outline", activeIcon: "calendar", component: SaleBookingListScreen, ownHeader: true };
    case "More":
      return { title: "More", label: "More", icon: "ellipsis-horizontal-circle-outline", activeIcon: "ellipsis-horizontal-circle", component: StaffMoreScreen };
  }
}
