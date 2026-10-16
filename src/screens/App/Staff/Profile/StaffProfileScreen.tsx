import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type TextInput } from "react-native";
import {
  AppHeader,
  AppText,
  AppearanceSetting,
  Avatar,
  Button,
  Card,
  Divider,
  HapticsSetting,
  InfoRow,
  SectionHeader,
  TextField,
  useToast,
} from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import { userRoleLabel } from "../../../../context/userDisplay";
import { errorMessage } from "../../../../services/apiClient";
import { assignedLocationsLabel, updateStaffProfile } from "../../../../services/staff";
import { formatPhoneInput, phoneError } from "../../../../utils/phone";
import { spacing } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useSingleFlight } from "../shared/hooks";
import { AccountSecurityCard } from "../../../../components/account/AccountSecurityCard";
import { SignOutButton } from "../../../../components/account/SignOutButton";
import { textScale } from "../../../../utils/responsive";

/**
 * Staff profile: name and phone (PUT auth/me, as the CMS profile page), role and assigned locations, appearance
 * (System / Light / Dark) and sign out (at the top, under who is signed in).
 */
export default function StaffProfileScreen() {
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { role, profile, locations, reloadProfile } = useStaffSession();
  const phoneRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
  }, [profile]);

  const displayName = profile?.name || (typeof user?.name === "string" ? user.name : "") || user?.email || "Staff";
  const email = profile?.email || user?.email || "";
  const dirty = !!profile && (name.trim() !== profile.name || (phone.trim() || "") !== (profile.phone ?? ""));

  const assigned = useMemo(() => assignedLocationsLabel(role, profile?.locationIds, locations), [profile, locations, role]);

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

  // Large text: the name and email may take two lines instead of a few letters and "...".
  const identityLines = textScale(useWindowDimensions().fontScale) >= 1.3 ? 2 : 1;

  return (
    <StaffScreen>
      <AppHeader title="Profile" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={styles.identity}>
              <Avatar name={displayName} size={56} />
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={identityLines}>
                  {displayName}
                </AppText>
                {email ? (
                  <AppText variant="bodySmall" color="textMuted" numberOfLines={identityLines}>
                    {email}
                  </AppText>
                ) : null}
              </View>
            </View>
            <Divider spacing={12} />
            <InfoRow label="Role" value={userRoleLabel(user, role)} icon="shield-checkmark-outline" />
            <InfoRow label="Locations" value={assigned} icon="location-outline" layout="stacked" />
            <SignOutButton message="You will need to sign in again to use the staff app." style={styles.signOut} />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  form: { gap: spacing.lg },
  signOut: { alignSelf: "flex-start", marginTop: spacing.md },
});
