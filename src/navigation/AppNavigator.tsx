import React, { useEffect } from "react";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";

import HomeScreen from "../screens/App/General/HomeScreen";
import SpacesScreen from "../screens/App/General/SpacesScreen";
import MyBookingsScreen from "../screens/App/General/MyBookingsScreen";
import MyPaymentsScreen from "../screens/App/General/MyPaymentsScreen";
import AgreementListScreen from "../screens/App/General/AgreementListScreen";
import ProfileScreen from "../screens/App/General/ProfileScreen";
import SpaceDetailScreen from "../screens/App/General/SpaceDetailScreen";
import BookingInfoScreen from "../screens/App/General/BookingInfoScreen";
import BookingConfirmScreen from "../screens/App/General/BookingConfirmScreen";
import ChallanScreen from "../screens/App/General/ChallanScreen";
import BookingDetailScreen from "../screens/App/General/BookingDetailScreen";
import QuotationScreen from "../screens/App/General/QuotationScreen";
import QuotationListScreen from "../screens/App/General/QuotationListScreen";
import ESignAgreementScreen from "../screens/App/General/ESignAgreementScreen";
import NotificationsScreen from "../screens/App/General/NotificationsScreen";
import GalleryScreen from "../screens/App/General/GalleryScreen";
import BookTourScreen from "../screens/App/General/BookTourScreen";
import ContactUsScreen from "../screens/App/General/ContactUsScreen";
import AboutUsScreen from "../screens/App/General/AboutUsScreen";
import PrivacyPolicyScreen from "../screens/App/General/PrivacyPolicyScreen";
import UserManualScreen from "../screens/App/General/UserManualScreen";
import AccessRequestScreen from "../screens/App/General/AccessRequestScreen";
import UnlockDoorScreen from "../screens/App/General/UnlockDoorScreen";
import SignupScreen from "../screens/Auth/SignupScreen";
import SplashScreen from "../screens/Auth/SplashScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import OnboardingScreen from "../screens/Auth/OnboardingScreen";

import { onSessionExpired } from "../services/apiClient";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuth } from "../context/AuthContext";
import { useNavigationTheme, useThemeColors } from "../theme";
import { useToast } from "../components/ui";
import { linking } from "./linking";

import type {
  AppStackParamList,
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "./types";

// ─── Navigators ────────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>();
const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

// ─── Nav refs ──────────────────────────────────────────────────────────────────
// rootNavRef → the customer NavigationContainer (always alive while the customer app is shown).
export const rootNavRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// ─── Bottom tabs ───────────────────────────────────────────────────────────────
const TAB_ICONS: Record<keyof MainTabParamList, { active: string; inactive: string; label: string }> = {
  Home: { active: "home", inactive: "home-outline", label: "Home" },
  Bookings: { active: "calendar", inactive: "calendar-outline", label: "Bookings" },
  Payments: { active: "receipt", inactive: "receipt-outline", label: "Payments" },
  Agreements: { active: "document-text", inactive: "document-text-outline", label: "Agreements" },
  Profile: { active: "person", inactive: "person-outline", label: "Profile" },
};

/** Tab icon renderer (module level, so it is not a component created during render). */
const tabIcon =
  (icon: { active: string; inactive: string }) =>
  ({ focused, color, size }: { focused: boolean; color: string; size: number }) =>
    <Ionicons name={focused ? icon.active : icon.inactive} size={size} color={color} />;

function MainTabs() {
  const colors = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icon = TAB_ICONS[route.name];
        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            minHeight: 60,
          },
          tabBarItemStyle: { minHeight: 48, paddingVertical: 4 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarLabel: icon.label,
          tabBarAccessibilityLabel: `${icon.label} tab`,
          tabBarIcon: tabIcon(icon),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} />
      <Tab.Screen name="Payments" component={MyPaymentsScreen} />
      <Tab.Screen name="Agreements" component={AgreementListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── App stack (tabs + every pushed screen) ────────────────────────────────────
// No statusBar* options here: Screen / AppHeader own the status bar (UI kit README section 5).
function AppStackNavigator() {
  const colors = useThemeColors();
  return (
    <AppStack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <AppStack.Screen name="MainTabs" component={MainTabs} />
      <AppStack.Screen name="Spaces" component={SpacesScreen} />
      <AppStack.Screen name="SpaceDetail" component={SpaceDetailScreen} />
      <AppStack.Screen name="BookingInfo" component={BookingInfoScreen} />
      <AppStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      <AppStack.Screen name="Challan" component={ChallanScreen} />
      <AppStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <AppStack.Screen name="QuotationList" component={QuotationListScreen} />
      <AppStack.Screen name="Quotation" component={QuotationScreen} />
      <AppStack.Screen name="ESignAgreement" component={ESignAgreementScreen} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} />
      <AppStack.Screen name="Gallery" component={GalleryScreen} />
      <AppStack.Screen name="BookTour" component={BookTourScreen} />
      <AppStack.Screen name="ContactUs" component={ContactUsScreen} />
      <AppStack.Screen name="AboutUs" component={AboutUsScreen} />
      <AppStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <AppStack.Screen name="UserManual" component={UserManualScreen} />
      <AppStack.Screen name="AccessRequest" component={AccessRequestScreen} />
      <AppStack.Screen name="UnlockDoor" component={UnlockDoorScreen} />
      <AppStack.Screen name="Login" component={LoginScreen} />
      <AppStack.Screen name="Signup" component={SignupScreen} />
    </AppStack.Navigator>
  );
}

// ─── Auth stack ────────────────────────────────────────────────────────────────
function AuthStackNavigator() {
  const colors = useThemeColors();
  return (
    <Auth.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Signup" component={SignupScreen} />
    </Auth.Navigator>
  );
}

// ─── Root navigator ────────────────────────────────────────────────────────────
export function AppNavigator() {
  const colors = useThemeColors();
  const navTheme = useNavigationTheme();
  const { user } = useAuth();
  const toast = useToast();

  // Push notifications and announcements: signed-in users only (guests are never asked for permission).
  usePushNotifications(typeof user?.email === "string" ? user.email : null);

  // The API refused the session (see apiClient / authService): open Login with a short explanation.
  useEffect(
    () =>
      onSessionExpired(() => {
        rootNavRef.current?.reset({ index: 0, routes: [{ name: "AuthStack", params: { screen: "Login" } }] });
        toast.info("Please sign in again to continue.", { title: "Session expired" });
      }),
    [toast],
  );

  return (
    <NavigationContainer
      ref={(ref) => {
        rootNavRef.current = ref;
      }}
      theme={navTheme}
      linking={linking}
    >
      <Root.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Root.Screen name="Splash" component={SplashScreen} options={{ animation: "fade" }} />
        <Root.Screen name="Onboarding" component={OnboardingScreen} />
        <Root.Screen name="AuthStack" component={AuthStackNavigator} />
        <Root.Screen name="AppStack" component={AppStackNavigator} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
