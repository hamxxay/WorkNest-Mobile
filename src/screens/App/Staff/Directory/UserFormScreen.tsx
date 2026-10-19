import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FieldShell,
  SectionHeader,
  SelectField,
  StatusPill,
  TextField,
  useConfirm,
  useToast,
} from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import type { UserRole } from "../../../../context/roles";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  assignableLocations,
  canChangeUserStatus,
  canEditUser,
  canManageUsers,
  createUser,
  editsOwnAccountAsAdmin,
  fallbackRoleOptions,
  getCities,
  getRoleOptions,
  isLocationRole,
  locationRoleNames,
  newUserInput,
  PASSWORD_MAX_LENGTH,
  roleOptionLabel,
  rolesICanAssign,
  setUserActive,
  toggleUserLocation,
  updateUser,
  userLocationLocked,
  userToInput,
  validateUserInput,
  withRole,
  type City,
  type RoleOption,
  type UserCaller,
  type UserField,
  type UserFormContext,
  type UserInput,
} from "../../../../services/staff";
import { formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput } from "../../../../utils/phone";
import { spacing } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useSingleFlight } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "UserForm">;

/** Long API messages (e.g. an account turned back on) stay up a little longer than the default toast. */
const toastDuration = (message: string) => (message.length > 60 ? 6000 : undefined);

/**
 * New / edit user (POST user, PUT user/{id}; PATCH user/{id}/activate | deactivate), admin and super admin, as the
 * CMS Users form: full name, email (set when the user is created), password / new password, role (from GET roles,
 * only the ones the signed-in user may give), locations for the location-bound roles (an admin: only their own),
 * phone, CNIC, city, address and notes. Editing your own account as an admin leaves out role and locations. The
 * API's messages are shown as they are.
 */
