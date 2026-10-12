import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "../../../context/AuthContext";
import { roleLabel } from "../../../context/roles";
import { logoutUser } from "../../../services/authService";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { useThemeColors, useThemedStyles, type AppColors } from "../../../theme";

// Staff profile: who is signed in, with which role, and sign out. Stage 2 adds editing name / phone
// (PUT auth/me, as the CMS profile page does) and restyles it with the UI kit.
export default function StaffProfileScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { user, role, clearSession } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = (typeof user?.name === "string" && user.name.trim()) || user?.email?.split("@")[0] || "Staff";

  const signOut = async () => {
    setConfirmVisible(false);
    setSigningOut(true);
    try {
      await logoutUser();
    } finally {
      // Always end the local session, even if Google / Firebase sign-out failed.
      await clearSession();
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
        <Text style={styles.name}>{name}</Text>
        {user?.email ? <Text style={styles.detail}>{user.email}</Text> : null}
        <Text style={styles.role}>{roleLabel(role)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        disabled={signingOut}
        android_ripple={{ color: colors.dangerMuted }}
        style={[styles.signOut, signingOut && styles.disabled]}
        onPress={() => setConfirmVisible(true)}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>{signingOut ? "Signing out..." : "Sign out"}</Text>
      </Pressable>

      <ConfirmModal
        visible={confirmVisible}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmText="Sign out"
        cancelText="Cancel"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          signOut().catch(() => setSigningOut(false));
        }}
      />
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 16 },
    card: {
      alignItems: "center",
      gap: 4,
      padding: 20,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    name: { color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 6 },
    detail: { color: colors.mutedForeground, fontSize: 14 },
    role: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 4 },
    signOut: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.card,
    },
    disabled: { opacity: 0.6 },
    signOutText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
  });
