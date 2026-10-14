import { useEffect, useMemo } from "react";
import { NavigationContainer, createNavigationContainerRef, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useToast } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { onSessionExpired } from "../../services/apiClient";
import { useNavigationTheme, useThemeColors } from "../../theme";
import SalesManagerDashboardScreen from "../../screens/App/SalesManager/SalesManagerDashboardScreen";
import SalesManagerBreakdownScreen from "../../screens/App/SalesManager/SalesManagerBreakdownScreen";
import SalesManagerRecordsScreen from "../../screens/App/SalesManager/SalesManagerRecordsScreen";
import SalesManagerProfileScreen from "../../screens/App/SalesManager/SalesManagerProfileScreen";
import { linkAndPushSources } from "../pushLinking";
import type { SalesManagerStackParamList } from "../salesManagerTypes";
import { salesManagerTransition, stackTransition } from "../transitions";
import { SALES_MANAGER_LINK_PREFIXES, salesManagerStateFromPath } from "./links";

// The Sales Manager app (role "sales_manager"): one stack with the sales dashboard, its two drill-down levels and
// a small profile / sign-out screen, like the CEO app. No tabs, and no customer, staff or CEO screen is registered,
// so nothing can navigate a Sales Manager there. Deep links and tapped push notifications open the dashboard
// (./links.ts). Screens draw their own AppHeader and status bar. A session the API refused ends with a "Session
// expired" message (RootNavigator then shows the customer app, whose splash opens Login).

const Stack = createNativeStackNavigator<SalesManagerStackParamList>();

/** Ref to the Sales Manager navigation container. */
export const salesManagerNavRef = createNavigationContainerRef<SalesManagerStackParamList>();

const linking: LinkingOptions<SalesManagerStackParamList> = {
  prefixes: SALES_MANAGER_LINK_PREFIXES,
  // The URL that opened the app (or the tapped push), then later URLs and tapped pushes.
  ...linkAndPushSources,
  // Every link opens the dashboard (a link while a drill screen is open goes back to it).
  getStateFromPath: (path) => salesManagerStateFromPath(path),
  config: { initialRouteName: "SalesManagerDashboard", screens: { SalesManagerDashboard: "dashboard" } },
};

export function SalesManagerNavigator() {
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
      ({ route }: { route: { name: keyof SalesManagerStackParamList } }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        ...stackTransition(salesManagerTransition(route.name), reduceMotion),
      }),
    [colors.background, reduceMotion],
  );

  return (
    <NavigationContainer ref={salesManagerNavRef} theme={navTheme} linking={linking}>
      <Stack.Navigator initialRouteName="SalesManagerDashboard" screenOptions={screenOptions}>
        <Stack.Screen name="SalesManagerDashboard" component={SalesManagerDashboardScreen} />
        <Stack.Screen name="SalesManagerBreakdown" component={SalesManagerBreakdownScreen} />
        <Stack.Screen name="SalesManagerRecords" component={SalesManagerRecordsScreen} />
        <Stack.Screen name="SalesManagerProfile" component={SalesManagerProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default SalesManagerNavigator;
