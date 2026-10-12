import type { NavigatorScreenParams } from "@react-navigation/native";
import type { InquiryFilter } from "../screens/App/Sales/TourInquiriesScreen";
import type { QuotationFromInquiry } from "../screens/App/Sales/SaleQuotationCreateScreen";

// Route types for the staff apps (sales executive, admin, super admin). The customer app's routes live in
// ./types.ts. Each staff role gets its own navigator (see ./staff/StaffNavigator.tsx), built from one shared
// route table; ./staff/access.ts says which role may open which route (mirrors the web CMS).

/** Bottom tabs. Which of them a role gets is in STAFF_TABS (./staff/access.ts). */
export type StaffTabParamList = {
  Dashboard: undefined;
  Inquiries: { filter?: InquiryFilter } | undefined;
  Quotations: undefined;
  Customers: undefined;
  /** Admin / super admin: capacity requests (sales executives asking to add people to full rooms). */
  Approvals: undefined;
  Bookings: undefined;
  More: undefined;
};

export type StaffTabName = keyof StaffTabParamList;

/** Screens pushed over the tabs. */
export type StaffStackParamList = {
  StaffTabs: NavigatorScreenParams<StaffTabParamList> | undefined;

  // ── Kept under the names the existing Sales/Admin screens navigate to ──────────────────────────────
  CustomerList: undefined;
  CustomerCreate: undefined;
  QuotationList: undefined;
  /**
   * New quotation. `editQuotationId` is passed by the quotation list's "Edit" action, but the current create
   * screen ignores it (stage 2: open the quotation as a new version / edit the draft version instead).
   */
  QuotationCreate: { fromInquiry?: QuotationFromInquiry; editQuotationId?: string } | undefined;
  /** Customer-facing quotation screen, still used for staff until the staff quotation detail exists. */
  Quotation: { quotationId: string };
  BookingList: undefined;
  BookingCreate: undefined;
  TourInquiries: { filter?: InquiryFilter } | undefined;
  KycDocuments: { customerId: number | string; customerName?: string };

  // ── Staff screens ───────────────────────────────────────────────────────────────────────────────────
  CustomerDetail: { customerId: number | string };
  CustomerEdit: { customerId: number | string };
  QuotationDetail: { quotationId: number | string };
  BookingDetail: { bookingId: number | string };
  AgreementList: { status?: string } | undefined;
  InvoiceList: undefined;
  InvoiceDetail: { invoiceId: number | string };
  KycList: undefined;
  /** Attendants & Access. Opened for a customer, or straight on one booked space (booking detail id). */
  Attendants: { customerId?: number; bookingDetailId?: number } | undefined;
  /** Capacity requests (admin approvals); also the Approvals tab. */
  CapacityRequests: { status?: string } | undefined;
  Complaints: undefined;
  /** Admin / super admin: door access activity log. */
  AccessActivity: undefined;
  /** Admin / super admin, read-only. */
  Users: undefined;
  Locations: undefined;
  Spaces: { locationId?: number } | undefined;
  /** Super admin: find a booking's challan and extend its validity. */
  ChallanValidity: undefined;
  StaffNotifications: undefined;
  StaffProfile: undefined;
};

export type StaffRouteName = Exclude<keyof StaffStackParamList, "StaffTabs">;
