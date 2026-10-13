import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  Button,
  Card,
  InfoRow,
  Screen,
  SegmentedControl,
  StatusPill,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import {
  canCancelBooking,
  cancelMyBooking,
  challanStage,
  getMyBookings,
  isPendingBooking,
  isUpcomingBooking,
  isVoidBooking,
  type MyBooking,
} from "../../../services/bookingService";
import { GuestState } from "./shared/GuestState";
import type { AppStackParamList, MainTabParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type TabKey = "upcoming" | "history";

/** The challan row: number, and the last day to pay only while it can still be paid. */
function challanText(b: MyBooking): string {
  const number = b.challanNumber ?? "";
  if (!b.challanValidUntil) return number;
  const stage = challanStage(b);
  if (stage === "toPay") return `${number}, pay by ${formatDate(b.challanValidUntil)}`;
  if (stage === "expired") return `${number}, expired ${formatDate(b.challanValidUntil)}`;
  return number;
}

/**
 * My Bookings (tab), like the website: GET /booking/my, the challan of each booking, and Cancel only while a
 * booking is still Pending and unpaid. Upcoming = not cancelled / rejected / no show / completed and not ended;
 * everything else is History (bookingService.isUpcomingBooking).
 */
export default function MyBookingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, "Bookings">>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const bell = useNotificationsAction();
  const confirm = useConfirm();
  const toast = useToast();

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>(route.params?.tab ?? "upcoming");

  // The tab stays mounted: a later navigate("Bookings", { tab }) (Profile counts, a notification) switches the
  // segment too, not only the first one.
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
  }, [requestedTab, route.params]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        setBookings(await getMyBookings());
      } catch (err) {
        setError(errorMessage(err, "Your bookings could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  // Reload whenever the tab comes into view (a booking may have been made or paid meanwhile).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upcoming = useMemo(() => bookings.filter((b) => isUpcomingBooking(b)), [bookings]);
  const history = useMemo(() => bookings.filter((b) => !isUpcomingBooking(b)), [bookings]);
  const shown = tab === "upcoming" ? upcoming : history;

  const cancel = async (booking: MyBooking) => {
    try {
      const ok = await confirm({
        title: "Cancel this booking?",
        message: "Its challan will no longer be valid. This cannot be undone.",
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
        destructive: true,
        icon: "close-circle-outline",
        onConfirm: () => cancelMyBooking(booking),
      });
      if (!ok) return;
      toast.success("Booking cancelled.");
      load(true);
    } catch (err) {
      // The API's own reason when it refuses (e.g. a payment was received meanwhile); the list is refreshed so
      // the booking shows its current state.
      toast.error(errorMessage(err, "The booking could not be cancelled. Please try again."));
      load(true);
    }
  };

  if (!user) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <AppHeader variant="brand" title="My bookings" />
        <GuestState
          illustration="calendar"
          title="Sign in to see your bookings"
          message="Your bookings, their challans and their status appear here once you sign in."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader
        variant="brand"
        title="My bookings"
        actions={[{ icon: "add", accessibilityLabel: "Book a space", onPress: () => navigation.navigate("Spaces") }, ...bell]}
      />
      <AsyncList
        data={shown}
        keyExtractor={(b) => String(b.id || b.publicId)}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        ListHeaderComponent={
          <SegmentedControl
            style={styles.segment}
            value={tab}
            onChange={setTab}
            accessibilityLabel="Booking list"
            options={[
              { label: `Upcoming (${upcoming.length})`, value: "upcoming" },
              { label: `History (${history.length})`, value: "history" },
            ]}
          />
        }
        empty={
          tab === "upcoming"
            ? {
                illustration: "calendar",
                title: "No upcoming bookings",
                message: "Book a desk, an office or a meeting room.",
                actionLabel: "Book a space",
                onAction: () => navigation.navigate("Spaces"),
              }
            : {
                illustration: "calendar",
                title: "No past bookings",
                message: "Finished, cancelled and rejected bookings appear here.",
              }
        }
        renderItem={({ item }) => {
          const isVoid = isVoidBooking(item);
          const cancellable = canCancelBooking(item);
          // A challan can be opened for any booking that has one, and for a Pending booking even when the list
          // did not send its number (the challan is fetched by booking id).
          const hasChallan = !!item.challanNumber || (!isVoid && isPendingBooking(item));
          return (
            <Card
              onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id || item.publicId || "" })}
              accessibilityLabel={`${item.spaceName}, ${item.status}`}
            >
              <View style={styles.titleRow}>
                <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                  {item.spaceName}
                </AppText>
                <StatusPill status={item.status} />
              </View>
              <AppText variant="caption" color="textMuted">
                Booking #{item.id}
                {item.locationName ? `  ·  ${item.locationName}` : ""}
              </AppText>
              <View style={styles.rows}>
                <InfoRow label="Dates" value={formatDateRange(item.startOn, item.endOn)} icon="calendar-outline" />
                {/* The challan's total payable; never the booking's totalAmount, which is not what is owed. */}
                {item.totalPayable !== null ? (
                  <InfoRow label="Amount" value={formatMoney(item.totalPayable)} icon="pricetag-outline" />
                ) : !isVoid ? (
                  <InfoRow label="Amount" value="See challan" icon="pricetag-outline" />
                ) : null}
                {item.challanNumber ? (
                  <InfoRow label="Challan" value={challanText(item)} icon="document-text-outline" />
                ) : null}
              </View>
              {hasChallan || cancellable ? (
                <View style={styles.actions}>
                  {hasChallan ? (
                    <Button
                      title="View challan"
                      size="sm"
                      variant="secondary"
                      leftIcon="document-text-outline"
                      onPress={() =>
                        navigation.navigate("Challan", { bookingId: item.id, challanNumber: item.challanNumber ?? undefined })
                      }
                    />
                  ) : null}
                  {cancellable ? (
                    <Button title="Cancel" size="sm" variant="ghost" leftIcon="close-outline" onPress={() => cancel(item)} />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    segment: { marginBottom: t.spacing.md },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    rows: { marginTop: t.spacing.sm },
    actions: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.sm, flexWrap: "wrap" },
  });
