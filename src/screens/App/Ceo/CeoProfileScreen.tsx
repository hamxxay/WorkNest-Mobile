import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  AppHeader,
  AppText,
  AppearanceSetting,
  Avatar,
  Card,
  ConfirmDialog,
  Divider,
  HapticsSetting,
  InfoRow,
  ListRow,
  Screen,
  SectionHeader,
} from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { roleLabel } from "../../../context/roles";
import { logoutUser } from "../../../services/authService";
import { spacing } from "../../../theme";

/**
 * CEO profile: who is signed in, the role (view only, every location), appearance (System / Light / Dark) and sign
 * out. Nothing to edit here: the CEO app is read-only.
 */
export default function CeoProfileScreen() {
  const { user, role, clearSession } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = (typeof user?.name === "string" && user.name.trim()) || "";
  const email = typeof user?.email === "string" ? user.email : "";
  const displayName = name || email || "CEO";

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutUser();
    } catch {
      // Google / Firebase sign-out can fail offline; the local session is still ended below.
    } finally {
      await clearSession();
    }
  };

  return (
    <Screen>
      <AppHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.identity}>
            <Avatar name={displayName} size={56} />
            <View style={styles.flex}>
              <AppText variant="heading" numberOfLines={1}>
                {displayName}
              </AppText>
              {email && email !== displayName ? (
                <AppText variant="bodySmall" color="textMuted" numberOfLines={1}>
                  {email}
                </AppText>
              ) : null}
            </View>
          </View>
          <Divider spacing={12} />
          <InfoRow label="Role" value={roleLabel(role)} icon="shield-checkmark-outline" />
          <InfoRow label="Locations" value="All locations" icon="location-outline" />
          <InfoRow label="Access" value="View only" icon="eye-outline" />
        </Card>

        <SectionHeader title="Appearance" variant="overline" />
        <Card>
          <AppearanceSetting />
          <Divider spacing={12} />
          <HapticsSetting />
        </Card>

        <Card padding={0}>
          <ListRow
            leftIcon="log-out-outline"
            title={signingOut ? "Signing out..." : "Sign out"}
            destructive
            disabled={signingOut}
            chevron={false}
            onPress={() => setConfirmSignOut(true)}
          />
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You will need to sign in again to see the CEO dashboard."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        icon="log-out-outline"
        loading={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
