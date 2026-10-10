import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { View, Text, useWindowDimensions } from "react-native";
import { useState } from "react";
import { drawerNavRef } from "./AppNavigator";
import { useThemeColors } from "../theme";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../services/authService";
import { ConfirmModal } from "../components/ConfirmModal";
import AdminDashboard from "../screens/App/Admin/AdminDashboard";
import CustomerCreateScreen from "../screens/App/Sales/CustomerCreateScreen";
import CustomerListScreen from "../screens/App/Sales/CustomerListScreen";
import TourInquiriesScreen, { type InquiryFilter } from "../screens/App/Sales/TourInquiriesScreen";
import SaleQuotationListScreen from "../screens/App/Sales/SaleQuotationListScreen";
import SaleBookingListScreen from "../screens/App/Sales/SaleBookingListScreen";
import SaleBookingCreateScreen from "../screens/App/Sales/SaleBookingCreateScreen";
import QuotationScreen from "../screens/App/General/QuotationScreen";
import KycDocumentsScreen from "../screens/App/Sales/KycDocumentsScreen";
import SaleQuotationCreateScreen, {
  type QuotationFromInquiry,
} from "../screens/App/Sales/SaleQuotationCreateScreen";

export type AdminStackParamList = {
  AdminDashboard: undefined;
  CustomerCreate: undefined;
  CustomerList: undefined;
  TourInquiries: { filter?: InquiryFilter } | undefined;
  QuotationCreate: { fromInquiry?: QuotationFromInquiry } | undefined;
  QuotationList: undefined;
  Quotation: { quotationId: string };
  BookingList: undefined;
  BookingCreate: undefined;
  KycDocuments: { customerId: number | string; customerName?: string };
};

const Stack = createNativeStackNavigator<AdminStackParamList>();
const Drawer = createDrawerNavigator();

function AdminDrawerContent(props: any) {
  const colors = useThemeColors();
  const { clearSession } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    setShowLogout(false);
    await logoutUser();
    await clearSession();
  };

  return (
    <>
      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1, paddingTop: 20 }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>Admin</Text>
        </View>
        <DrawerItem
          label="Dashboard"
          labelStyle={{ color: colors.foreground, fontWeight: "600" }}
          onPress={() => {
            props.navigation.closeDrawer();
            props.navigation.navigate("Workspace", { screen: "AdminDashboard" });
          }}
        />
        <DrawerItem
          label="Tour Inquiries"
          labelStyle={{ color: colors.foreground, fontWeight: "600" }}
          onPress={() => {
            props.navigation.closeDrawer();
            props.navigation.navigate("Workspace", { screen: "TourInquiries" });
          }}
        />
        <DrawerItem
          label="Close Menu"
          labelStyle={{ color: colors.mutedForeground, fontWeight: "600" }}
          onPress={() => props.navigation.closeDrawer()}
        />
        <DrawerItem
          label="Log Out"
          labelStyle={{ color: colors.danger, fontWeight: "700" }}
          onPress={() => setShowLogout(true)}
        />
      </DrawerContentScrollView>

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
          });
        }}
      />
    </>
  );
}

function AdminDashboardStack() {
  const colors = useThemeColors();
  return (
    <Stack.Navigator
      initialRouteName="AdminDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="CustomerCreate" component={CustomerCreateScreen} />
      <Stack.Screen name="CustomerList" component={CustomerListScreen} />
      <Stack.Screen name="TourInquiries" component={TourInquiriesScreen} />
      <Stack.Screen name="QuotationCreate" component={SaleQuotationCreateScreen} />
      <Stack.Screen name="QuotationList" component={SaleQuotationListScreen} />
      <Stack.Screen name="Quotation" component={QuotationScreen} />
      <Stack.Screen name="BookingList" component={SaleBookingListScreen} />
      <Stack.Screen name="BookingCreate" component={SaleBookingCreateScreen} />
      <Stack.Screen name="KycDocuments" component={KycDocumentsScreen} />
    </Stack.Navigator>
  );
}

export default function AdminStack() {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions(); // drawer width follows the screen
  return (
    <NavigationContainer
      ref={(ref) => {
        drawerNavRef.set(ref);
      }}
    >
      <Drawer.Navigator
        drawerContent={(props) => <AdminDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: "right",
          drawerType: "front",
          swipeEnabled: true,
          overlayColor: "rgba(0,0,0,0.45)",
          drawerStyle: { backgroundColor: colors.card, width: Math.min(280, Math.round(windowWidth * 0.82)) },
        }}
      >
        <Drawer.Screen name="Workspace" component={AdminDashboardStack} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
