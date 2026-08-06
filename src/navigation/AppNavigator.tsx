import React, { useState, useEffect, useRef } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
  DrawerActions,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Animated, InteractionManager, Pressable } from "react-native";
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
import UserManualScreen from "../screens/App/UserManualScreen";
import ChallanScreen from "../screens/App/ChallanScreen";
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

// ─── Tab config ────────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: "Home",       activeIcon: "home",     inactiveIcon: "home-outline"     },
  { name: "Booking",    activeIcon: "calendar", inactiveIcon: "calendar-outline" },
  { name: "MyPayments", activeIcon: "card",     inactiveIcon: "card-outline"     },
  { name: "Gallery",    activeIcon: "images",   inactiveIcon: "images-outline"   },
  { name: "Profile",    activeIcon: "person",   inactiveIcon: "person-outline"   },
] as const;

// ─── Animated tab item ─────────────────────────────────────────────────────────
function TabItem({
  focused,
  activeIcon,
  inactiveIcon,
  label,
  onPress,
}: {
  focused: boolean;
  activeIcon: string;
  inactiveIcon: string;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.18, friction: 5, tension: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: -6, friction: 5, tension: 180, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 160, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 6, tension: 160, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [bgOpacity, focused, scale, translateY]);

  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} android_ripple={{ color: colors.primaryMuted, borderless: false }} onPress={onPress} style={styles.tabItem}>
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        {/* pill background */}
        <Animated.View
          style={[
            styles.tabPill,
            {
              opacity: bgOpacity,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        />
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={22}
          color={focused ? "#fff" : colors.mutedForeground}
          style={styles.tabIcon}
        />
      </Animated.View>
      {/* active dot */}
      {focused && <View style={[styles.tabDot, { backgroundColor: colors.primary }]} />}
      <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Custom tab bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user } = useAuth();

  // Screens that require authentication
  const PROTECTED_TABS = ["MyPayments", "Profile"];

  return (
    <View
      style={[
        styles.tabBar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.card,
          borderTopColor: colors.border + "40",
          shadowColor: colors.primary,
        },
      ]}
    >
      {TAB_ITEMS.map((item, i) => (
        <TabItem
          key={item.name}
          focused={state.index === i}
          activeIcon={item.activeIcon}
          inactiveIcon={item.inactiveIcon}
          label={item.name === "MyPayments" ? "Payments" : item.name}
          onPress={() => {
            const isProtected = PROTECTED_TABS.includes(item.name);
            if (isProtected && !user) {
              // Navigate to Login inside the app stack, with redirect back
              navigation.navigate("Home" as any);
              (navigation as any).getParent()?.navigate("Login", {
                redirectAfterLogin: { screen: item.name },
              });
              return;
            }
            const event = navigation.emit({ type: "tabPress", target: state.routes[i].key, canPreventDefault: true });
            if (!event.defaultPrevented) navigation.navigate(item.name);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -1 },
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 4,
  },
  tabPill: {
    position: "absolute",
    top: -6,
    left: -14,
    right: -14,
    bottom: -6,
    borderRadius: 16,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabIcon: { zIndex: 1 },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: -2 },
});

// ─── Main bottom tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      <Tab.Screen name="Home"       component={HomeScreen} />
      <Tab.Screen name="Booking"    component={BookingScreen} />
      <Tab.Screen name="MyPayments" component={MyPaymentsScreen} />
      <Tab.Screen name="Gallery"    component={GalleryScreen} />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Drawer menu items ─────────────────────────────────────────────────────────
// screen: null  → go to Home tab (stays in MainTabs)
// screen: string → push that screen onto AppStack
const MENU_ITEMS = [
  { label: "Home",            icon: "grid-outline",               screen: null               },
  { label: "Pricing",         icon: "pricetag-outline",           screen: "Pricing"          },
  { label: "Booking History", icon: "time-outline",               screen: "BookingHistory",  protected: true },
  { label: "Privacy Policy",  icon: "shield-checkmark-outline",   screen: "PrivacyPolicy"    },
  { label: "About Us",        icon: "information-circle-outline", screen: "AboutUs"          },
  { label: "User Manual",     icon: "book-outline",               screen: "UserManual"       },
] as const;

function AppDrawerContent(props: DrawerContentComponentProps) {
  const { clearSession, user } = useAuth();
  const colors  = useThemeColors();
  const styles  = useThemedStyles(makeDrawerStyles);
  const [showLogout, setShowLogout] = useState(false);
  const appVersion = (packageLock as any)?.version ?? "";

  const goTo = (screen: string | null, isProtected?: boolean) => {
    if (isProtected && !user) {
      props.navigation.closeDrawer();
      InteractionManager.runAfterInteractions(() => {
        props.navigation.navigate("Workspace" as any, { screen: "Login" } as any);
      });
      return;
    }
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

  const resetToHome = () => {
    rootNavRef.current?.reset({
      index: 0,
      routes: [{ name: "AppStack", params: { screen: "MainTabs" } }],
    });
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logoutUser();
    await clearSession();
    resetToHome();
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
            onPress={() => goTo(item.screen, (item as any).protected)}
          />
        ))}

        {/* ── Login (guest only) / Logout (authenticated only) ── */}
        {!user ? (
          <DrawerItem
            label="Sign In"
            labelStyle={[styles.itemLabel, { color: colors.primary }]}
            style={styles.item}
            icon={({ size }) => (
              <Ionicons name="log-in-outline" size={size} color={colors.primary} />
            )}
            onPress={() => {
              props.navigation.closeDrawer();
              InteractionManager.runAfterInteractions(() => {
                props.navigation.navigate("Workspace" as any, { screen: "Login" } as any);
              });
            }}
          />
        ) : (
          <DrawerItem
            label="Log Out"
            labelStyle={styles.logoutLabel}
            style={styles.item}
            icon={({ size }) => (
              <Ionicons name="log-out-outline" size={size} color={colors.danger} />
            )}
            onPress={() => setShowLogout(true)}
          />
        )}
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
            resetToHome();
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
      <InnerStack.Screen name="UserManual"     component={UserManualScreen} />
      <InnerStack.Screen name="Pricing"        component={PricingScreen} />
      <InnerStack.Screen name="AdminPanel"     component={AdminPanelScreen} />
      <InnerStack.Screen name="ContactUs"      component={ContactUsScreen} />
      <InnerStack.Screen name="SpaceDetail"    component={SpaceDetailScreen} />
      <InnerStack.Screen name="BookingInfo"    component={BookingInfoScreen} />
      <InnerStack.Screen name="Payment"        component={PaymentScreen} />
      <InnerStack.Screen name="Login"          component={LoginScreen} />
      <InnerStack.Screen name="Signup"         component={SignupScreen} />
      <InnerStack.Screen name="Challan"        component={ChallanScreen} />
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
        <Root.Screen name="Splash"      component={SplashScreen} options={{ animation: "fade" }} />
        <Root.Screen name="Onboarding"  component={OnboardingScreen} />
        <Root.Screen name="AuthStack"   component={AuthStackNavigator} />
        <Root.Screen name="AppStack"    component={AppStackNavigator} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
