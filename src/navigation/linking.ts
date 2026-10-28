import { Linking } from "react-native";
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";
import { APP_LINK_PREFIXES } from "./appLinks";
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
//   worknest://quotation/QUO-1001                      → the app's own scheme (always works if app installed)
//   myapp://quotation/QUO-1001                         → the old scheme, still accepted for links already sent
//   https://work-nest-3936a.web.app/quotation/QUO-1001 → Firebase Hosting universal link
//   https://worknestpk.com/quotation/QUO-1001          → custom domain universal link
//
// Actual navigator hierarchy:
//   Root (RootStack)
//     ├── AuthStack: Login, Signup
//     └── AppStack (native stack)
//          ├── MainTabs (bottom tabs): Home, Bookings, Payments, Agreements, Profile
//          └── QuotationList, Quotation, Spaces, Gallery, BookTour, Notifications, ... (pushed screens)
//
// Test with adb:
//   adb shell am start -W -a android.intent.action.VIEW -d "worknest://quotation/QUO-1001" com.worknestmobile
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
  // https and the app's schemes only: plain http links are not accepted (the Android intent filters are https
  // only too), so a link can't be intercepted or rewritten on the way.
  prefixes: APP_LINK_PREFIXES,
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
      // initialRouteName: a link that opens a screen inside a navigator puts that navigator's first screen under
      // it, so Back from a deep link or a tapped notification (also from a cold start) returns to the tabs (or to
      // Login from Signup) instead of leaving the user on a lone screen with no way back.
      AuthStack: {
        initialRouteName: "Login",
        screens: {
          Login: "login",
          Signup: "signup",
        },
      },
      AppStack: {
        initialRouteName: "MainTabs",
        screens: {
          // The tabs need no initialRouteName: the tab navigator always holds every tab and Back goes to Home.
          MainTabs: {
            screens: {
              Home: "home",
              Bookings: { path: "bookings", alias: ["my-bookings"] },
              Payments: {
                path: "payments",
                alias: ["invoice", "invoices", "invoice/:invoiceId", "my-payments"],
              },
              Agreements: { path: "agreements", alias: ["my-agreements"] },
              Profile: "profile",
            },
          },
          Spaces: { path: "spaces", alias: ["booking"] },
          QuotationList: "quotation",
          Quotation: "quotation/:quotationId",
          Gallery: "gallery",
          BookTour: "book-a-tour",
          ContactUs: "contact",
          AboutUs: "about",
          PrivacyPolicy: "privacy",
          UserManual: "manual",
          Notifications: "notifications",
          MyMeetingRooms: "my-meeting-rooms",
          Attendance: "my-attendance",
        },
      },
    },
  },
};
