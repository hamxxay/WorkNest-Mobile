import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { View, Text } from "react-native";
import { useState } from "react";
import { drawerNavRef } from "./AppNavigator";
import { useThemeColors } from "../theme";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../services/authService";
import { ConfirmModal } from "../components/ConfirmModal";
import SaleDashboard from "../screens/App/Sales/SaleDashboard";
import CustomerCreateScreen from "../screens/App/Sales/CustomerCreateScreen";
import CustomerListScreen from "../screens/App/Sales/CustomerListScreen";
import SaleQuotationCreateScreen from "../screens/App/Sales/SaleQuotationCreateScreen";
import SaleQuotationListScreen from "../screens/App/Sales/SaleQuotationListScreen";
import SaleBookingCreateScreen from "../screens/App/Sales/SaleBookingCreateScreen";
import SaleBookingListScreen from "../screens/App/Sales/SaleBookingListScreen";

export type SaleStackParamList = {
  SaleDashboard: undefined;
  CustomerCreate: undefined;
  CustomerList: undefined;
  QuotationCreate: undefined;
  QuotationList: undefined;
  BookingCreate: undefined;
  BookingList: undefined;
};

const Stack = createNativeStackNavigator<SaleStackParamList>();
const Drawer = createDrawerNavigator();

function SaleDrawerContent(props: any) {
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
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>Sales</Text>
        </View>
        <DrawerItem
          label="Dashboard"
          labelStyle={{ color: colors.foreground, fontWeight: "600" }}
          onPress={() => {
            props.navigation.closeDrawer();
            props.navigation.navigate("Workspace", { screen: "SaleDashboard" });
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

function SaleDashboardStack() {
  const colors = useThemeColors();
  return (
    <Stack.Navigator
      initialRouteName="SaleDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SaleDashboard" component={SaleDashboard} />
      <Stack.Screen name="CustomerCreate" component={CustomerCreateScreen} />
      <Stack.Screen name="CustomerList" component={CustomerListScreen} />
      <Stack.Screen name="QuotationCreate" component={SaleQuotationCreateScreen} />
      <Stack.Screen name="QuotationList" component={SaleQuotationListScreen} />
      <Stack.Screen name="BookingCreate" component={SaleBookingCreateScreen} />
      <Stack.Screen name="BookingList" component={SaleBookingListScreen} />
    </Stack.Navigator>
  );
}

export default function SaleStack() {
  const colors = useThemeColors();
  return (
    <NavigationContainer
      ref={(ref) => {
        drawerNavRef.set(ref);
      }}
    >
      <Drawer.Navigator
        drawerContent={(props) => <SaleDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: "right",
          drawerType: "front",
          swipeEnabled: true,
          overlayColor: "rgba(0,0,0,0.45)",
          drawerStyle: { backgroundColor: colors.card, width: 280 },
        }}
      >
        <Drawer.Screen name="Workspace" component={SaleDashboardStack} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
