import React, { useState, useEffect } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
  DrawerActions,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { InteractionManager } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { StyleSheet, View, Text, Image, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "../screens/App/HomeScreen";
import BookingScreen from "../screens/App/BookingScreen";
import MyPaymentsScreen from "../screens/App/MyPaymentsScreen";
import SpaceDetailScreen from "../screens/App/SpaceDetailScreen";
import BookingInfoScreen from "../screens/App/BookingInfoScreen";
import PaymentScreen from "../screens/App/PaymentScreen";
import ContactUsScreen from "../screens/App/ContactUsScreen";
import PricingScreen from "../screens/App/PricingScreen";
import GalleryScreen from "../screens/App/GalleryScreen";
import SignupScreen from "../screens/Auth/SignupScreen";
import SplashScreen from "../screens/Auth/SplashScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import OnboardingScreen from "../screens/Auth/OnboardingScreen";
import ProfileScreen from "../screens/App/ProfileScreen";
import MyBookingsScreen from "../screens/App/MyBookingsScreen";
import PrivacyPolicyScreen from "../screens/App/PrivacyPolicyScreen";
import AboutUsScreen from "../screens/App/AboutUsScreen";
import AdminPanelScreen from "../screens/App/AdminPanelScreen";

import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { useThemeColors, useThemedStyles } from "../theme";
import { ConfirmModal } from "../components/ConfirmModal";
import packageLock from "../../package-lock.json";

import type {
  AppStackParamList,
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "./types";

// ─── Navigators ────────────────────────────────────────────────────────────────
const Tab        = createBottomTabNavigator<MainTabParamList>();
const Drawer     = createDrawerNavigator();
const Root       = createNativeStackNavigator<RootStackParamList>();
const Auth       = createNativeStackNavigator<AuthStackParamList>();
const AppStack   = createNativeStackNavigator<AppStackParamList>();
const InnerStack = createNativeStackNavigator<AppStackParamList>();

// ─── Nav refs ──────────────────────────────────────────────────────────────────
// rootNavRef  → NavigationContainer  (always alive, used for all navigation)
export const rootNavRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// drawerNavRef → dispatches DrawerActions through the root nav ref
// Works even when AppDrawerNavigator is not the active screen
export const drawerNavRef = {
  open:  () => rootNavRef.current?.dispatch(DrawerActions.openDrawer()),
  close: () => rootNavRef.current?.dispatch(DrawerActions.closeDrawer()),
};

// ─── Tab icons ─────────────────────────────────────────────────────────────────
type IconProps = { color: string; size: number; focused: boolean };
const HomeIcon    = ({ color, size, focused }: IconProps) => <Ionicons name={focused ? "home"      : "home-outline"}      color={color} size={size} />;
const BookingIcon = ({ color, size, focused }: IconProps) => <Ionicons name={focused ? "calendar"  : "calendar-outline"}  color={color} size={size} />;
const PaymentIcon = ({ color, size, focused }: IconProps) => <Ionicons name={focused ? "card"      : "card-outline"}      color={color} size={size} />;
const GalleryIcon = ({ color, size, focused }: IconProps) => <Ionicons name={focused ? "images"    : "images-outline"}    color={color} size={size} />;
const PricingIcon = ({ color, size, focused }: IconProps) => <Ionicons name={focused ? "pricetag"  : "pricetag-outline"}  color={color} size={size} />;

// ─── Main bottom tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          shadowColor: colors.primary,
          shadowOpacity: 0.15,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -6 },
          elevation: 20,
        },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2, marginTop: 2 },
      }}
    >
      <Tab.Screen name="Home"       component={HomeScreen}       options={{ tabBarIcon: HomeIcon }} />
      <Tab.Screen name="Booking"    component={BookingScreen}    options={{ tabBarIcon: BookingIcon }} />
      <Tab.Screen name="MyPayments" component={MyPaymentsScreen} options={{ title: "My Payments", tabBarIcon: PaymentIcon }} />
      <Tab.Screen name="Gallery"    component={GalleryScreen}    options={{ tabBarIcon: GalleryIcon }} />
      <Tab.Screen name="Pricing"    component={PricingScreen}    options={{ tabBarIcon: PricingIcon }} />
    </Tab.Navigator>
  );
}

// ─── Drawer menu items ─────────────────────────────────────────────────────────
// screen: null  → go to Home tab (stays in MainTabs)
// screen: string → push that screen onto AppStack
const MENU_ITEMS = [
  { label: "Home",            icon: "grid-outline",               screen: null               },
  { label: "Profile",         icon: "person-outline",             screen: "Profile"          },
  { label: "Booking History", icon: "time-outline",               screen: "BookingHistory"   },
  { label: "Privacy Policy",  icon: "shield-checkmark-outline",   screen: "PrivacyPolicy"    },
  { label: "About Us",        icon: "information-circle-outline", screen: "AboutUs"          },
] as const;

