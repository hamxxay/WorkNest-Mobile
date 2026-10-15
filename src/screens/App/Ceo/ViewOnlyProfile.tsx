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
import { useAuth, userDisplayName } from "../../../context/AuthContext";
import { logoutUser } from "../../../services/authService";
import { spacing } from "../../../theme";

// Profile of a single-purpose app (CEO, Sales Manager, Access Officer): who is signed in (name and role from the
// database, via auth/me), the locations they see, what the account can do, appearance (System / Light / Dark) and
// sign out. Nothing to edit.

export type ViewOnlyProfileProps = {
  /** Shown when the account has neither a name nor an email (e.g. "CEO"). */
  fallbackName: string;
  /** The locations this person sees, e.g. "All locations" or "I-8, F-7". */
  locations: string;
  /** Under "Sign out?": what signing out means for this app. */
  signOutMessage: string;
  /** The "Access" row: what this account can do. Default "View only" (CEO, Sales Manager). */
  access?: string;
  /** Ionicons name for the "Access" row. Default "eye-outline". */
  accessIcon?: string;
};

export function ViewOnlyProfile({
  fallbackName,
  locations,
  signOutMessage,
  access = "View only",
  accessIcon = "eye-outline",
}: ViewOnlyProfileProps) {
  const { user, roleDisplayLabel, clearSession } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = typeof user?.email === "string" ? user.email : "";
  const displayName = userDisplayName(user, fallbackName);

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
          <InfoRow label="Role" value={roleDisplayLabel} icon="shield-checkmark-outline" />
          {/* A long list of locations wraps under its label. */}
          <InfoRow label="Locations" value={locations} icon="location-outline" layout={locations.length > 24 ? "stacked" : undefined} />
          <InfoRow label="Access" value={access} icon={accessIcon} layout={access.length > 24 ? "stacked" : undefined} />
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
        message={signOutMessage}
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
