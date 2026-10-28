import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type TextInput } from "react-native";
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
  ResponsiveGrid,
  Screen,
  SectionHeader,
  STAT_CARD_MIN_WIDTH,
  StatCard,
  TextField,
  useToast,
} from "../../../components/ui";
import { useTabBarSpace } from "../../../components/ui/TabBar";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { useDoorAccess } from "../../../hooks/useDoorAccess";
import { useAttendanceEnabled } from "../../../hooks/useAttendanceEnabled";
import { updateUserProfile } from "../../../services/authService";
import { errorMessage } from "../../../services/apiClient";
import { getMyBookings, summarizeBookings, type BookingSummary } from "../../../services/bookingService";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";
import { rootNavRef } from "../../../navigation/AppNavigator";
import { AccountSecurityCard } from "../../../components/account/AccountSecurityCard";
import { SignOutButton } from "../../../components/account/SignOutButton";
import type { AppStackParamList } from "../../../navigation/types";
import { stackActions, textScale } from "../../../utils/responsive";
import { useContentWidth } from "./shared/layout";
import { version as appVersion } from "../../../../package.json";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Profile (tab): account details (edit name and phone via PUT /auth/me), booking counts, account and security
 * (change password, delete account), appearance (System / Light / Dark), shortcuts and sign out. Guests get sign in /
 * sign up and the public pages.
 */
export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const tabBarSpace = useTabBarSpace();
  const { user, setUser } = useAuth();
  const bell = useNotificationsAction();
  const doorAccess = useDoorAccess();
  const attendanceEnabled = useAttendanceEnabled();
  const toast = useToast();
  const { fontScale } = useWindowDimensions();
  // Large text: the name and email may take two lines instead of a few letters and "...".
  const identityLines = textScale(fontScale) >= 1.3 ? 2 : 1;
  // Sign in / Create account side by side only when both labels fit (not on a 320dp phone or with large text).
  const stackGuestActions = stackActions(useContentWidth() - 2 * CARD_PADDING, fontScale, ["Sign in", "Create account"], GUEST_ACTIONS_GAP);

  // Same rules as the My Bookings tabs: rejected, no-show and cancelled bookings are never "Upcoming".
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  // Set synchronously: the keyboard's Done key and the Save button can both fire before `saving` re-renders.
  const savingRef = useRef(false);
  const phoneRef = useRef<TextInput>(null);

  const displayName = typeof user?.name === "string" && user.name.trim() ? user.name.trim() : "WorkNest member";
  const email = typeof user?.email === "string" ? user.email : "";
  const userPhone = typeof user?.phoneNumber === "string" ? user.phoneNumber : "";

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      getMyBookings()
        .then((items) => active && setSummary(summarizeBookings(items)))
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
    if (savingRef.current) return;
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Enter your full name.";
    const p = phone.trim() ? phoneError(phone) : null;
    if (p) next.phone = p;
    setErrors(next);
    if (Object.keys(next).length) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await updateUserProfile(name.trim(), phone.trim());
      setUser(updated);
      setEditOpen(false);
      toast.success("Profile updated.");
    } catch (err) {
      setErrors({ form: errorMessage(err, "Your profile could not be saved. Please try again.") });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Signed out: back to the tabs as a guest (Profile then offers sign in / create account).
  const signedOut = () => {
    rootNavRef.current?.reset({ index: 0, routes: [{ name: "AppStack", params: { screen: "MainTabs" } }] });
  };

  // Delete account finished: the account is gone on the server and this device is signed out.
  const accountDeleted = (signInRemoved: boolean) => {
    toast.success(
      signInRemoved
        ? "Your account and personal details have been removed. Thank you for using WorkNest."
        : "Your account and personal details have been removed. Your Google / Firebase sign-in could not be removed right now: signing in again would start a new, empty account.",
      { title: "Account deleted", duration: 6000 },
    );
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <>
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
                  <AppText variant="bodySmall" color="textMuted">
                    {userPhone || "No phone number yet"}
                  </AppText>
                </View>
              </View>
              {/* Sign out sits next to Edit profile, so it is found without scrolling. */}
              <View style={styles.identityActions}>
                <Button title="Edit profile" variant="outline" size="sm" leftIcon="create-outline" onPress={openEdit} />
                <SignOutButton message="You can sign in again any time." onSignedOut={signedOut} />
              </View>
            </Card>

            {summary ? (
              <ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH} maxColumns={2}>
                <StatCard label="Upcoming" value={summary.upcoming} icon="calendar-outline" onPress={() => navigation.navigate("MainTabs", { screen: "Bookings", params: { tab: "upcoming" } })} />
                <StatCard label="Completed" value={summary.completed} tone="success" icon="checkmark-done-outline" onPress={() => navigation.navigate("MainTabs", { screen: "Bookings", params: { tab: "history" } })} />
              </ResponsiveGrid>
            ) : null}

            <SectionHeader title="My account" />
            <Card padding={0}>
              <ListRow
                leftIcon="easel-outline"
                title="My meeting rooms"
                subtitle="Free hours with your private office"
                chevron
                onPress={() => navigation.navigate("MyMeetingRooms")}
              />
              <Divider inset={68} />
              {/* Only when WorkNest has turned attendance on for this customer (attendance/my/status). */}
              {attendanceEnabled ? (
                <>
                  <ListRow
                    leftIcon="finger-print-outline"
                    title="Attendance"
                    subtitle="Your employees' in and out times"
                    chevron
                    onPress={() => navigation.navigate("Attendance")}
                  />
                  <Divider inset={68} />
                </>
              ) : null}
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

            <SectionHeader title="Account and security" />
            <AccountSecurityCard onDeleted={accountDeleted} />
          </>
        ) : (
          <Card>
            <AppText variant="heading">Welcome to WorkNest</AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
              Sign in to book spaces, see your challans and payments, and sign your agreements.
            </AppText>
            <View style={[styles.guestActions, stackGuestActions && styles.guestActionsStacked]}>
              <Button title="Sign in" style={stackGuestActions ? null : styles.flex} onPress={() => navigation.navigate("Login")} />
              <Button
                title="Create account"
                variant="outline"
                style={stackGuestActions ? null : styles.flex}
                onPress={() => navigation.navigate("Signup")}
              />
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

/** Card's default padding and the gap between the guest buttons (dp). */
const CARD_PADDING = 16;
const GUEST_ACTIONS_GAP = 12;

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    identity: { flexDirection: "row", alignItems: "center", gap: t.spacing.lg },
    flex: { flex: 1 },
    top: { marginTop: t.spacing.sm },
    identityActions: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, marginTop: t.spacing.md },
    guestActions: { flexDirection: "row", gap: GUEST_ACTIONS_GAP, marginTop: t.spacing.lg },
    guestActionsStacked: { flexDirection: "column" },
  });
