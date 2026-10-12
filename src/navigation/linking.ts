import { Linking } from "react-native";
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";
import {
  getInitialNotificationLink,
  subscribeToNotificationOpens,
} from "../services/notificationService";

// ─── Play Store fallback ───────────────────────────────────────────────────────
// TODO: Replace with real Play Store URL when app is published.
// Example: https://play.google.com/store/apps/details?id=com.worknestmobile
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.worknestmobile";

// ─── Deep link scheme ─────────────────────────────────────────────────────────
// Supported deep links:
//   myapp://quotation/QUO-1001                         → custom scheme (always works if app installed)
//   https://work-nest-3936a.web.app/quotation/QUO-1001 → Firebase Hosting universal link
//   https://worknestpk.com/quotation/QUO-1001          → custom domain universal link
//
// Actual navigator hierarchy:
//   Root (RootStack)
//     └── AppStack (AppStackNavigator)
//          └── MainTabs → AppDrawerNavigator
//               └── Workspace (DrawerScreen)
//                    └── InnerStack (InnerStackNavigator)
//                         ├── MainTabs (BottomTabNavigator)
//                         │    └── Home, Booking, MyPayments (Payments), Profile
//                         ├── QuotationList
//                         ├── Quotation
//                         └── ... other screens
//
// Test with adb:
//   adb shell am start -W -a android.intent.action.VIEW -d "myapp://quotation/QUO-1001" com.worknestmobile
//   adb shell am start -W -a android.intent.action.VIEW -d "https://work-nest-3936a.web.app/quotation/QUO-1001" com.worknestmobile
//
// For Firebase Hosting App Links, host assetlinks.json at:
//   https://work-nest-3936a.web.app/.well-known/assetlinks.json
//
// Push notifications: a tapped notification is turned into one of these links
// (notificationService.notificationLink) and opened through the same config, from the background
// (subscribe) or from a quit state (getInitialURL).
//
// Old /invoice links open the Payments tab: customers have challans and payments, not an invoice list.

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "myapp://",
    "https://work-nest-3936a.web.app",
    "http://work-nest-3936a.web.app",
    "https://worknestpk.com",
    "http://worknestpk.com",
  ],
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;
    // Opened by tapping a push notification while the app was not running.
    return getInitialNotificationLink();
  },
  subscribe(listener) {
    const linkSubscription = Linking.addEventListener("url", ({ url }) => listener(url));
    const stopNotificationOpens = subscribeToNotificationOpens(listener);
    return () => {
      linkSubscription.remove();
      stopNotificationOpens();
    };
  },
  config: {
    screens: {
      // Root-level screens
      Splash: "splash",
      Onboarding: "onboarding",
      AuthStack: {
        screens: {
          Login: "login",
          Signup: "signup",
        },
      },
      // Main app stack
      AppStack: {
        screens: {
          // AppStack only has "MainTabs" which renders AppDrawerNavigator
          MainTabs: {
            screens: {
              // Drawer has one screen: "Workspace" which renders InnerStack
              Workspace: {
                screens: {
                  // InnerStack screens
                  MainTabs: {
                    screens: {
                      Home: "home",
                      Booking: "booking",
                      MyPayments: {
                        path: "payments",
                        alias: ["invoice", "invoices", "invoice/:invoiceId", "my-payments"],
                      },
                      Profile: "profile",
                    },
                  },
                  QuotationList: "quotation",
                  Quotation: "quotation/:quotationId",
                  MyBookings: { path: "bookings", alias: ["my-bookings"] },
                  AgreementList: { path: "agreements", alias: ["my-agreements"] },
                  Gallery: "gallery",
                  BookTour: "book-a-tour",
                  ContactUs: "contact",
                  AboutUs: "about",
                  PrivacyPolicy: "privacy",
                  UserManual: "manual",
                  Notifications: "notifications",
                },
              },
            },
          },
        },
      },
    },
  },
};
