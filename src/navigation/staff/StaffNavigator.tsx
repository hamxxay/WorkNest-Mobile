import { createContext, useContext, useEffect, useMemo } from "react";
import {
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationContainerRef,
  type Theme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { StaffRole } from "../../context/roles";
import { useThemeColors } from "../../theme";
import type { StaffStackParamList, StaffTabParamList } from "../staffTypes";
import { drawerNavRef } from "../AppNavigator";
import { routesFor, tabsFor } from "./access";
import { STAFF_SCREENS, staffTabScreen } from "./staffScreens";

// One navigator for every staff role: bottom tabs (per-role list in ./access.ts) inside a stack that holds every
// screen the role may open. Screens a role may not open are not registered at all, so navigating to them fails
// instead of showing a page the API would refuse. SaleStack, AdminStack and SuperAdminStack are this navigator
// with their role.

const Stack = createNativeStackNavigator<StaffStackParamList>();
const Tab = createBottomTabNavigator<StaffTabParamList>();

/** Ref to the active staff navigation container (e.g. to open a screen from a push notification). */
export const staffNavRef = createNavigationContainerRef<StaffStackParamList>();

// The existing Sales / Admin screens draw a header (components/DashboardHeader) whose menu button opens "the
// drawer" through drawerNavRef. Staff apps have tabs instead of a drawer, so that button opens the More tab.
// Goes away when stage 2 replaces those headers.
const legacyMenuButtonTarget = {
  dispatch: (action: { type?: string }) => {
    if (action?.type === "OPEN_DRAWER" && staffNavRef.isReady()) {
      staffNavRef.navigate("StaffTabs", { screen: "More" });
    }
  },
} as unknown as NavigationContainerRef<any>;

const StaffRoleContext = createContext<StaffRole | null>(null);

/** The role whose navigator is showing (null outside a staff navigator). */
export function useStaffRole(): StaffRole | null {
  return useContext(StaffRoleContext);
}

type TabIconProps = { focused: boolean; color: string; size: number };

function tabIcon(icon: string, activeIcon: string) {
  return ({ focused, color, size }: TabIconProps) => (
    <Ionicons name={focused ? activeIcon : icon} size={size} color={color} />
  );
}

function StaffTabs() {
  const role = useStaffRole();
  const colors = useThemeColors();
  const tabs = role ? tabsFor(role) : [];

  return (
    <Tab.Navigator
      backBehavior="firstRoute"
      screenOptions={{
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {role &&
        tabs.map((tab) => {
          const def = staffTabScreen(role, tab);
          return (
            <Tab.Screen
              key={tab}
              name={tab}
              component={def.component}
              options={{
                title: def.title,
                tabBarLabel: def.label,
                tabBarAccessibilityLabel: def.label,
                headerShown: !def.ownHeader,
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
  const routes = useMemo(() => routesFor(role), [role]);

  useEffect(() => {
    drawerNavRef.set(legacyMenuButtonTarget);
    return () => {
      // The next navigator (e.g. the customer app after sign-out) may already have registered its own ref.
      if (drawerNavRef.current === legacyMenuButtonTarget) drawerNavRef.set(null);
    };
  }, []);

  const theme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.foreground,
        border: colors.border,
      },
    }),
    [colors],
  );

  return (
    <StaffRoleContext.Provider value={role}>
      <NavigationContainer ref={staffNavRef} theme={theme}>
        <Stack.Navigator
          initialRouteName="StaffTabs"
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.foreground,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="StaffTabs" component={StaffTabs} options={{ headerShown: false }} />
          {routes.map((name) => {
            const def = STAFF_SCREENS[name];
            return (
              <Stack.Screen
                key={name}
                name={name}
                component={def.component}
                options={{ title: def.title, headerShown: !def.ownHeader }}
              />
            );
          })}
        </Stack.Navigator>
      </NavigationContainer>
    </StaffRoleContext.Provider>
  );
}

export default StaffNavigator;
