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
  Gallery: undefined;
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
  price: number;
  amenities: string[];
  image: string;
  available: boolean;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AdminPanel: undefined;
  ContactUs:
    | {
        source?: "tour" | "general";
      }
    | undefined;
  SpaceDetail: { workspace: WorkspaceSummary };
  BookingInfo: {
    workspace: WorkspaceSummary;
    booking: {
      mode: "shared" | "meeting" | "office";
      dates: string[];
      slot: string;
      month?: string;
    };
  };
  Payment: {
    workspace: WorkspaceSummary;
    booking: {
      mode: "shared" | "meeting" | "office";
      dates: string[];
      slot: string;
      month?: string;
      securityDeposit?: number;
      guest: {
        name: string;
        email: string;
        phone: string;
      };
    };
  };
  Profile: undefined;
  BookingHistory: undefined;
  PrivacyPolicy: undefined;
  AboutUs: undefined;
  UserManual: undefined;
  Pricing: undefined;
  Challan: { challanNumber?: string; bookingGuid?: string };
  Login: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
  Signup: { redirectAfterLogin?: { screen: keyof AppStackParamList; params?: any } } | undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppStack: NavigatorScreenParams<AppStackParamList>;
};
