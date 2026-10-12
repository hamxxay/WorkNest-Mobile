import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppearanceSetting,
  AppHeader,
  AppText,
  Avatar,
  BottomSheet,
  Button,
  Card,
  Divider,
  HapticsSetting,
  ListRow,
  Screen,
  SectionHeader,
  StatCard,
  TextField,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { useDoorAccess } from "../../../hooks/useDoorAccess";
import { logoutUser, updateUserProfile } from "../../../services/authService";
import { errorMessage } from "../../../services/apiClient";
import { getMyBookings, type MyBooking } from "../../../services/bookingService";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";
import { rootNavRef } from "../../../navigation/AppNavigator";
import type { AppStackParamList } from "../../../navigation/types";
import { version as appVersion } from "../../../../package.json";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Summary = { upcoming: number; completed: number; cancelled: number };

function summarize(bookings: MyBooking[]): Summary {
  const now = Date.now();
  return bookings.reduce<Summary>(
    (acc, b) => {
      const status = b.status.toLowerCase();
      if (status.includes("cancel")) acc.cancelled += 1;
      else if (status.includes("complet") || (b.endOn && new Date(b.endOn).getTime() < now)) acc.completed += 1;
      else acc.upcoming += 1;
      return acc;
    },
    { upcoming: 0, completed: 0, cancelled: 0 },
  );
}

/**
 * Profile (tab): account details (edit name and phone via PUT /auth/me), booking counts, appearance
 * (System / Light / Dark), shortcuts and sign out. Guests get sign in / sign up and the public pages.
 */
