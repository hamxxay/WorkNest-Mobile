import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Booking:
    | {
        initialRoomType?: "Meeting/Conference" | "Shared Space" | "Office";
        initialLocation?: string;
        initialSearch?: string;
      }
    | undefined;
  MyPayments: undefined;
  Profile: undefined;
};

export type AppDrawerParamList = {
  Workspace: undefined;
};

export type AuthStackParamList = {
  Login: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  Signup: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
};

export type WorkspaceSummary = {
  id: number;
  idGuid?: string;
  name: string;
  type: "Private Office" | "Co-Working Space" | "Meeting Room" | "Event Space";
  location: string;
  capacity: string;
  /** Listed seat price from the API (per priceUnit). Display only: the payable amount comes from the challan. */
  price: number;
  priceUnit?: string;
  categoryCode?: string;
  amenities: string[];
  image: string;
  available: boolean;
};

/** What the customer picked in the booking flow (SpaceDetail -> BookingInfo -> BookingConfirm). */
export type BookingSelection = {
  mode: "shared" | "meeting" | "office";
  dates: string[];
  slot: string;
  month?: string;
};

// Customer app routes. Staff routes (sales executive / admin) live in their own stacks and param lists.
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ContactUs:
    | {
        source?: "tour" | "general";
      }
    | undefined;
  /** Book a Tour: the contact form in tour mode (POST /book-tour, like the website). */
  BookTour: { source?: "tour" } | undefined;
  Gallery: undefined;
  SpaceDetail: { workspace: WorkspaceSummary };
  BookingInfo: {
    workspace: WorkspaceSummary;
    booking: BookingSelection;
  };
  /** Review and confirm a booking: POST /booking/smart, then the challan to pay. No payment form. */
  BookingConfirm: {
    workspace: WorkspaceSummary;
    booking: BookingSelection & {
      guest: {
        name: string;
        email: string;
        phone: string;
      };
    };
  };
  Profile: undefined;
  AccessRequest: undefined;
  UnlockDoor: undefined;
  MyBookings: undefined;
  BookingDetail: { bookingId: number | string };
  PrivacyPolicy: undefined;
  AboutUs: undefined;
  UserManual: undefined;
  /** Bank challan of a booking (GET /booking/{id}/challan). */
  Challan: { bookingId: number; challanNumber?: string };
  Notifications: undefined;
  Quotation: { quotationId: string };
  QuotationList: undefined;
  AgreementList: undefined;
  ESignAgreement: { agreementId: number | string; quotationNumber?: string; customerName?: string };
  /**
   * Staff route, NOT registered in the customer navigator. Kept here only because
   * src/screens/App/Sales/KycDocumentsScreen.tsx (Phase 2) still types its props with AppStackParamList;
   * remove once that screen uses the staff param list.
   */
  KycDocuments: { customerId: number | string; customerName?: string };
  Login: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  Signup: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppStack: NavigatorScreenParams<AppStackParamList>;
};
