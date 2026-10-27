import type { NavigatorScreenParams } from "@react-navigation/native";
import type { OverviewDetailRequest, OverviewDetailScope, StaffAgreement, StaffCustomer, StaffInvoice } from "../services/staff";
import type { WaConversation } from "../services/staff/whatsappInbox";
import type { StaffUser } from "../services/staff/users";

// Route types for the staff apps (sales executive, admin, super admin). The customer app's routes live in
// ./types.ts. Each staff role gets its own navigator (see ./staff/StaffNavigator.tsx), built from one shared
// route table; ./staff/access.ts says which role may open which route (mirrors the web CMS).

/** Tour-inquiry list filter. */
export type InquiryFilter = "all" | "new" | "due";

/** Tour-inquiry list params: the filter and the sub-tab ("general" = Simple inquiries; default tour). */
export type InquiryListParams = { filter?: InquiryFilter; category?: "tour" | "general" };

/** A tour inquiry being turned into a quotation (prefills the customer search; feedback "converted" after saving). */
export type InquiryPrefill = {
  inquiryId: number | null;
  publicId: string | null;
  /** Which table the inquiry is in (an old website booking and a newer inquiry can have the same id). */
  source?: "contact" | "booktour" | null;
  name: string;
  email: string;
  phone: string;
};

/** Bottom tabs. Which of them a role gets is in STAFF_TABS (./staff/access.ts). */
export type StaffTabParamList = {
  Dashboard: undefined;
  Inquiries: InquiryListParams | undefined;
  Quotations: undefined;
  Customers: undefined;
  /** Admin / super admin: capacity requests (sales executives asking to add people to full rooms). */
  Approvals: undefined;
  Bookings: undefined;
  More: undefined;
};

export type StaffTabName = keyof StaffTabParamList;

/** Screens pushed over the tabs. Ids are the API's int ids unless noted. */
export type StaffStackParamList = {
  StaffTabs: NavigatorScreenParams<StaffTabParamList> | undefined;

  QuotationList: undefined;
  QuotationDetail: { quotationId: number };
  /**
   * New quotation. `editFromId`: "edit" = a new quotation prefilled from that one (the API cannot change a
   * quotation's values; the new one replaces the active quotation for the same customer and space).
   */
  QuotationForm: { editFromId?: number; customerId?: number; fromInquiry?: InquiryPrefill } | undefined;

  /**
   * Customer by int id or GUID. `customer`: the list row it was opened from (it carries the NTN / SECP number,
   * which GET customer/{id} may not).
   */
  CustomerDetail: { customerId: number | string; customer?: StaffCustomer };
  /**
   * Create (no id) or edit (`customer`: the customer as last shown, for its NTN / SECP number). `returnTo`: after
   * creating, go back to that form with the new customer picked.
   */
  CustomerForm: { customerId?: number | string; customer?: StaffCustomer; returnTo?: "QuotationForm" | "BookingForm" } | undefined;

  KycList: undefined;
  KycCustomer: { customerId: number | string; customerName?: string };

  BookingList: undefined;
  /**
   * `offerInitialInvoice`: open "Send initial invoice" straight away (after the booking was created, or an agreement
   * was signed: then `issuedOn` is the signed date, yyyy-MM-dd, which the first invoice is dated on).
   */
  BookingDetail: { bookingId: number; offerInitialInvoice?: { issuedOn?: string | null } };
  BookingForm: { customerId?: number } | undefined;

  TourInquiries: InquiryListParams | undefined;

  AgreementList: { status?: string } | undefined;
  /** The API has no GET agreement/{id}: the list row is passed in. */
  AgreementDetail: { agreement: StaffAgreement };
  /** Send the lease agreement for an accepted quotation. */
  AgreementSend: { quotationId: number };

  InvoiceList: undefined;
  /** `invoice`: the list row (status label and balance carry over into the detail, as in the CMS). */
  InvoiceDetail: { invoiceId: number; invoice?: StaffInvoice };

  /** Attendants & Access: pick a customer (or open one), then a booked space. */
  Attendants: { customerId?: number } | undefined;
  /** People, door access and capacity of one booked space (booking detail). */
  RoomAccess: { bookingDetailId: number; customerId: number; spaceName?: string };
  /** Capacity requests (admin approvals); also the Approvals tab. */
  CapacityRequests: undefined;

  Complaints: undefined;
  /** WhatsApp Inbox (read only): conversations with the WorkNest WhatsApp number. */
  WhatsAppInbox: undefined;
  /** One WhatsApp conversation's messages. The API has no GET conversation/{id}: the list row is passed in. */
  WhatsAppConversation: { conversation: WaConversation };
  /** Admin / super admin: door access activity log. */
  AccessActivity: undefined;
  /** Admin / super admin, read-only. */
  Users: undefined;
  /** Admin / super admin: new user (no `user`) or edit that user (the list row: the API has no fuller GET). */
  UserForm: { user?: StaffUser } | undefined;
  Locations: undefined;
  Spaces: { locationId?: number } | undefined;
  /** Super admin: find a booking's challan and extend its validity. */
  ChallanValidity: undefined;
  StaffNotifications: undefined;
  StaffProfile: undefined;
  /** Admin / super admin (the CMS Payments page), read-only. */
  PaymentList: undefined;
  /**
   * Dashboard chart drill-down (GET dashboard/overview-details/{kind}): the records behind one bar / slice / point.
   * `scope`: the dashboard's period and locations. `trail`: chart > element. `related`: opened from another list's
   * link (offers no further link).
   */
  DashboardDetails: {
    request: OverviewDetailRequest;
    scope: OverviewDetailScope;
    trail: string[];
    scopeLabel?: string;
    title?: string;
    related?: boolean;
  };
};

export type StaffRouteName = Exclude<keyof StaffStackParamList, "StaffTabs">;