export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user, setUser, clearSession } = useAuth();
  const bell = useNotificationsAction();
  const doorAccess = useDoorAccess();
  const toast = useToast();
  const confirm = useConfirm();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef<TextInput>(null);

  const displayName = typeof user?.name === "string" && user.name.trim() ? user.name.trim() : "WorkNest member";
  const email = typeof user?.email === "string" ? user.email : "";
  const userPhone = typeof user?.phoneNumber === "string" ? user.phoneNumber : "";

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      getMyBookings()
        .then((items) => active && setSummary(summarize(items)))
        .catch(() => {
          // Counts stay hidden; Bookings shows the error with a retry.
        });
      return () => {
        active = false;
      };
    }, [user]),
  );

  const openEdit = () => {
    setName(displayName === "WorkNest member" ? "" : displayName);
    setPhone(userPhone);
    setErrors({});
    setEditOpen(true);
  };

  const saveProfile = async () => {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Enter your full name.";
    const p = phone.trim() ? phoneError(phone) : null;
    if (p) next.phone = p;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const updated = await updateUserProfile(name.trim(), phone.trim());
      setUser(updated);
      setEditOpen(false);
      toast.success("Profile updated.");
    } catch (err) {
      setErrors({ form: errorMessage(err, "Your profile could not be saved. Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      message: "You can sign in again any time.",
      confirmLabel: "Sign out",
      destructive: true,
      icon: "log-out-outline",
      onConfirm: async () => {
        await logoutUser();
        await clearSession();
      },
    }).catch(() => true);
    if (!ok) return;
    rootNavRef.current?.reset({ index: 0, routes: [{ name: "AppStack", params: { screen: "MainTabs" } }] });
  };

  const exploreRows = (
    <Card padding={0}>
      <ListRow leftIcon="images-outline" title="Gallery" chevron onPress={() => navigation.navigate("Gallery")} />
      <Divider inset={68} />
      <ListRow leftIcon="walk-outline" title="Book a tour" chevron onPress={() => navigation.navigate("BookTour")} />
      <Divider inset={68} />
      <ListRow leftIcon="chatbubble-ellipses-outline" title="Contact us" chevron onPress={() => navigation.navigate("ContactUs")} />
      <Divider inset={68} />
      <ListRow leftIcon="information-circle-outline" title="About WorkNest" chevron onPress={() => navigation.navigate("AboutUs")} />
      <Divider inset={68} />
      <ListRow leftIcon="book-outline" title="User manual" chevron onPress={() => navigation.navigate("UserManual")} />
      <Divider inset={68} />
      <ListRow leftIcon="shield-checkmark-outline" title="Privacy policy" chevron onPress={() => navigation.navigate("PrivacyPolicy")} />
    </Card>
  );

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader variant="brand" title="Profile" actions={bell} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {user ? (
          <>
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
                  <AppText variant="bodySmall" color="textMuted">
                    {userPhone || "No phone number yet"}
                  </AppText>
                </View>
              </View>
              <Button title="Edit profile" variant="outline" size="sm" leftIcon="create-outline" style={styles.editBtn} onPress={openEdit} />
            </Card>

            {summary ? (
              <View style={styles.stats}>
                <StatCard label="Upcoming" value={summary.upcoming} icon="calendar-outline" onPress={() => navigation.navigate("MainTabs", { screen: "Bookings", params: { tab: "upcoming" } })} />
                <StatCard label="Completed" value={summary.completed} tone="success" icon="checkmark-done-outline" onPress={() => navigation.navigate("MainTabs", { screen: "Bookings", params: { tab: "history" } })} />
              </View>
            ) : null}

            <SectionHeader title="My account" />
            <Card padding={0}>
              <ListRow leftIcon="document-text-outline" title="My quotations" chevron onPress={() => navigation.navigate("QuotationList")} />
              <Divider inset={68} />
              <ListRow leftIcon="notifications-outline" title="Notifications" chevron onPress={() => navigation.navigate("Notifications")} />
              <Divider inset={68} />
              {doorAccess?.canOpenDoor ? (
                <ListRow
                  leftIcon="lock-open-outline"
                  title="Unlock door"
                  subtitle={doorAccess.selectedSpace?.spaceName ?? undefined}
                  chevron
                  onPress={() => navigation.navigate("UnlockDoor")}
                />
              ) : (
                <ListRow
                  leftIcon="key-outline"
                  title="Access request"
                  subtitle="Verify your access to unlock your room door"
                  chevron
                  onPress={() => navigation.navigate("AccessRequest")}
                />
              )}
            </Card>
          </>
        ) : (
          <Card>
            <AppText variant="heading">Welcome to WorkNest</AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
              Sign in to book spaces, see your challans and payments, and sign your agreements.
            </AppText>
            <View style={styles.guestActions}>
              <Button title="Sign in" style={styles.flex} onPress={() => navigation.navigate("Login")} />
              <Button title="Create account" variant="outline" style={styles.flex} onPress={() => navigation.navigate("Signup")} />
            </View>
          </Card>
        )}

        <SectionHeader title="Appearance" />
        <Card>
          <AppearanceSetting />
          <Divider spacing={12} />
          <HapticsSetting />
        </Card>

        <SectionHeader title="WorkNest" />
        {exploreRows}

        {user ? (
          <Card padding={0}>
            <ListRow leftIcon="log-out-outline" title="Sign out" destructive onPress={signOut} />
          </Card>
        ) : null}

        <AppText variant="caption" color="textMuted" align="center">
          Version {appVersion}
        </AppText>
      </ScrollView>

      <BottomSheet
        visible={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        dismissible={!saving}
        title="Edit profile"
        footer={
          <>
            <Button title="Cancel" variant="outline" style={styles.flex} disabled={saving} onPress={() => setEditOpen(false)} />
            <Button title="Save" style={styles.flex} loading={saving} onPress={saveProfile} />
          </>
        }
      >
        <TextField
          label="Full name"
          required
          value={name}
          onChangeText={(v) => {
            setName(v);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
          error={errors.name}
        />
        <TextField
          ref={phoneRef}
          label="Phone"
          value={phone}
          onChangeText={(v) => {
            setPhone(formatPhoneInput(v));
            setErrors((e) => ({ ...e, phone: undefined }));
          }}
          keyboardType="phone-pad"
          maxLength={PHONE_MAX_LENGTH}
          autoComplete="tel"
          returnKeyType="done"
          onSubmitEditing={saveProfile}
          error={errors.phone}
          placeholder="03001234567"
        />
        <TextField label="Email" value={email} disabled helperText="Your sign-in email can't be changed here." />
        {errors.form ? (
          <AppText variant="bodySmall" color="danger">
            {errors.form}
          </AppText>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    identity: { flexDirection: "row", alignItems: "center", gap: t.spacing.lg },
    flex: { flex: 1 },
    top: { marginTop: t.spacing.sm },
    editBtn: { alignSelf: "flex-start", marginTop: t.spacing.md },
    stats: { flexDirection: "row", gap: t.spacing.md },
    guestActions: { flexDirection: "row", gap: t.spacing.md, marginTop: t.spacing.lg },
  });
