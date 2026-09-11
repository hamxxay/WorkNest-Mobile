import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

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
//                         │    └── Home, Booking, MyPayments, Gallery, Profile
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

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "myapp://",
    "https://work-nest-3936a.web.app",
    "http://work-nest-3936a.web.app",
    "https://worknestpk.com",
    "http://worknestpk.com",
  ],
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
                      MyPayments: "payments",
                      Gallery: "gallery",
                      Profile: "profile",
                    },
                  },
                  QuotationList: "quotation",
                  Quotation: "quotation/:quotationId",
                  InvoiceList: "invoice",
                  InvoiceDetail: "invoice/:invoiceId",
                  Pricing: "pricing",
                  AboutUs: "about",
                  PrivacyPolicy: "privacy",
                  UserManual: "manual",
                  Notifications: "notifications",
                  BookingHistory: "bookings",
                },
              },
            },
          },
        },
      },
    },
  },
};
