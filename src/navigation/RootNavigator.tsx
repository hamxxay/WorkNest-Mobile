import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useThemeColors } from "../theme";

// ─── Staff navigators (one per role, all built by ./staff/StaffNavigator) ─────
import SaleStack from "./SaleStack";
import AdminStack from "./AdminStack";
import SuperAdminStack from "./staff/SuperAdminStack";

// ─── Customer navigator ───────────────────────────────────────────────────────
import { AppNavigator } from "./AppNavigator";

// ─── RootNavigator ────────────────────────────────────────────────────────────
//
// The single entry point rendered by App.tsx. It reads `role` from AuthContext (hydrated from storage /
// Firebase on launch and refreshed from GET auth/me) and shows that role's navigator:
//
//   "super_admin"      → SuperAdminStack
//   "admin"            → AdminStack
//   "sales_executive"  → SaleStack
//   "general" or any unrecognised role (incl. receptionist) → AppNavigator (customer app)
//
// Staff sign in from the customer app's Login screen; once the role is known this switches navigator. Signing
// out clears the user, so the role becomes "general" and the customer app shows again.
export default function RootNavigator() {
  const { role, isLoadingUser, user } = useAuth();
  const colors = useThemeColors();

  // Push notifications for every signed-in role (customers and staff): registers the FCM token at
  // POST /mobile/device-token after sign-in ([Authorize], any role) and deletes it on sign-out. Lives here, above
  // the per-role navigators, so switching navigator on sign-in / sign-out never skips either step.
  usePushNotifications(typeof user?.email === "string" ? user.email : null);

  // While the session is being restored from storage, show a minimal spinner
  // so we never flash the wrong navigator before the role is known.
  if (isLoadingUser) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // `key` makes a role change mount a fresh navigator (no screens or state carried across roles).
  switch (role) {
    case "super_admin":
      return <SuperAdminStack key="super_admin" />;

    case "admin":
      return <AdminStack key="admin" />;

    case "sales_executive":
      return <SaleStack key="sales_executive" />;

    default:
      return <AppNavigator />;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
