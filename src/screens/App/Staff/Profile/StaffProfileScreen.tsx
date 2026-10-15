import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import {
  AppHeader,
  AppText,
  AppearanceSetting,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  HapticsSetting,
  InfoRow,
  ListRow,
  SectionHeader,
  TextField,
  useToast,
} from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import { userRoleLabel } from "../../../../context/userDisplay";
import { errorMessage } from "../../../../services/apiClient";
import { logoutUser } from "../../../../services/authService";
import { updateStaffProfile } from "../../../../services/staff";
import { formatPhoneInput, phoneError } from "../../../../utils/phone";
import { spacing } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useSingleFlight } from "../shared/hooks";
import { AccountSecurityCard } from "../../../../components/account/AccountSecurityCard";

/**
 * Staff profile: name and phone (PUT auth/me, as the CMS profile page), role and assigned locations, appearance
 * (System / Light / Dark) and sign out.
 */
export default function StaffProfileScreen() {
  const toast = useToast();
  const { user, setUser, clearSession } = useAuth();
  const { role, profile, locations, reloadProfile } = useStaffSession();
  const phoneRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
  }, [profile]);

  const displayName = profile?.name || (typeof user?.name === "string" ? user.name : "") || user?.email || "Staff";
  const email = profile?.email || user?.email || "";
  const dirty = !!profile && (name.trim() !== profile.name || (phone.trim() || "") !== (profile.phone ?? ""));

  const assigned = useMemo(() => {
    if (!profile || profile.locationIds.length === 0) return role === "super_admin" ? "All locations" : "Not assigned";
    const names = profile.locationIds.map((id) => locations.find((l) => l.id === id)?.name ?? `Location ${id}`);
    return names.join(", ");
  }, [profile, locations, role]);

  // Reachable from the button and the phone field's "done" key: one save at a time, and only with changes.
  const save = useSingleFlight(async () => {
    if (!dirty) return;
    const next: { name?: string; phone?: string } = {};
    if (!name.trim()) next.name = "Name is required.";
    const pErr = phone.trim() ? phoneError(phone) : null;
    if (pErr) next.phone = pErr;
    setErrors(next);
    if (next.name || next.phone) return;
    setSaving(true);
    try {
      const result = await updateStaffProfile({ name, phone });
      if (user) setUser({ ...user, name: result.data.name || name.trim() });
      reloadProfile();
      toast.success(result.message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save your profile. Please try again."));
    } finally {
      setSaving(false);
    }
  });

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
    <StaffScreen>
      <AppHeader title="Profile" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={styles.identity}>
              <Avatar name={displayName} size={56} />
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={1}>
                  {displayName}
                </AppText>
                {email ? (
                  <AppText variant="bodySmall" color="textMuted" numberOfLines={1}>
                    {email}
                  </AppText>
                ) : null}
              </View>
            </View>
            <Divider spacing={12} />
            <InfoRow label="Role" value={userRoleLabel(user, role)} icon="shield-checkmark-outline" />
            <InfoRow label="Locations" value={assigned} icon="location-outline" layout="stacked" />
          </Card>

          <SectionHeader title="Your details" variant="overline" />
          <Card>
            <View style={styles.form}>
              <TextField
                label="Name"
                required
                value={name}
                onChangeText={setName}
                error={errors.name}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                maxLength={200}
              />
              <TextField
                ref={phoneRef}
                label="Phone"
                value={phone}
                onChangeText={(t) => setPhone(formatPhoneInput(t))}
                error={errors.phone}
                keyboardType="phone-pad"
                placeholder="03001234567"
                helperText="11 to 15 digits"
                returnKeyType="done"
                onSubmitEditing={save}
              />
              <Button title="Save changes" onPress={save} loading={saving} disabled={!dirty || saving} leftIcon="checkmark" />
            </View>
          </Card>

          <SectionHeader title="Account" variant="overline" />
          <AccountSecurityCard />

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
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You will need to sign in again to use the staff app."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        icon="log-out-outline"
        loading={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={signOut}
      />
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  form: { gap: spacing.lg },
});