function AppDrawerContent(props: DrawerContentComponentProps) {
  const { clearSession } = useAuth();
  const colors  = useThemeColors();
  const styles  = useThemedStyles(makeDrawerStyles);
  const [showLogout, setShowLogout] = useState(false);
  const appVersion = (packageLock as any)?.version ?? "";

  const goTo = (screen: string | null) => {
    props.navigation.closeDrawer();
    InteractionManager.runAfterInteractions(() => {
      if (!screen) {
        props.navigation.navigate("Workspace" as any, {
          screen: "MainTabs",
          params: { screen: "Home" },
        } as any);
      } else {
        props.navigation.navigate("Workspace" as any, { screen } as any);
      }
    });
  };

  const resetToLogin = () => {
    rootNavRef.current?.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logoutUser();
    await clearSession();
    resetToLogin();
  };

  return (
    <View style={styles.root}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>

        {/* ── Brand header ── */}
        <View style={styles.brand}>
          <Image
            source={require("../../public/Logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>WorkNest</Text>
        </View>

        {/* ── Menu items ── */}
        {MENU_ITEMS.map((item) => (
          <DrawerItem
            key={item.label}
            label={item.label}
            activeTintColor={colors.primary}
            inactiveTintColor={colors.mutedForeground}
            activeBackgroundColor={colors.primaryMuted}
            style={styles.item}
            labelStyle={styles.itemLabel}
            icon={({ size, color }) => (
              <Ionicons name={item.icon} size={size} color={color} />
            )}
            onPress={() => goTo(item.screen)}
          />
        ))}

        {/* ── Logout ── */}
        <DrawerItem
          label="Log Out"
          labelStyle={styles.logoutLabel}
          style={styles.item}
          icon={({ size }) => (
            <Ionicons name="log-out-outline" size={size} color={colors.danger} />
          )}
          onPress={() => setShowLogout(true)}
        />
      </DrawerContentScrollView>

      {/* ── Version footer ── */}
      <View style={styles.footer}>
        <Text style={styles.version}>v{appVersion || "0.0.1"}</Text>
      </View>

      {/* ── Logout confirm modal ── */}
      <ConfirmModal
        visible={showLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        onCancel={() => setShowLogout(false)}
        onConfirm={() => {
          handleLogout().catch(() => {
            setShowLogout(false);
            resetToLogin();
          });
        }}
      />
    </View>
  );
}

const makeDrawerStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    root:       { flex: 1, backgroundColor: colors.card },
    scroll:     { flexGrow: 1 },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: 8,
    },
    logoImg:   { width: 38, height: 38 },
    brandText: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    brandTextAccent: {
      color: colors.primary,
    },
    item:        { borderRadius: 10, marginHorizontal: 8, marginVertical: 1 },
    itemLabel:   { fontSize: 14, fontWeight: "600", marginLeft: -8 },
    logoutLabel: { color: colors.danger, fontWeight: "700", marginLeft: -8 },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    version: { color: colors.mutedForeground, fontSize: 12 },
  });

// ─── Inner stack (lives INSIDE the drawer so DrawerActions always work) ────────
function InnerStackNavigator() {
  const colors = useThemeColors();
  return (
    <InnerStack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
        statusBarStyle: "dark",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <InnerStack.Screen name="MainTabs"       component={MainTabs} />
      <InnerStack.Screen name="Profile"        component={ProfileScreen} />
      <InnerStack.Screen name="BookingHistory" component={MyBookingsScreen} />
      <InnerStack.Screen name="PrivacyPolicy"  component={PrivacyPolicyScreen} />
      <InnerStack.Screen name="AboutUs"        component={AboutUsScreen} />
      <InnerStack.Screen name="AdminPanel"     component={AdminPanelScreen} />
      <InnerStack.Screen name="ContactUs"      component={ContactUsScreen} />
      <InnerStack.Screen name="SpaceDetail"    component={SpaceDetailScreen} />
      <InnerStack.Screen name="BookingInfo"    component={BookingInfoScreen} />
      <InnerStack.Screen name="Payment"        component={PaymentScreen} />
    </InnerStack.Navigator>
  );
}

// ─── Drawer navigator ──────────────────────────────────────────────────────────
function AppDrawerNavigator() {
  const colors = useThemeColors();
  return (
    <Drawer.Navigator
      drawerContent={(p) => <AppDrawerContent {...p} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: "right",
        drawerType: "front",
        swipeEnabled: false,
        overlayColor: "rgba(0,0,0,0.45)",
        drawerStyle: { backgroundColor: colors.card, width: 290 },
      }}
    >
      <Drawer.Screen name="Workspace" component={InnerStackNavigator} />
    </Drawer.Navigator>
  );
}

// ─── Auth stack ────────────────────────────────────────────────────────────────
function AuthStackNavigator() {
  const colors = useThemeColors();
  useEffect(() => { StatusBar.setBackgroundColor(colors.background); }, [colors.background]);
  return (
    <Auth.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
        statusBarStyle: "dark",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Auth.Screen name="Login"  component={LoginScreen} />
      <Auth.Screen name="Signup" component={SignupScreen} />
    </Auth.Navigator>
  );
}

// ─── App stack ─────────────────────────────────────────────────────────────────
// AppStack only mounts AppDrawerNavigator; all sub-screens are inside InnerStack
// so the drawer stays in the hierarchy and DrawerActions always work.
function AppStackNavigator() {
  const colors = useThemeColors();
  useEffect(() => { StatusBar.setBackgroundColor(colors.background); }, [colors.background]);
  return (
    <AppStack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
        statusBarStyle: "dark",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen name="MainTabs" component={AppDrawerNavigator} />
    </AppStack.Navigator>
  );
}

// ─── Root navigator ────────────────────────────────────────────────────────────
export function AppNavigator() {
  const colors = useThemeColors();
  useEffect(() => { StatusBar.setBackgroundColor(colors.background); }, [colors.background]);

  return (
    <NavigationContainer ref={rootNavRef}>
      <Root.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          statusBarTranslucent: false,
          statusBarStyle: "dark",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Root.Screen name="Splash"      component={SplashScreen} />
        <Root.Screen name="Onboarding"  component={OnboardingScreen} />
        <Root.Screen name="AuthStack"   component={AuthStackNavigator} />
        <Root.Screen name="AppStack"    component={AppStackNavigator} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
