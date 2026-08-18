import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

// ─── Play Store fallback ───────────────────────────────────────────────────────
// TODO: Replace with real Play Store URL when app is published.
// Example: https://play.google.com/store/apps/details?id=com.worknestmobile
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.worknestmobile";

// ─── Deep link scheme ─────────────────────────────────────────────────────────
// Supported deep links:
//   myapp://quotation/QUO-1001                        → custom scheme (always works if app installed)
//   https://work-nest-3936.web.app/quotation/QUO-1001 → Firebase Hosting universal link
//   https://worknestpk.com/quotation/QUO-1001         → custom domain universal link
//
// Test with adb:
//   adb shell am start -W -a android.intent.action.VIEW -d "myapp://quotation/QUO-1001" com.worknestmobile
//   adb shell am start -W -a android.intent.action.VIEW -d "https://work-nest-3936.web.app/quotation/QUO-1001" com.worknestmobile
//
// For Firebase Hosting App Links, host assetlinks.json at:
//   https://work-nest-3936.web.app/.well-known/assetlinks.json

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["myapp://", "https://work-nest-3936a.web.app", "http://work-nest-3936a.web.app", "https://worknestpk.com", "http://worknestpk.com"],
  config: {
    screens: {
      AppStack: {
        screens: {
          MainTabs: {
            screens: {
              Home: "home",
            },
          },
          Quotation: "quotation/:quotationId",
        },
      },
    },
  },
};
