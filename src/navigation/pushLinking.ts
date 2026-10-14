import { Linking } from "react-native";
import type { LinkingOptions } from "@react-navigation/native";
import { getInitialNotificationLink, subscribeToNotificationOpens } from "../services/notificationService";

// Where the single-destination apps (CEO, Sales Manager) get links from: the URL that opened the app (or the push
// notification that was tapped while it was not running), then later URLs and tapped pushes. Their navigators
// spread this into their linking options and map every path to their dashboard.

export const linkAndPushSources: Pick<LinkingOptions<object>, "getInitialURL" | "subscribe"> = {
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
};
