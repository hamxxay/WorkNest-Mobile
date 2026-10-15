import { useEffect, useMemo } from "react";
import { NavigationContainer, createNavigationContainerRef, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useToast } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { onSessionExpired } from "../../services/apiClient";
import { useNavigationTheme, useThemeColors } from "../../theme";
import AccessOfficerScreen from "../../screens/App/AccessOfficer/AccessOfficerScreen";
import AccessOfficerProfileScreen from "../../screens/App/AccessOfficer/AccessOfficerProfileScreen";
import type { AccessOfficerStackParamList } from "../accessOfficerTypes";
import { linkAndPushSources } from "../pushLinking";
import { accessOfficerTransition, stackTransition } from "../transitions";
import { ACCESS_OFFICER_LINK_PREFIXES, accessOfficerStateFromPath } from "./links";

// The Access Officer app (role "access_officer"): one stack with the Access screen (door access by CNIC) and a small
// profile / sign-out screen, like the CEO and Sales Manager apps. No tabs, and no customer, staff, CEO or Sales
// Manager screen is registered, so nothing can navigate an Access Officer there. Deep links and tapped push
// notifications open the Access screen (./links.ts). Screens draw their own AppHeader and status bar. A session the
// API refused ends with a "Session expired" message (RootNavigator then shows the customer app, whose splash opens
// Login).

const Stack = createNativeStackNavigator<AccessOfficerStackParamList>();

/** Ref to the Access Officer navigation container. */
export const accessOfficerNavRef = createNavigationContainerRef<AccessOfficerStackParamList>();

const linking: LinkingOptions<AccessOfficerStackParamList> = {
  prefixes: ACCESS_OFFICER_LINK_PREFIXES,
  // The URL that opened the app (or the tapped push), then later URLs and tapped pushes.
  ...linkAndPushSources,
  // Every link opens the Access screen (a link while the profile is open goes back to it).
  getStateFromPath: (path) => accessOfficerStateFromPath(path),
  config: { initialRouteName: "AccessOfficerAccess", screens: { AccessOfficerAccess: "access" } },
};

export function AccessOfficerNavigator() {
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
      ({ route }: { route: { name: keyof AccessOfficerStackParamList } }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        ...stackTransition(accessOfficerTransition(route.name), reduceMotion),
      }),
    [colors.background, reduceMotion],
  );

  return (
    <NavigationContainer ref={accessOfficerNavRef} theme={navTheme} linking={linking}>
      <Stack.Navigator initialRouteName="AccessOfficerAccess" screenOptions={screenOptions}>
        <Stack.Screen name="AccessOfficerAccess" component={AccessOfficerScreen} />
        <Stack.Screen name="AccessOfficerProfile" component={AccessOfficerProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AccessOfficerNavigator;
