import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Booking: undefined;
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

export type AppStackParamList = {
  MainTabs: undefined;
  AdminPanel: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppStack: NavigatorScreenParams<AppStackParamList>;
};
