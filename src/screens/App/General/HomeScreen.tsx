import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  InfoRow,
  ListRow,
  ListSkeleton,
  ResponsiveGrid,
  Screen,
  SectionHeader,
  StatusPill,
  greeting,
} from "../../../components/ui";
import { ChatBot } from "../../../components/ChatBot";
import { ScalePressable } from "../../../components/motion";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useDoorAccess } from "../../../hooks/useDoorAccess";
import { useAttendanceEnabled } from "../../../hooks/useAttendanceEnabled";
import { useUnlockRoomDoor } from "../../../hooks/useUnlockRoomDoor";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import { getWorkspaces, type Workspace } from "../../../services/workspaceService";
import { getMyBookings, isChallanToPay, type MyBooking } from "../../../services/bookingService";
import { SPACE_CARD_MIN_WIDTH, WorkspaceCard } from "../../Home/WorkspaceCard";
import { TitleRow } from "./shared/TitleRow";
import type { AppStackParamList } from "../../../navigation/types";
import { useTabBarSpace } from "../../../components/ui/TabBar";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** How many space cards Home shows before "See all". */
const HOME_SPACES = 4;

/**
 * Narrowest a quick-action tile gets at the default font size (dp): two per row on phones (one on a 320dp phone or
 * with large text on a narrow one), four on tablets and unfolded foldables.
 */
const QUICK_TILE_MIN_WIDTH = 148;

type QuickAction = { key: string; label: string; icon: string; onPress: () => void; busy?: boolean };

/** Home reloads the space cards when it comes back into view, at most this often. */
const SPACES_REFRESH_MS = 15000;

