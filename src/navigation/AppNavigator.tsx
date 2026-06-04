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
import MyPaymentsScreen from "../screens/App/MyPaymentsScreen";
import SpaceDetailScreen from "../screens/App/SpaceDetailScreen";
import BookingInfoScreen from "../screens/App/BookingInfoScreen";
import PaymentScreen from "../screens/App/PaymentScreen";
import ContactUsScreen from "../screens/App/ContactUsScreen";
import PricingScreen from "../screens/App/PricingScreen";
import GalleryScreen from "../screens/App/GalleryScreen";
import SignupScreen from "../screens/Auth/SignupScreen";
import { useThemeColors, useThemedStyles } from "../theme";
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
import MyBookingsScreen from "../screens/App/MyBookingsScreen";
import PrivacyPolicyScreen from "../screens/App/PrivacyPolicyScreen";
import AboutUsScreen from "../screens/App/AboutUsScreen";
import AdminPanelScreen from "../screens/App/AdminPanelScreen";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { StyleSheet, View, Text, Image, useColorScheme, StatusBar } from "react-native";
import { useState, useEffect } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import packageLock from "../../package-lock.json";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

type IconProps = {
  color: string;
  size: number;
  focused: boolean;
};

function HomeTabIcon({ color, size, focused }: IconProps) {
  return <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />;
}

function BookingTabIcon({ color, size, focused }: IconProps) {
  return <Ionicons name={focused ? "calendar" : "calendar-outline"} color={color} size={size} />;
}

function PaymentsTabIcon({ color, size, focused }: IconProps) {
  return <Ionicons name={focused ? "card" : "card-outline"} color={color} size={size} />;
}

function PricingTabIcon({ color, size, focused }: IconProps) {
  return <Ionicons name={focused ? "pricetag" : "pricetag-outline"} color={color} size={size} />;
}

function GalleryTabIcon({ color, size, focused }: IconProps) {
  return <Ionicons name={focused ? "images" : "images-outline"} color={color} size={size} />;
}

function renderAppDrawerContent(props: DrawerContentComponentProps) {
  return <AppDrawerContent {...props} />;
}

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
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.1,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: HomeTabIcon }}
      />
      <Tab.Screen
        name="Booking"
        component={BookingScreen}
        options={{ tabBarIcon: BookingTabIcon }}
      />
      <Tab.Screen
        name="MyPayments"
        component={MyPaymentsScreen}
        options={{
          title: "My Payments",
          tabBarIcon: PaymentsTabIcon,
        }}
      />
      
      <Tab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ tabBarIcon: GalleryTabIcon }}
      />
      <Tab.Screen
        name="Pricing"
        component={PricingScreen}
        options={{ tabBarIcon: PricingTabIcon }}
      />
    </Tab.Navigator>
  );
}

function AppDrawerContent(props: DrawerContentComponentProps) {
  const { clearSession } = useAuth();
  const colors = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      drawerRoot: {
        flex: 1,
      },
      drawerContent: {
        flexGrow: 1,
      },
      drawerBrand: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 18,
        marginBottom: 8,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      },
      drawerLogoWell: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primaryMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      drawerLogo: {
        width: 30,
        height: 30,
      },
      drawerBrandText: {
        color: colors.foreground,
        fontSize: 19,
        fontWeight: "800",
        letterSpacing: 0.3,
      },
      drawerBrandTagline: {
        color: colors.mutedForeground,
        fontSize: 12,
        fontWeight: "500",
        marginTop: 1,
      },
      logoutLabel: {
        color: colors.danger,
        fontWeight: "700",
      },
      versionContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      },
      versionText: {
        color: colors.mutedForeground,
        fontSize: 12,
        textAlign: "center",
      },
    }),
  );
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
      <View style={styles.drawerRoot}>
        <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
          <View style={styles.drawerBrand}>
            <View style={styles.drawerLogoWell}>
              <Image
                source={require("../../public/Logo.png")}
                style={styles.drawerLogo}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.drawerBrandText}>WorkNest</Text>
              <Text style={styles.drawerBrandTagline}>Workspace booking</Text>
            </View>
          </View>
          <DrawerItemList {...props} />
          <DrawerItem
            label="Log Out"
            onPress={() => setShowLogoutConfirm(true)}
            labelStyle={styles.logoutLabel}
            icon={({ size }) => <Ionicons name="log-out-outline" size={size} color={colors.danger} />}
          />
        </DrawerContentScrollView>
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>{appVersion ? `v${appVersion}` : ""}</Text>
        </View>
      </View>

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
  const colors = useThemeColors();
  return (
    <Drawer.Navigator
      drawerContent={renderAppDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.mutedForeground,
        drawerActiveBackgroundColor: colors.primaryMuted,
        drawerStyle: {
          backgroundColor: colors.card,
          width: 290,
        },
        drawerItemStyle: {
          borderRadius: 10,
          paddingVertical: 2,
          marginHorizontal: 8,
        },
        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
          marginLeft: -8,
        },
      }}
    >
      <Drawer.Screen
        name="Workspace"
        component={MainTabs}
        options={{
          drawerLabel: "Home",
          drawerIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="BookingHistory"
        component={MyBookingsScreen}
        options={{
          drawerLabel: "Booking History",
          drawerIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          drawerLabel: "Privacy Policy",
          drawerIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{
          drawerLabel: "About Us",
          drawerIcon: ({ color, size }) => <Ionicons name="information-circle-outline" color={color} size={size} />,
        }}
      />
    </Drawer.Navigator>
  );
}

function AuthStackNavigator() {
  const colorScheme = useColorScheme();
  const isDarkTheme = colorScheme === "dark";
  const colors = useThemeColors();

  useEffect(() => {
    StatusBar.setBackgroundColor(colors.background);
  }, [colors.background]);

  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
        statusBarStyle: isDarkTheme ? "light" : "dark",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function AppStackNavigator() {
  const colorScheme = useColorScheme();
  const isDarkTheme = colorScheme === "dark";
  const colors = useThemeColors();

  useEffect(() => {
    StatusBar.setBackgroundColor(colors.background);
  }, [colors.background]);

  return (
    <AppStack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
        statusBarStyle: isDarkTheme ? "light" : "dark",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen name="MainTabs" component={AppDrawerNavigator} />
      <AppStack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <AppStack.Screen name="ContactUs" component={ContactUsScreen} />
      <AppStack.Screen name="SpaceDetail" component={SpaceDetailScreen} />
      <AppStack.Screen name="BookingInfo" component={BookingInfoScreen} />
      <AppStack.Screen name="Payment" component={PaymentScreen} />
    </AppStack.Navigator>
  );
}

export function AppNavigator() {
  const colorScheme = useColorScheme();
  const isDarkTheme = colorScheme === "dark";
  const colors = useThemeColors();

  useEffect(() => {
    StatusBar.setBackgroundColor(colors.background);
  }, [colors.background]);

  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          statusBarTranslucent: false,
          statusBarStyle: isDarkTheme ? "light" : "dark",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <RootStack.Screen name="Splash" component={SplashScreen} />
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="AuthStack" component={AuthStackNavigator} />
        <RootStack.Screen name="AppStack" component={AppStackNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
