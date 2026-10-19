import type { ComponentType } from "react";
import type { StaffRole } from "../../context/roles";
import type { StaffRouteName, StaffTabName } from "../staffTypes";
import StaffMoreScreen from "../../screens/App/Staff/StaffMoreScreen";
import StaffProfileScreen from "../../screens/App/Staff/Profile/StaffProfileScreen";
import CustomerListScreen from "../../screens/App/Staff/Customers/CustomerListScreen";
import CustomerDetailScreen from "../../screens/App/Staff/Customers/CustomerDetailScreen";
import CustomerFormScreen from "../../screens/App/Staff/Customers/CustomerFormScreen";
import KycListScreen from "../../screens/App/Staff/Kyc/KycListScreen";
import KycCustomerScreen from "../../screens/App/Staff/Kyc/KycCustomerScreen";
import QuotationListScreen from "../../screens/App/Staff/Quotations/QuotationListScreen";
import QuotationDetailScreen from "../../screens/App/Staff/Quotations/QuotationDetailScreen";
import QuotationFormScreen from "../../screens/App/Staff/Quotations/QuotationFormScreen";
import BookingListScreen from "../../screens/App/Staff/Bookings/BookingListScreen";
import BookingDetailScreen from "../../screens/App/Staff/Bookings/BookingDetailScreen";
import BookingFormScreen from "../../screens/App/Staff/Bookings/BookingFormScreen";
import AgreementListScreen from "../../screens/App/Staff/Agreements/AgreementListScreen";
import AgreementDetailScreen from "../../screens/App/Staff/Agreements/AgreementDetailScreen";
import AgreementSendScreen from "../../screens/App/Staff/Agreements/AgreementSendScreen";
import InvoiceListScreen from "../../screens/App/Staff/Invoices/InvoiceListScreen";
import InvoiceDetailScreen from "../../screens/App/Staff/Invoices/InvoiceDetailScreen";
import InquiryListScreen from "../../screens/App/Staff/Inquiries/InquiryListScreen";
import ComplaintListScreen from "../../screens/App/Staff/Complaints/ComplaintListScreen";
import AttendantsScreen from "../../screens/App/Staff/Attendants/AttendantsScreen";
import RoomAccessScreen from "../../screens/App/Staff/Attendants/RoomAccessScreen";
import CapacityRequestsScreen from "../../screens/App/Staff/Approvals/CapacityRequestsScreen";
import AccessActivityScreen from "../../screens/App/Staff/Access/AccessActivityScreen";
import UserListScreen from "../../screens/App/Staff/Directory/UserListScreen";
import UserFormScreen from "../../screens/App/Staff/Directory/UserFormScreen";
import LocationListScreen from "../../screens/App/Staff/Directory/LocationListScreen";
import SpaceListScreen from "../../screens/App/Staff/Directory/SpaceListScreen";
import ChallanValidityScreen from "../../screens/App/Staff/SuperAdmin/ChallanValidityScreen";
import StaffNotificationsScreen from "../../screens/App/Staff/Notifications/StaffNotificationsScreen";
import StaffDashboardScreen from "../../screens/App/Staff/Dashboard/StaffDashboardScreen";
import PaymentListScreen from "../../screens/App/Staff/Payments/PaymentListScreen";
import DashboardDetailsScreen from "../../screens/App/Staff/Dashboard/DashboardDetailsScreen";

// Route name -> screen for the staff navigators. Every staff screen draws its own AppHeader (back button,
// title, actions), so the navigators render no header of their own.

export const STAFF_SCREENS: Record<StaffRouteName, ComponentType<any>> = {
  QuotationList: QuotationListScreen,
  QuotationDetail: QuotationDetailScreen,
  QuotationForm: QuotationFormScreen,
  CustomerDetail: CustomerDetailScreen,
  CustomerForm: CustomerFormScreen,
  KycList: KycListScreen,
  KycCustomer: KycCustomerScreen,
  BookingList: BookingListScreen,
  BookingDetail: BookingDetailScreen,
  BookingForm: BookingFormScreen,
  TourInquiries: InquiryListScreen,
  AgreementList: AgreementListScreen,
  AgreementDetail: AgreementDetailScreen,
  AgreementSend: AgreementSendScreen,
  InvoiceList: InvoiceListScreen,
  InvoiceDetail: InvoiceDetailScreen,
  Attendants: AttendantsScreen,
  RoomAccess: RoomAccessScreen,
  CapacityRequests: CapacityRequestsScreen,
  Complaints: ComplaintListScreen,
  AccessActivity: AccessActivityScreen,
  Users: UserListScreen,
  UserForm: UserFormScreen,
  Locations: LocationListScreen,
  Spaces: SpaceListScreen,
  ChallanValidity: ChallanValidityScreen,
  StaffNotifications: StaffNotificationsScreen,
  StaffProfile: StaffProfileScreen,
  PaymentList: PaymentListScreen,
  DashboardDetails: DashboardDetailsScreen,
};

export type StaffTabDef = {
  label: string;
  icon: string;
  activeIcon: string;
  component: ComponentType<any>;
};

/** Tab screens (the same list screens as the pushed routes; the dashboard adapts to the role). */
export function staffTabScreen(_role: StaffRole, tab: StaffTabName): StaffTabDef {
  switch (tab) {
    case "Dashboard":
      return { label: "Dashboard", icon: "grid-outline", activeIcon: "grid", component: StaffDashboardScreen };
    case "Inquiries":
      return { label: "Inquiries", icon: "walk-outline", activeIcon: "walk", component: STAFF_SCREENS.TourInquiries };
    case "Quotations":
      return { label: "Quotations", icon: "document-text-outline", activeIcon: "document-text", component: STAFF_SCREENS.QuotationList };
    case "Customers":
      return { label: "Customers", icon: "people-outline", activeIcon: "people", component: CustomerListScreen };
    case "Approvals":
      return { label: "Approvals", icon: "checkmark-done-circle-outline", activeIcon: "checkmark-done-circle", component: STAFF_SCREENS.CapacityRequests };
    case "Bookings":
      return { label: "Bookings", icon: "calendar-outline", activeIcon: "calendar", component: STAFF_SCREENS.BookingList };
    case "More":
      return { label: "More", icon: "ellipsis-horizontal-circle-outline", activeIcon: "ellipsis-horizontal-circle", component: StaffMoreScreen };
  }
}
