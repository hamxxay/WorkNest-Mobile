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
import AdminDashboard from "../screens/App/Admin/AdminDashboard";
import CustomerCreateScreen from "../screens/App/Sales/CustomerCreateScreen";
import CustomerListScreen from "../screens/App/Sales/CustomerListScreen";

export type AdminStackParamList = {
  AdminDashboard: undefined;
  CustomerCreate: undefined;
  CustomerList: undefined;
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
    </Stack.Navigator>
  );
}

export default function AdminStack() {
  const colors = useThemeColors();
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
          drawerStyle: { backgroundColor: colors.card, width: 280 },
        }}
      >
        <Drawer.Screen name="Workspace" component={AdminDashboardStack} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
