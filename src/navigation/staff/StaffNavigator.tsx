import { useMemo } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { StaffRole } from "../../context/roles";
import { useNavigationTheme, useThemeColors } from "../../theme";
import { TabBar } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { StaffSessionProvider, useStaffSession } from "../../screens/App/Staff/shared/StaffSession";
import type { StaffRouteName, StaffStackParamList, StaffTabName, StaffTabParamList } from "../staffTypes";
import { moreMenuFor, routesFor, tabsFor } from "./access";
import { STAFF_SCREENS, staffTabScreen } from "./staffScreens";
import { stackTransition, staffTransition, tabTransition } from "../transitions";

// One navigator for every staff role: bottom tabs (per-role list in ./access.ts) inside a stack that holds every
// screen the role may open. Screens a role may not open are not registered at all, so navigating to them fails
// instead of showing a page the API would refuse. SaleStack, AdminStack and SuperAdminStack are this navigator
// with their role. Screens draw their own AppHeader and status bar (no navigator header / status-bar options).
// The tabs use the floating pill TabBar (components/ui/TabBar); transitions come from ../transitions.ts
// (pushes slide from the right, forms slide up from the bottom, tab switches fade; none with reduce motion).

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

export function StaffNavigator({ role }: { role: StaffRole }) {
  const colors = useThemeColors();
  const navTheme = useNavigationTheme();
  const reduceMotion = useReduceMotion();
  const routes = useMemo(() => routesFor(role), [role]);

  return (
    <StaffSessionProvider role={role}>
      <NavigationContainer ref={staffNavRef} theme={navTheme}>
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
