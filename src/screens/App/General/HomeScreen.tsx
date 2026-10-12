import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
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
  Screen,
  SectionHeader,
  StatusPill,
  greeting,
} from "../../../components/ui";
import { ChatBot } from "../../../components/ChatBot";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useDoorAccess } from "../../../hooks/useDoorAccess";
import { useUnlockRoomDoor } from "../../../hooks/useUnlockRoomDoor";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import { getWorkspaces, type Workspace } from "../../../services/workspaceService";
import { getMyBookings, isPendingBooking, type MyBooking } from "../../../services/bookingService";
import { WorkspaceCard } from "../../Home/WorkspaceCard";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** How many space cards Home shows before "See all". */
const HOME_SPACES = 4;

type QuickAction = { key: string; label: string; icon: string; onPress: () => void; busy?: boolean };

/**
 * Customer home: the challan waiting to be paid (if any), quick actions and the spaces open for booking.
 */
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const bell = useNotificationsAction();
  const doorAccess = useDoorAccess();
  const { unlock, unlocking } = useUnlockRoomDoor(doorAccess);

  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState("");
  const [pendingChallan, setPendingChallan] = useState<MyBooking | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);

  const loadSpaces = useCallback(async () => {
    setSpacesError("");
    try {
      setSpaces(await getWorkspaces());
    } catch (err) {
      setSpacesError(errorMessage(err, "Spaces could not be loaded. Please try again."));
    } finally {
      setSpacesLoading(false);
    }
  }, []);

  // The newest booking that still has an unpaid challan (signed-in customers only).
  const loadPendingChallan = useCallback(async () => {
    if (!user) {
      setPendingChallan(null);
      return;
    }
    try {
      const bookings = await getMyBookings();
      setPendingChallan(bookings.find((b) => isPendingBooking(b) && !!b.challanNumber) ?? null);
    } catch {
      // Home stays usable; My Bookings shows the error with a retry.
    }
  }, [user]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useFocusEffect(
    useCallback(() => {
      loadPendingChallan();
    }, [loadPendingChallan]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSpaces(), loadPendingChallan()]);
    setRefreshing(false);
  };

  const requireSignIn = (go: () => void) => () => (user ? go() : navigation.navigate("Login"));

  const quickActions: QuickAction[] = [
    { key: "book", label: "Book a space", icon: "calendar-outline", onPress: () => navigation.navigate("Spaces") },
    { key: "tour", label: "Book a tour", icon: "walk-outline", onPress: () => navigation.navigate("BookTour") },
    doorAccess?.canOpenDoor
      ? { key: "unlock", label: unlocking ? "Unlocking" : "Unlock door", icon: "lock-open-outline", onPress: unlock, busy: unlocking }
      : {
          key: "access",
          label: "Access request",
          icon: "key-outline",
          onPress: requireSignIn(() => navigation.navigate("AccessRequest")),
        },
    {
      key: "quotes",
      label: "Quotations",
      icon: "document-text-outline",
      onPress: requireSignIn(() => navigation.navigate("QuotationList")),
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setChatVisible(false)}
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
            <View style={styles.rowBetween}>
              <AppText variant="overline" color="textMuted">
                Challan to pay
              </AppText>
              <StatusPill status={pendingChallan.status} />
            </View>
            <AppText variant="heading" style={styles.top}>
              {pendingChallan.spaceName}
            </AppText>
            <InfoRow label="Challan no." value={pendingChallan.challanNumber ?? ""} />
            {pendingChallan.challanValidUntil ? (
              <InfoRow label="Pay before" value={formatDate(pendingChallan.challanValidUntil)} />
            ) : null}
            {pendingChallan.totalAmount !== null ? (
              <InfoRow label="Amount" value={formatMoney(pendingChallan.totalAmount)} emphasize />
            ) : null}
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

        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <Pressable
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
            </Pressable>
          ))}
        </View>

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
            icon="business-outline"
            title="No spaces open right now"
            message="Book a tour and our team will show you what fits."
            actionLabel="Book a tour"
            onAction={() => navigation.navigate("BookTour")}
          />
        ) : (
          <View style={styles.list}>
            {spaces.slice(0, HOME_SPACES).map((ws) => (
              <WorkspaceCard
                key={`${ws.id}-${ws.location}-${ws.type}`}
                workspace={ws}
                onPress={() => navigation.navigate("SpaceDetail", { workspace: ws })}
              />
            ))}
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
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm },
    top: { marginTop: t.spacing.sm },
    list: { gap: t.spacing.md },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.md },
    quickTile: {
      flexBasis: "47%",
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