export default function UserFormScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const confirm = useConfirm();
  const { role: callerRole, profile, locations, locationsLoading, locationsError, reloadProfile } = useStaffSession();
  const { user: me } = useAuth();
  const editing = params?.user ?? null;
  const caller: UserCaller = { role: callerRole, email: profile?.email || me?.email };
  const ownAccount = editsOwnAccountAsAdmin(caller, editing);
  const allowed = canManageUsers(callerRole) && (!editing || canEditUser(caller, editing));

  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(fallbackRoleOptions);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const assignable = useMemo(
    () => assignableLocations(callerRole, profile?.locationIds, locations),
    [callerRole, profile?.locationIds, locations],
  );
  const assignableIds = useMemo(() => assignable.map((l) => l.id), [assignable]);
  const assignableRoles = useMemo(() => rolesICanAssign(callerRole, roleOptions), [callerRole, roleOptions]);
  const locked = userLocationLocked(callerRole, assignableIds);
  const ctx: UserFormContext = useMemo(
    () => ({
      callerRole,
      editing: !!editing,
      ownAccount,
      assignableLocationIds: assignableIds,
      assignableRoles,
      roleOptions,
    }),
    [callerRole, editing, ownAccount, assignableIds, assignableRoles, roleOptions],
  );

  const [form, setForm] = useState<UserInput>(() =>
    editing ? userToInput(editing) : newUserInput(callerRole, assignableIds, profile?.locationId),
  );
  const [errors, setErrors] = useState<Partial<Record<UserField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [active, setActive] = useState(editing?.isActive ?? true);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const cnicRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  useEffect(() => {
    let alive = true;
    // Labels from WN_Roles.DisplayName; the app's own labels stay when the call fails (e.g. before SM_01).
    getRoleOptions()
      .then((options) => alive && setRoleOptions(options))
      .catch(() => undefined)
      .finally(() => alive && setRolesLoading(false));
    getCities()
      .then((list) => alive && setCities(list))
      .catch(() => alive && setCities([]))
      .finally(() => alive && setCitiesLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const clearError = (key: UserField) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (saveError) setSaveError(null);
  };

  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  };

  const pickRole = (role: UserRole) => {
    setForm((prev) => withRole(prev, role, ctx));
    clearError("role");
    clearError("locationIds");
  };

  const pickLocation = (id: number, checked: boolean) => {
    setForm((prev) => toggleUserLocation(prev, id, checked, ctx));
    clearError("locationIds");
  };

  const roleChoices = useMemo(() => assignableRoles.map((r) => ({ label: r.label, value: r.value })), [assignableRoles]);
  const cityOptions = useMemo(() => cities.map((c) => ({ label: c.name, value: c.id })), [cities]);
  const who = editing ? editing.name || editing.email : "";

  const save = useSingleFlight(async () => {
    const found = validateUserInput(form, ctx);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const result = editing ? await updateUser(editing.id, form, ctx) : await createUser(form, ctx);
      toast.success(result.message, { duration: toastDuration(result.message) });
      navigation.goBack();
    } catch (err) {
      // The API's own words, e.g. "Only a Super Admin can ..." or the PW_01 database update note.
      setSaveError(errorMessage(err, editing ? "Could not save the user. Please try again." : "Could not create the user. Please try again."));
    } finally {
      setSaving(false);
    }
  });

  const toggleActive = () => {
    if (!editing) return;
    const next = !active;
    let message = "";
    confirm({
      title: next ? "Activate this user?" : "Deactivate this user?",
      message: next ? `${who} will be able to sign in again.` : `${who} won't be able to sign in until the account is activated again.`,
      confirmLabel: next ? "Activate" : "Deactivate",
      destructive: !next,
      icon: next ? "lock-open-outline" : "lock-closed-outline",
      onConfirm: async () => {
        message = (await setUserActive(editing.id, next)).message;
      },
    }).then(
      (ok) => {
        if (!ok) return;
        setActive(next);
        toast.success(message);
      },
      (err) => toast.error(errorMessage(err, next ? "Could not activate the user." : "Could not deactivate the user.")),
    );
  };

  const title = editing ? "Edit user" : "New user";
  if (!allowed) {
    return (
      <StaffScreen>
        <AppHeader title={title} />
        <EmptyState
          icon="lock-closed-outline"
          title="View only"
          message={
            editing
              ? `Only a ${roleOptionLabel(roleOptions, "super_admin")} can change this account.`
              : "You can't add users."
          }
        />
      </StaffScreen>
    );
  }

  return (
    <StaffScreen>
      <AppHeader title={title} subtitle={editing ? who : undefined} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader title="Account" variant="overline" />
          <Card>
            <View style={styles.form}>
              <TextField
                label="Full name"
                required
                value={form.name}
                onChangeText={(t) => set("name", t)}
                error={errors.name}
                autoCapitalize="words"
                autoComplete="off"
                maxLength={200}
                returnKeyType="next"
                onSubmitEditing={() => (editing ? passwordRef : emailRef).current?.focus()}
              />
              <TextField
                ref={emailRef}
                label="Email address"
                required={!editing}
                value={form.email}
                onChangeText={(t) => set("email", t.trim())}
                error={errors.email}
                disabled={!!editing}
                helperText={editing ? "The sign-in email can't be changed." : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                // Someone else's email: the phone must not suggest the signed-in admin's own.
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                leftIcon="mail-outline"
                maxLength={120}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <TextField
                ref={passwordRef}
                label={editing ? "New password" : "Password"}
                required={!editing}
                value={form.password}
                onChangeText={(t) => set("password", t)}
                error={errors.password}
                // A new password for this user: the password manager must never fill in the signed-in admin's own.
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon="lock-closed-outline"
                maxLength={PASSWORD_MAX_LENGTH}
                placeholder={editing ? "Leave blank to keep the current password" : "At least 6 characters"}
                helperText={
                  editing
                    ? "Type a new password only to change it. The user then signs in with it."
                    : "6 to 128 characters. The user signs in with it."
                }
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
          </Card>

          <SectionHeader title="Role and locations" variant="overline" />
          <Card>
            {ownAccount ? (
              <AppText variant="bodySmall" color="textMuted">
                {`Your own role and locations are set by a ${roleOptionLabel(roleOptions, "super_admin")}.`}
              </AppText>
            ) : (
              <View style={styles.form}>
                <SelectField
                  label="Role"
                  required
                  value={form.role}
                  options={roleChoices}
                  onChange={pickRole}
                  error={errors.role}
                  loading={rolesLoading}
                  leftIcon="shield-outline"
                  placeholder="Choose a role"
                  disabled={saving}
                />
                <LocationChoices
                  role={form.role}
                  roleOptions={roleOptions}
                  locations={assignable}
                  selected={form.locationIds}
                  locked={locked}
                  bound={callerRole !== "super_admin"}
                  loading={locationsLoading}
                  loadError={locationsError}
                  onRetry={reloadProfile}
                  onToggle={pickLocation}
                  error={errors.locationIds}
                  disabled={saving}
                />
              </View>
            )}
          </Card>

          <SectionHeader title="Details" variant="overline" />
          <Card>
            <View style={styles.form}>
              {editing ? (
                <Banner
                  tone="info"
                  message="CNIC, city, address and notes are not shown here. Leave them blank to keep what is saved, or type a new value to replace it."
                />
              ) : null}
              <TextField
                ref={phoneRef}
                label="Phone number"
                value={form.phone}
                onChangeText={(t) => set("phone", formatPhoneInput(t))}
                error={errors.phone}
                keyboardType="phone-pad"
                autoComplete="off"
                leftIcon="call-outline"
                placeholder="03001234567"
                helperText="11 to 15 digits"
                returnKeyType="next"
                onSubmitEditing={() => cnicRef.current?.focus()}
              />
              <TextField
                ref={cnicRef}
                label="CNIC"
                value={form.cnicOrPassport}
                onChangeText={(t) => set("cnicOrPassport", formatCnicInput(t))}
                error={errors.cnicOrPassport}
                keyboardType="number-pad"
                autoComplete="off"
                placeholder="35202-1234567-1"
                helperText="13 digits"
                returnKeyType="next"
                onSubmitEditing={() => addressRef.current?.focus()}
              />
              <SelectField
                label="City"
                value={form.cityId ?? null}
                options={cityOptions}
                onChange={(v) => set("cityId", v)}
                loading={citiesLoading}
                placeholder="Choose a city"
                leftIcon="business-outline"
                emptyText="Cities could not be loaded"
                disabled={saving}
              />
              <TextField
                ref={addressRef}
                label="Address"
                value={form.address}
                onChangeText={(t) => set("address", t)}
                autoComplete="off"
                multiline
                rows={2}
                maxLength={200}
              />
              <TextField
                ref={notesRef}
                label="Notes"
                value={form.notes}
                onChangeText={(t) => set("notes", t)}
                multiline
                rows={3}
                maxLength={500}
              />
            </View>
          </Card>

          {saveError ? <Banner tone="danger" title="Not saved" message={saveError} onDismiss={() => setSaveError(null)} /> : null}
          <Button
            title={editing ? "Save changes" : "Create user"}
            onPress={save}
            loading={saving}
            disabled={saving}
            leftIcon="checkmark"
            fullWidth
          />

          {editing && canChangeUserStatus(caller, editing) ? (
            <>
              <SectionHeader title="Account status" variant="overline" />
              <Card>
                <View style={styles.form}>
                  <View style={styles.statusRow}>
                    <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
                      {active ? "Active: this user can sign in." : "Inactive: this user can't sign in."}
                    </AppText>
                    <StatusPill status={active ? "Active" : "Inactive"} />
                  </View>
                  <Button
                    title={active ? "Deactivate user" : "Activate user"}
                    variant={active ? "dangerOutline" : "outline"}
                    leftIcon={active ? "lock-closed-outline" : "lock-open-outline"}
                    onPress={toggleActive}
                    disabled={saving}
                    fullWidth
                  />
                </View>
              </Card>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </StaffScreen>
  );
}

/**
 * Locations (CMS "user-location-select"): every location for a CEO, none to pick for a role without locations, and
 * tick boxes for the location-bound roles (an admin's single location is ticked and fixed).
 */
function LocationChoices({
  role,
  roleOptions,
  locations,
  selected,
  locked,
  bound,
  loading,
  loadError,
  onRetry,
  onToggle,
  error,
  disabled,
}: {
  role: UserRole;
  roleOptions: readonly RoleOption[];
  locations: readonly { id: number; name: string }[];
  selected: readonly number[];
  locked: boolean;
  bound: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onToggle: (id: number, checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}) {
  if (role === "ceo") {
    const ceo = roleOptionLabel(roleOptions, "ceo");
    return (
      <FieldShell label="Locations">
        <AppText variant="bodySmall" color="textMuted">
          {`All locations. A ${ceo} sees the ${ceo} dashboard for every location, view only.`}
        </AppText>
      </FieldShell>
    );
  }
  if (!isLocationRole(role)) {
    return (
      <FieldShell label="Locations">
        <AppText variant="bodySmall" color="textMuted">
          {`All locations (only the ${locationRoleNames(roleOptions)} roles are limited to specific locations).`}
        </AppText>
      </FieldShell>
    );
  }
  const helperText = locked
    ? "Your location. Users you add work here."
    : bound
    ? "Tick one or more of your locations."
    : "Tick every location they may work in.";
  return (
    <FieldShell label="Locations" required helperText={helperText} error={error}>
      {loadError && !locations.length ? (
        <ErrorState compact message={loadError} onRetry={onRetry} />
      ) : loading && !locations.length ? (
        <AppText variant="bodySmall" color="textMuted">
          Loading locations...
        </AppText>
      ) : !locations.length ? (
        <AppText variant="bodySmall" color="textMuted">
          No locations available.
        </AppText>
      ) : (
        <View style={styles.checks}>
          {locations.map((l) => (
            <Checkbox
              key={l.id}
              label={l.name}
              checked={locked || selected.includes(l.id)}
              onChange={(checked) => onToggle(l.id, checked)}
              disabled={locked || disabled}
            />
          ))}
        </View>
      )}
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
  checks: { gap: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