/**
 * Customer home: the challan waiting to be paid (if any), quick actions and the spaces open for booking.
 */
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tabBarSpace = useTabBarSpace();
  const { user } = useAuth();
  const bell = useNotificationsAction();
  const doorAccess = useDoorAccess();
  const attendanceEnabled = useAttendanceEnabled();
  const { unlock, unlocking } = useUnlockRoomDoor(doorAccess);

  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState("");
  const [pendingChallan, setPendingChallan] = useState<MyBooking | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);

  // When the spaces were last loaded: coming back to Home reloads them (availability changes as people book),
  // but not more often than SPACES_REFRESH_MS.
  const spacesLoadedAt = useRef(0);
  const loadSpaces = useCallback(async () => {
    spacesLoadedAt.current = Date.now();
    setSpacesError("");
    try {
      setSpaces(await getWorkspaces());
    } catch (err) {
      spacesLoadedAt.current = 0;
      setSpacesError(errorMessage(err, "Spaces could not be loaded. Please try again."));
    } finally {
      setSpacesLoading(false);
    }
  }, []);

  // The newest Pending booking whose challan can still be paid: never a cancelled, rejected or no-show booking,
  // an expired challan or one the API reports as paid (signed-in customers only).
  const loadPendingChallan = useCallback(async () => {
    if (!user) {
      setPendingChallan(null);
      return;
    }
    try {
      const bookings = await getMyBookings();
      setPendingChallan(bookings.find((b) => !!b.challanNumber && isChallanToPay(b)) ?? null);
    } catch {
      // Home stays usable; My Bookings shows the error with a retry.
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - spacesLoadedAt.current > SPACES_REFRESH_MS) loadSpaces();
      loadPendingChallan();
    }, [loadSpaces, loadPendingChallan]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSpaces(), loadPendingChallan()]);
    setRefreshing(false);
  };

  // Guests sign in first and then land on the screen they asked for.
  const requireSignIn = (screen: "AccessRequest" | "QuotationList") => () =>
    user ? navigation.navigate(screen) : navigation.navigate("Login", { redirectAfterLogin: { screen } });

  const quickActions: QuickAction[] = [
    { key: "book", label: "Book a space", icon: "calendar-outline", onPress: () => navigation.navigate("Spaces") },
    { key: "tour", label: "Book a tour", icon: "walk-outline", onPress: () => navigation.navigate("BookTour") },
    doorAccess?.canOpenDoor
      ? { key: "unlock", label: unlocking ? "Unlocking" : "Unlock door", icon: "lock-open-outline", onPress: unlock, busy: unlocking }
      : {
          key: "access",
          label: "Access request",
          icon: "key-outline",
          onPress: requireSignIn("AccessRequest"),
        },
    {
      key: "quotes",
      label: "Quotations",
      icon: "document-text-outline",
      onPress: requireSignIn("QuotationList"),
    },
  ];

  const firstName = typeof user?.name === "string" ? user.name.trim().split(/\s+/)[0] : "";

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader
        variant="brand"
        overline={greeting()}
        title={firstName || "Welcome to WorkNest"}
        actions={
          user
            ? bell
            : [{ icon: "log-in-outline", accessibilityLabel: "Sign in", onPress: () => navigation.navigate("Login") }]
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setChatVisible(false)}
        onScrollEndDrag={() => setChatVisible(true)}
        onMomentumScrollEnd={() => setChatVisible(true)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surfaceRaised}
          />
        }
      >
        {pendingChallan ? (
          <Card>
            <TitleRow
              title="Challan to pay"
              variant="overline"
              color="textMuted"
              right={<StatusPill status={pendingChallan.status} />}
            />
            <AppText variant="heading" style={styles.top}>
              {pendingChallan.spaceName}
            </AppText>
            <InfoRow label="Challan no." value={pendingChallan.challanNumber ?? ""} />
            {pendingChallan.challanValidUntil ? (
              <InfoRow label="Pay before" value={formatDate(pendingChallan.challanValidUntil)} />
            ) : null}
            {/* The challan's total payable; when the API did not send it, the challan screen shows it. */}
            <InfoRow
              label="Amount"
              value={pendingChallan.totalPayable !== null ? formatMoney(pendingChallan.totalPayable) : "See challan"}
              emphasize
            />
            <Button
              title="View challan"
              leftIcon="document-text-outline"
              style={styles.top}
              onPress={() =>
                navigation.navigate("Challan", {
                  bookingId: pendingChallan.id,
                  challanNumber: pendingChallan.challanNumber ?? undefined,
                })
              }
            />
          </Card>
        ) : null}

        <ResponsiveGrid minItemWidth={QUICK_TILE_MIN_WIDTH} maxColumns={4}>
          {quickActions.map((action) => (
            <ScalePressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ busy: !!action.busy }}
              disabled={action.busy}
              onPress={action.onPress}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                {action.busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name={action.icon} size={22} color={colors.onPrimarySoft} />
                )}
              </View>
              <AppText variant="label" numberOfLines={2} style={styles.quickLabel}>
                {action.label}
              </AppText>
            </ScalePressable>
          ))}
        </ResponsiveGrid>

        <SectionHeader
          title="Spaces open for booking"
          actionLabel={spaces.length > HOME_SPACES ? "See all" : undefined}
          onAction={() => navigation.navigate("Spaces")}
        />
        {spacesLoading ? (
          <ListSkeleton rows={2} />
        ) : spacesError ? (
          <ErrorState message={spacesError} onRetry={loadSpaces} compact />
        ) : spaces.length === 0 ? (
          <EmptyState
            compact
            illustration="building"
            title="No spaces open right now"
            message="Book a tour and our team will show you what fits."
            actionLabel="Book a tour"
            onAction={() => navigation.navigate("BookTour")}
          />
        ) : (
          <View style={styles.list}>
            {/* One card per row on phones, two on tablets and unfolded foldables. */}
            <ResponsiveGrid minItemWidth={SPACE_CARD_MIN_WIDTH} maxColumns={2} stretchLastRow={false}>
              {spaces.slice(0, HOME_SPACES).map((ws) => (
                <WorkspaceCard
                  key={`${ws.id}-${ws.location}-${ws.type}`}
                  workspace={ws}
                  style={styles.fillCell}
                  onPress={() => navigation.navigate("SpaceDetail", { workspace: ws })}
                />
              ))}
            </ResponsiveGrid>
            {spaces.length > HOME_SPACES ? (
              <Button
                title={`See all ${spaces.length} spaces`}
                variant="outline"
                rightIcon="chevron-forward"
                onPress={() => navigation.navigate("Spaces")}
              />
            ) : null}
          </View>
        )}

        <SectionHeader title="Explore WorkNest" />
        <Card padding={0}>
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
          <ListRow leftIcon="images-outline" title="Gallery" subtitle="Photos of our spaces" chevron onPress={() => navigation.navigate("Gallery")} />
          <Divider inset={68} />
          <ListRow leftIcon="information-circle-outline" title="About WorkNest" chevron onPress={() => navigation.navigate("AboutUs")} />
          <Divider inset={68} />
          <ListRow leftIcon="chatbubble-ellipses-outline" title="Contact us" chevron onPress={() => navigation.navigate("ContactUs")} />
        </Card>
      </ScrollView>
      <ChatBot visible={chatVisible} />
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: 96 },
    top: { marginTop: t.spacing.sm },
    list: { gap: t.spacing.md },
    // Cards side by side (tablets) are as tall as the tallest one in their row.
    fillCell: { flexGrow: 1 },
    // Fills its grid cell, so the tiles of one row are the same height when a label wraps.
    quickTile: {
      flexGrow: 1,
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: t.radii.card,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: "hidden",
    },
    pressed: { opacity: 0.85 },
    quickIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    quickLabel: { flex: 1 },
  });
