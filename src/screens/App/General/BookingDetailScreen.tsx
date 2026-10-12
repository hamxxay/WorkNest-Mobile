import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  Divider,
  ErrorState,
  InfoRow,
  LoadingState,
  Screen,
  SectionHeader,
  StatusPill,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { errorMessage } from "../../../services/apiClient";
import {
  canCancelBooking,
  cancelMyBooking,
  getBookingDetails,
  type BookingChallan,
} from "../../../services/bookingService";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** One booking (GET /booking/{id}): space, period, billing and the challan; Cancel while it is still Pending. */
export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingDetail">>();
  const bookingId = route.params?.bookingId;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirm = useConfirm();
  const toast = useToast();

  const [booking, setBooking] = useState<BookingChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        if (bookingId === undefined || bookingId === "") throw new Error("Booking not found.");
        setBooking(await getBookingDetails(bookingId));
      } catch (err) {
        setError(errorMessage(err, "This booking could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const status = booking?.bookingStatus ?? "Pending";
  const cancellable = !!booking && canCancelBooking({ id: booking.bookingId, status, statusCode: booking.bookingStatusCode });

  const cancel = async () => {
    if (!booking) return;
    try {
      const ok = await confirm({
        title: "Cancel this booking?",
        message: "Its challan will no longer be valid. This cannot be undone.",
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
        destructive: true,
        icon: "close-circle-outline",
        onConfirm: () => cancelMyBooking({ id: booking.bookingId, status, statusCode: booking.bookingStatusCode }),
      });
      if (!ok) return;
      toast.success("Booking cancelled.");
      load(true);
    } catch (err) {
      toast.error(errorMessage(err, "The booking could not be cancelled. Please try again."));
    }
  };

  return (
    <Screen>
      <AppHeader title="Booking details" subtitle={booking ? `Booking #${booking.bookingId}` : undefined} />
      {loading ? (
        <LoadingState message="Loading booking" />
      ) : error || !booking ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surfaceRaised}
            />
          }
        >
          <Card>
            <View style={styles.titleRow}>
              <AppText variant="heading" style={styles.flex}>
                {booking.spaceName ?? "Booking"}
              </AppText>
              <StatusPill status={status} size="md" />
            </View>
            <InfoRow label="Dates" value={formatDateRange(booking.startOn, booking.endOn)} icon="calendar-outline" />
            {booking.spaceTypeName ? <InfoRow label="Type" value={booking.spaceTypeName} icon="business-outline" /> : null}
            {booking.branchName || booking.locationName ? (
              <InfoRow label="Location" value={booking.branchName ?? booking.locationName ?? ""} icon="location-outline" />
            ) : null}
            {booking.spaceCode || booking.spaceNumber ? (
              <InfoRow label="Space" value={booking.spaceNumber ?? booking.spaceCode ?? ""} />
            ) : null}
            {booking.spaceCapacity ? <InfoRow label="Capacity" value={`${booking.spaceCapacity} people`} /> : null}
            {booking.bookedOn ? <InfoRow label="Booked on" value={formatDate(booking.bookedOn)} /> : null}
          </Card>

          <SectionHeader title="Billing" />
          <Card>
            {booking.billingPeriodLabel ? <InfoRow label="Billing period" value={booking.billingPeriodLabel} /> : null}
            {booking.monthlyRent ? <InfoRow label="Monthly rent" value={formatMoney(booking.monthlyRent)} /> : null}
            {booking.currentCycleAmount ? <InfoRow label="Current cycle" value={formatMoney(booking.currentCycleAmount)} /> : null}
            {booking.securityDeposit ? (
              <InfoRow label="Security deposit (refundable)" value={formatMoney(booking.securityDeposit)} />
            ) : null}
            {booking.nextBillDueDate ? <InfoRow label="Next bill due" value={formatDate(booking.nextBillDueDate)} /> : null}
            {booking.totalPaidAmount !== null ? <InfoRow label="Paid so far" value={formatMoney(booking.totalPaidAmount)} /> : null}
            {booking.balanceLeft !== null ? <InfoRow label="Balance left" value={formatMoney(booking.balanceLeft)} /> : null}
            <Divider spacing={8} />
            <InfoRow label="Total payable" value={formatMoney(booking.totalPayable)} emphasize />
          </Card>

          <View style={styles.actions}>
            {booking.challanNumber ? (
              <Button
                title="View challan"
                leftIcon="document-text-outline"
                fullWidth
                onPress={() =>
                  navigation.navigate("Challan", {
                    bookingId: booking.bookingId,
                    challanNumber: booking.challanNumber ?? undefined,
                  })
                }
              />
            ) : null}
            {cancellable ? (
              <Button title="Cancel booking" variant="danger" leftIcon="close-outline" fullWidth onPress={cancel} />
            ) : null}
          </View>
          {!cancellable && status.toLowerCase() !== "cancelled" ? (
            <AppText variant="caption" color="textMuted" align="center">
              Paid bookings can't be cancelled in the app. Contact us for changes.
            </AppText>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginBottom: t.spacing.xs },
    flex: { flex: 1 },
    actions: { gap: t.spacing.md },
  });
