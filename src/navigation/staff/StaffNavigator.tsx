import { useEffect, useMemo } from "react";
import { Linking } from "react-native";
import { NavigationContainer, createNavigationContainerRef, type LinkingOptions } from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { StaffRole } from "../../context/roles";
import { useNavigationTheme, useThemeColors } from "../../theme";
import { TabBar, useToast } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { onSessionExpired } from "../../services/apiClient";
import { getInitialNotificationLink, subscribeToNotificationOpens } from "../../services/notificationService";
import { StaffSessionProvider, useStaffSession } from "../../screens/App/Staff/shared/StaffSession";
import type { StaffRouteName, StaffStackParamList, StaffTabName, StaffTabParamList } from "../staffTypes";
import { moreMenuFor, routesFor, tabsFor } from "./access";
import { STAFF_LINK_PREFIXES, staffStateFromPath } from "./links";
import { STAFF_SCREENS, staffTabScreen } from "./staffScreens";
import { stackTransition, staffTransition, tabTransition } from "../transitions";

// One navigator for every staff role: bottom tabs (per-role list in ./access.ts) inside a stack that holds every
// screen the role may open. Screens a role may not open are not registered at all, so navigating to them fails
// instead of showing a page the API would refuse. SaleStack, AdminStack and SuperAdminStack are this navigator
// with their role. Screens draw their own AppHeader and status bar (no navigator header / status-bar options).
// The tabs use the floating pill TabBar (components/ui/TabBar); transitions come from ../transitions.ts
// (pushes slide from the right, forms slide up from the bottom, tab switches fade; none with reduce motion).
// Like the customer app (AppNavigator + linking.ts): deep links and tapped push notifications open the matching
// staff screen (./links.ts) over the tabs, and a session the API refused ends with a "Session expired" message
// (RootNavigator then shows the customer app, whose splash opens Login).

const Stack = createNativeStackNavigator<StaffStackParamList>();
const Tab = createBottomTabNavigator<StaffTabParamList>();

/** Ref to the active staff navigation container (e.g. to open a screen from a push notification). */
export const staffNavRef = createNavigationContainerRef<StaffStackParamList>();

type TabIconProps = { focused: boolean; color: string; size: number };

function tabIcon(icon: string, activeIcon: string) {
  return ({ focused, color, size }: TabIconProps) => (
    <Ionicons name={focused ? activeIcon : icon} size={size} color={color} />
  );
}

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

/** Which pushed screen's badge a tab shows. */
const TAB_BADGE_ROUTE: Partial<Record<StaffTabName, StaffRouteName>> = {
  Inquiries: "TourInquiries",
  Quotations: "QuotationList",
  Bookings: "BookingList",
};

function StaffTabs() {
  const { role, badges, pendingApprovals } = useStaffSession();
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const tabs = tabsFor(role);
  const moreBadge = useMemo(
    () =>
      moreMenuFor(role)
        .flatMap((s) => s.items)
        .reduce((sum, item) => sum + (badges[item.route] ?? 0), 0),
    [role, badges],
  );

  const badgeFor = (tab: StaffTabName): number | undefined => {
    let n = 0;
    if (tab === "Approvals") n = pendingApprovals;
    else if (tab === "More") n = moreBadge;
    else {
      const route = TAB_BADGE_ROUTE[tab];
      n = route ? badges[route] ?? 0 : 0;
    }
    return n > 0 ? n : undefined;
  };

  const screenOptions: BottomTabNavigationOptions = {
    headerShown: false,
    ...tabTransition(reduceMotion),
    sceneStyle: { backgroundColor: colors.background },
  };

  return (
    <Tab.Navigator backBehavior="firstRoute" tabBar={renderTabBar} screenOptions={screenOptions}>
      {tabs.map((tab) => {
        const def = staffTabScreen(role, tab);
        const badge = badgeFor(tab);
        return (
          <Tab.Screen
            key={tab}
            name={tab}
            component={def.component}
            options={{
              title: def.label,
              tabBarLabel: def.label,
              tabBarAccessibilityLabel: badge ? `${def.label}, ${badge} waiting` : def.label,
              tabBarBadge: badge, // TabBar shows "99+" above 99
              tabBarIcon: tabIcon(def.icon, def.activeIcon),
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

/** Linking options for one role: links / tapped pushes open that role's screen for the path (./links.ts). */
function staffLinking(role: StaffRole): LinkingOptions<StaffStackParamList> {
  return {
    prefixes: STAFF_LINK_PREFIXES,
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
    getStateFromPath: (path) => staffStateFromPath(path, role),
    // Not used to parse paths (getStateFromPath does that): it tells React Navigation that StaffTabs is the root's
    // first screen and holds the tabs, so a link while the app is open pushes the screen (or switches tab)
    // instead of resetting the stack.
    config: {
      initialRouteName: "StaffTabs",
      screens: {
        StaffTabs: {
          screens: {
            Dashboard: "dashboard",
            Inquiries: "inquiries",
            Quotations: "quotations",
            Customers: "customers",
            Approvals: "approvals",
            Bookings: "bookings",
            More: "more",
          },
        },
      },
    },
  };
}

export function StaffNavigator({ role }: { role: StaffRole }) {
  const colors = useThemeColors();
  const navTheme = useNavigationTheme();
  const reduceMotion = useReduceMotion();
  const toast = useToast();
  const routes = useMemo(() => routesFor(role), [role]);
  const linking = useMemo(() => staffLinking(role), [role]);

  // The API refused the session (see apiClient / authService, which signs out): say why the app is leaving.
  useEffect(
    () => onSessionExpired(() => toast.info("Please sign in again to continue.", { title: "Session expired" })),
    [toast],
  );

  return (
    <StaffSessionProvider role={role}>
      <NavigationContainer ref={staffNavRef} theme={navTheme} linking={linking}>
        <Stack.Navigator
          initialRouteName="StaffTabs"
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            ...stackTransition(staffTransition(route.name), reduceMotion),
          })}
        >
          <Stack.Screen name="StaffTabs" component={StaffTabs} />
          {routes.map((name) => (
            <Stack.Screen key={name} name={name} component={STAFF_SCREENS[name]} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </StaffSessionProvider>
  );
}

export default StaffNavigator;
