import { useEffect, useMemo } from "react";
import { Linking } from "react-native";
import { NavigationContainer, createNavigationContainerRef, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useToast } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { onSessionExpired } from "../../services/apiClient";
import { getInitialNotificationLink, subscribeToNotificationOpens } from "../../services/notificationService";
import { useNavigationTheme, useThemeColors } from "../../theme";
import CeoDashboardScreen from "../../screens/App/Ceo/CeoDashboardScreen";
import CeoBreakdownScreen from "../../screens/App/Ceo/CeoBreakdownScreen";
import CeoRecordsScreen from "../../screens/App/Ceo/CeoRecordsScreen";
import CeoProfileScreen from "../../screens/App/Ceo/CeoProfileScreen";
import type { CeoStackParamList } from "../ceoTypes";
import { stackTransition, ceoTransition } from "../transitions";
import { CEO_LINK_PREFIXES, ceoStateFromPath } from "./links";

// The CEO app (role "ceo"): one stack with the CEO dashboard, its two drill-down levels and a small profile /
// sign-out screen. No tabs, and no customer or staff screen is registered, so nothing can navigate a CEO there.
// Deep links and tapped push notifications open the dashboard (./links.ts). Screens draw their own AppHeader and
// status bar. A session the API refused ends with a "Session expired" message (RootNavigator then shows the
// customer app, whose splash opens Login), as in the staff apps.

const Stack = createNativeStackNavigator<CeoStackParamList>();

/** Ref to the CEO navigation container. */
export const ceoNavRef = createNavigationContainerRef<CeoStackParamList>();

const linking: LinkingOptions<CeoStackParamList> = {
  prefixes: CEO_LINK_PREFIXES,
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
  // Every link opens the dashboard (a link while a drill screen is open goes back to it).
  getStateFromPath: (path) => ceoStateFromPath(path),
  config: { initialRouteName: "CeoDashboard", screens: { CeoDashboard: "dashboard" } },
};

export function CeoNavigator() {
  const colors = useThemeColors();
  const navTheme = useNavigationTheme();
  const reduceMotion = useReduceMotion();
  const toast = useToast();

  // The API refused the session (see apiClient / authService, which signs out): say why the app is leaving.
  useEffect(
    () => onSessionExpired(() => toast.info("Please sign in again to continue.", { title: "Session expired" })),
    [toast],
  );

  const screenOptions = useMemo(
    () =>
      ({ route }: { route: { name: keyof CeoStackParamList } }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        ...stackTransition(ceoTransition(route.name), reduceMotion),
      }),
    [colors.background, reduceMotion],
  );

  return (
    <NavigationContainer ref={ceoNavRef} theme={navTheme} linking={linking}>
      <Stack.Navigator initialRouteName="CeoDashboard" screenOptions={screenOptions}>
        <Stack.Screen name="CeoDashboard" component={CeoDashboardScreen} />
        <Stack.Screen name="CeoBreakdown" component={CeoBreakdownScreen} />
        <Stack.Screen name="CeoRecords" component={CeoRecordsScreen} />
        <Stack.Screen name="CeoProfile" component={CeoProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default CeoNavigator;
