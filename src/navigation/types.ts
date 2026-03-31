import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Booking:
    | {
        initialRoomType?: "Meeting/Conference" | "Shared Space" | "Office";
        initialLocation?: string;
      }
    | undefined;
  MyBookings: undefined;
  MyPayments: undefined;
  Pricing: undefined;
  Gallery: undefined;
};

export type AppDrawerParamList = {
  Workspace: undefined;
  Profile: undefined;
  BookingHistory: undefined;
  PrivacyPolicy: undefined;
  AboutUs: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type WorkspaceSummary = {
  id: number;
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
  MainTabs: undefined;
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
      guest: {
        name: string;
        email: string;
        phone: string;
      };
    };
  };
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppStack: NavigatorScreenParams<AppStackParamList>;
};
