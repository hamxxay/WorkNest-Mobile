import { useCallback, useMemo, useState } from "react";
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
import { canCancelBooking, cancelMyBooking, getMyBookings, type MyBooking } from "../../../services/bookingService";
import { GuestState } from "./shared/GuestState";
import type { AppStackParamList, MainTabParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type TabKey = "upcoming" | "history";

/** Still running or not started (or no end date yet, e.g. pending): listed under Upcoming. */
function isUpcoming(b: MyBooking): boolean {
  const status = b.status.toLowerCase();
  if (status.includes("cancel") || status.includes("complet")) return false;
  if (!b.endOn) return true;
  const end = new Date(b.endOn);
  return isNaN(end.getTime()) || end.getTime() > Date.now();
}

/**
 * My Bookings (tab), like the website: GET /booking/my, the challan of each booking, and Cancel only while a
 * booking is still Pending (not paid).
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

  const upcoming = useMemo(() => bookings.filter(isUpcoming), [bookings]);
  const history = useMemo(() => bookings.filter((b) => !isUpcoming(b)), [bookings]);
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
      toast.error(errorMessage(err, "The booking could not be cancelled. Please try again."));
    }
  };

  if (!user) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <AppHeader variant="brand" title="My bookings" />
        <GuestState
          icon="calendar-outline"
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
                icon: "calendar-outline",
                title: "No upcoming bookings",
                message: "Book a desk, an office or a meeting room.",
                actionLabel: "Book a space",
                onAction: () => navigation.navigate("Spaces"),
              }
            : { icon: "time-outline", title: "No past bookings", message: "Finished and cancelled bookings appear here." }
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id || item.publicId || "" })}
            accessibilityLabel={`${item.spaceName}, ${item.status}`}>
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
              <InfoRow
                label="Amount"
                value={item.totalAmount !== null ? formatMoney(item.totalAmount) : "On the challan"}
                icon="pricetag-outline"
              />
              {item.challanNumber ? (
                <InfoRow
                  label="Challan"
                  value={`${item.challanNumber}${item.challanValidUntil ? `, pay by ${formatDate(item.challanValidUntil)}` : ""}`}
                  icon="document-text-outline"
                />
              ) : null}
            </View>
            {item.challanNumber || canCancelBooking(item) ? (
              <View style={styles.actions}>
                {item.challanNumber ? (
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
                {canCancelBooking(item) ? (
                  <Button title="Cancel" size="sm" variant="ghost" leftIcon="close-outline" onPress={() => cancel(item)} />
                ) : null}
              </View>
            ) : null}
          </Card>
        )}
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
