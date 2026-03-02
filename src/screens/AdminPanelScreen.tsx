import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AdminDashboardScreen from "./AdminDashboardScreen";
import AdminUsersScreen from "./AdminUsersScreen";
import AdminManageScreen, { type AdminEntity } from "./AdminManageScreen";
import { colors, radii } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";

type AdminView = "dashboard" | "users" | AdminEntity;

const menuItems: { key: AdminView; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "analytics-outline" },
  { key: "users", label: "Users", icon: "people-outline" },
  { key: "locations", label: "Locations", icon: "location-outline" },
  { key: "space-types", label: "Space Types", icon: "layers-outline" },
  { key: "spaces", label: "Spaces", icon: "business-outline" },
  { key: "bookings", label: "Bookings", icon: "calendar-outline" },
  { key: "pricing", label: "Pricing Plans", icon: "pricetags-outline" },
  { key: "memberships", label: "Memberships", icon: "person-add-outline" },
  { key: "payments", label: "Payments", icon: "card-outline" },
  { key: "contacts", label: "Contacts", icon: "mail-outline" },
  { key: "gallery", label: "Gallery", icon: "images-outline" },
];

export default function AdminPanelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clearSession } = useAuth();
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const activeItem = useMemo(
    () => menuItems.find((item) => item.key === activeView),
    [activeView]
  );

  const handleLogout = async () => {
    await logoutUser();
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.iconChip}>
            <Ionicons name={activeItem?.icon ?? "settings-outline"} size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.topTitle}>Admin Panel</Text>
            <Text style={styles.topSubtitle}>{activeItem?.label ?? "Dashboard"}</Text>
          </View>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.background} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.contentCard}>
          {activeView === "dashboard" ? <AdminDashboardScreen embedded /> : null}
          {activeView === "users" ? <AdminUsersScreen embedded /> : null}
          {activeView !== "dashboard" && activeView !== "users" ? (
            <AdminManageScreen entity={activeView} embedded />
          ) : null}
        </View>

        <View style={styles.bottomNavWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bottomNavList}
          >
            {menuItems.map((item) => {
              const active = activeView === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.bottomItem, active && styles.bottomItemActive]}
                  onPress={() => setActiveView(item.key)}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={active ? colors.background : colors.mutedForeground}
                  />
                  <Text style={[styles.bottomItemText, active && styles.bottomItemTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f3f6f9",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconChip: {
    minWidth: 36,
    height: 36,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8f7f6",
  },
  topTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  topSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f172a",
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  contentCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  bottomNavWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
    paddingVertical: 8,
  },
  bottomNavList: {
    paddingHorizontal: 8,
    gap: 8,
  },
  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  bottomItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bottomItemText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomItemTextActive: {
    color: colors.background,
  },
});
