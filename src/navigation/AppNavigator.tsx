import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "../screens/App/HomeScreen";
import BookingScreen from "../screens/App/BookingScreen";
import SpaceDetailScreen from "../screens/App/SpaceDetailScreen";
import BookingInfoScreen from "../screens/App/BookingInfoScreen";
import PaymentScreen from "../screens/App/PaymentScreen";
import PricingScreen from "../screens/App/PricingScreen";
import GalleryScreen from "../screens/App/GalleryScreen";
import SignupScreen from "../screens/Auth/SignupScreen";
import { colors } from "../theme";
import type {
  AppDrawerParamList,
  AppStackParamList,
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "./types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SplashScreen from "../screens/Auth/SplashScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import OnboardingScreen from "../screens/Auth/OnboardingScreen";
import ProfileScreen from "../screens/App/ProfileScreen";
import BookingHistoryScreen from "../screens/App/BookingHistoryScreen";
import PrivacyPolicyScreen from "../screens/App/PrivacyPolicyScreen";
import AboutUsScreen from "../screens/App/AboutUsScreen";
import AdminPanelScreen from "../screens/App/AdminPanelScreen";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { StyleSheet, View, Text } from "react-native";
import { useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import packageLock from "../../package-lock.json";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size }) => {
          const iconByRoute: Record<keyof MainTabParamList, string> = {
            Home: "home-outline",
            Booking: "calendar-outline",
            MyBookings: "receipt-outline",
            MyPayments: "card-outline",
            Pricing: "pricetag-outline",
            Gallery: "images-outline",
          };
          const iconName = iconByRoute[route.name];

          return <Ionicons name={iconName} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Booking" component={BookingScreen} />
      {/* <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: "My Bookings" }}
      />
      <Tab.Screen
        name="MyPayments"
        component={MyPaymentsScreen}
        options={{ title: "My Payments" }}
      /> */}
      <Tab.Screen name="Pricing" component={PricingScreen} />
      <Tab.Screen name="Gallery" component={GalleryScreen} />
    </Tab.Navigator>
  );
}

function AppDrawerContent(props: DrawerContentComponentProps) {
  const { clearSession } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const resetToLogin = () => {
    const rootNavigation = props.navigation.getParent();
    if (!rootNavigation) {
      return;
    }
    rootNavigation.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutUser();
    await clearSession();
    resetToLogin();
  };

  const appVersion = (packageLock as any)?.version ?? "";

  return (
    <>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        <DrawerItemList {...props} />
        <DrawerItem
          label="Log Out"
          onPress={() => setShowLogoutConfirm(true)}
          labelStyle={styles.logoutLabel}
          icon={({ color, size }) => (
            <Ionicons name="log-out-outline" size={size} color={color} />
          )}
        />

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>{appVersion ? `v${appVersion}` : ""}</Text>
        </View>
      </DrawerContentScrollView>

      <ConfirmModal
        visible={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          handleLogout().catch(() => {
            setShowLogoutConfirm(false);
            resetToLogin();
          });
        }}
      />
    </>
  );
}

function AppDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.mutedForeground,
        drawerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Drawer.Screen
        name="Workspace"
        component={MainTabs}
        options={{ drawerLabel: "Home" }}
      />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen
        name="BookingHistory"
        component={BookingHistoryScreen}
        options={{ drawerLabel: "Booking History" }}
      />
      <Drawer.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ drawerLabel: "Privacy Policy" }}
      />
      <Drawer.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{ drawerLabel: "About Us" }}
      />
    </Drawer.Navigator>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function AppStackNavigator() {
  return (
    <AppStack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={AppDrawerNavigator} />
      <AppStack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <AppStack.Screen name="SpaceDetail" component={SpaceDetailScreen} />
      <AppStack.Screen name="BookingInfo" component={BookingInfoScreen} />
      <AppStack.Screen name="Payment" component={PaymentScreen} />
    </AppStack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Splash" component={SplashScreen} />
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="AuthStack" component={AuthStackNavigator} />
        <RootStack.Screen name="AppStack" component={AppStackNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  logoutLabel: {
    color: "#dc2626",
    fontWeight: "700",
  },
  versionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  versionText: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: "center",
  },
});
