import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useThemeColors } from "../theme";

// ─── Role-specific stacks ──────────────────────────────────────────────────────
import AdminStack from "./AdminStack";
import SaleStack from "./SaleStack";

// ─── Existing general-user navigator (untouched) ──────────────────────────────
import { AppNavigator } from "./AppNavigator";

// ─── RootNavigator ────────────────────────────────────────────────────────────
//
// This is the single entry point rendered by App.tsx (or index.js).
// It reads `role` from AuthContext — which is already hydrated from secure
// storage / Firebase on app launch — and delegates to the correct stack.
//
// Role routing logic:
//   "admin"            → AdminStack   (admin controls & dashboard)
//   "sales_executive"  → SaleStack    (sales pipeline & quotations)
//   "general" or any
//   unrecognised value → AppNavigator (existing general-user flow, unchanged)
//
// To add a new role in the future:
//   1. Add the role string to UserRole in AuthContext.tsx
//   2. Create a new XxxStack.tsx in /src/navigation/
//   3. Import it here and add a new case in the switch below.
//
export default function RootNavigator() {
  const { role, isLoadingUser } = useAuth();
  const colors = useThemeColors();

  // While the session is being restored from storage, show a minimal spinner
  // so we never flash the wrong stack before the role is known.
  if (isLoadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Role switch ──────────────────────────────────────────────────────────────
  // Each case returns a completely isolated navigator. Navigation between stacks
  // only happens here — never via manual navigation calls elsewhere in the app.
  switch (role) {
    case "admin":
      return <AdminStack />;

    case "sales_executive":
      return <SaleStack />;

    // "general" and any future/unrecognised role safely fall through to the
    // existing general-user navigator, which is never modified by this file.
    default:
      return <AppNavigator />;
  }
}
