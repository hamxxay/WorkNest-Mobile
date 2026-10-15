import type { NavigatorScreenParams } from "@react-navigation/native";
import type { Workspace } from "../services/workspaceService";

// ─── Customer app (general role) ──────────────────────────────────────────────
// Root (Splash, Onboarding, AuthStack, AppStack)
//   AppStack (native stack)
//     MainTabs: Home · Bookings · Payments · Agreements · Profile
//     everything else is pushed on AppStack (space detail, booking flow, challan, quotations...)
// Staff routes (sales executive / admin) live in their own navigators and param lists.

export type MainTabParamList = {
  Home: undefined;
  Bookings: { tab?: "upcoming" | "history" } | undefined;
  Payments: undefined;
  Agreements: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  Signup: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  /** A new email account (or one the API says is not verified yet) waits here for the email link. */
  VerifyEmail: VerifyEmailParams;
};

export type VerifyEmailParams = {
  email: string;
  redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any };
};

/** A space card from GET /space/available (one per location + space type). */
export type WorkspaceSummary = Workspace;

/** Space type filter used by the Spaces list. */
export type SpaceTypeFilter = "all" | "office" | "shared" | "meeting";

/** What the customer chose on BookingInfo; BookingConfirm sends it to POST /booking/smart. */
export type BookingDraft = {
  mode: "shared" | "meeting" | "office";
  /** Local date-time, e.g. 2026-10-14T09:00:00. */
  startDateTime: string;
  endDateTime: string;
  /** Readable period, e.g. "14 Oct 2026, 9:00 AM to 11:00 AM" or "1 Nov 2026, 3 months". */
  periodLabel: string;
  months?: number;
  hours?: number;
  capacity?: number;
  notes?: string;
  guest: { name: string; email: string; phone: string };
  /**
   * Listed price per billing period of the space this booking gets, from the availability check on BookingInfo
   * (a private office: the whole office). Missing when the check did not answer: Confirm then shows the card's rate.
   */
  listedPrice?: number;
  /** Billing period of listedPrice (Monthly, Hourly...). */
  priceUnit?: string;
  /** Seats of that space (shown for private offices, which are priced per office). */
  seats?: number;
  /** The customer already has a customer account: name and phone come from it (edited in Profile), not this form. */
  existingCustomer?: boolean;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  /** Browse all spaces (search, type and location filters). */
  Spaces: { initialType?: SpaceTypeFilter; initialSearch?: string } | undefined;
  SpaceDetail: { workspace: WorkspaceSummary };
  /** Pick the period and confirm your details. */
  BookingInfo: { workspace: WorkspaceSummary };
  /** Review and confirm: POST /booking/smart, then the challan to pay. No payment form. */
  BookingConfirm: { workspace: WorkspaceSummary; booking: BookingDraft };
  /** Bank challan of a booking (GET /booking/{id}/challan). */
  /** justBooked: opened right after BookingConfirm created the booking (shows the success check). */
  Challan: { bookingId: number; challanNumber?: string; justBooked?: boolean };
  BookingDetail: { bookingId: number | string };
  /** The employees of a confirmed booking (GET/POST/DELETE /booking/my/{bookingId}/employees). */
  Employees: { bookingId: number; spaceName?: string };
  Quotation: { quotationId: string };
  QuotationList: undefined;
  ESignAgreement: { agreementId: number | string; quotationNumber?: string; customerName?: string };
  Notifications: undefined;
  Gallery: undefined;
  /** Book a Tour form (POST /book-tour, like the website). */
  BookTour: undefined;
  ContactUs: undefined;
  AboutUs: undefined;
  PrivacyPolicy: undefined;
  UserManual: undefined;
  AccessRequest: undefined;
  UnlockDoor: undefined;
  Login: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  Signup: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  VerifyEmail: VerifyEmailParams;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppStack: NavigatorScreenParams<AppStackParamList>;
};
