import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
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
  hasPayment,
  isPendingBooking,
  isUpcomingBooking,
  isVoidBooking,
  type BookingChallan,
} from "../../../services/bookingService";
import { monthsLabel } from "../../../services/amountBreakdown";
import { refundNote } from "../../../services/billService";
import { employeesButtonLabel, seatsUsedLabel, showsEmployees } from "../../../services/employeeService";
import { returnToBookingScreen } from "../../../navigation/stackReturn";
import { DoorSuspendedBanner } from "./shared/DoorSuspendedBanner";
import { useEmployeeSummaries } from "./shared/useEmployeeSummaries";
import { useInvoicePdf } from "./shared/useInvoicePdf";
import { ScrollableState } from "./shared/ScrollableState";
import { TitleRow } from "./shared/TitleRow";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * One booking (GET /booking/{id}): space, period, billing and the challan; Cancel while it is still Pending and
 * nothing has been paid on it. A Confirmed booking also links to its employees ("Employees 2/4").
 * Next bill / balance left are shown only when the API marks them reliable; a suspended door access shows a banner
 * with the bill to pay.
 */
export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingDetail">>();
  const bookingId = route.params?.bookingId;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirm = useConfirm();
  const toast = useToast();
  const invoicePdf = useInvoicePdf();

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
  const statusFields = { status, statusCode: booking?.bookingStatusCode ?? null };
  const cancelTarget = booking
    ? { id: booking.bookingId, ...statusFields, totalPaidAmount: booking.totalPaidAmount }
    : null;
  const cancellable = !!cancelTarget && canCancelBooking(cancelTarget);
  const isVoid = isVoidBooking(statusFields);
  const pending = isPendingBooking(statusFields);
  // GET /booking/{id} may not carry the challan number: a Pending booking always has a challan (fetched by id).
  const showChallan = !!booking && (!!booking.challanNumber || (pending && !isVoid));
  // Why Cancel is missing on a booking that is still going ahead.
  const cancelNote =
    !booking || cancellable || isVoid
      ? null
      : pending && hasPayment(booking)
        ? "A payment has been received for this booking, so it can't be cancelled in the app. Contact us for changes."
        : !pending && isUpcomingBooking({ ...statusFields, endOn: booking.endOn })
          ? "Confirmed bookings can't be cancelled in the app. Contact us for changes."
          : null;
  const billingPeriod = monthsLabel(booking?.billingPeriodMonths) ?? booking?.billingPeriodLabel ?? null;
  // Next bill / balance left only when the API says they can be trusted (and never for a booking that won't go ahead).
  const showBillingFigures = !!booking && booking.billingFiguresReliable && !isVoid;
  // The challan's advance rent when it differs from one billing period (a booking from the 15th also pays the rest
  // of its first month), so it matches "Advance rent" on the challan.
  const advanceRent =
    booking?.firstCycleRent && booking.firstCycleRent !== booking.currentCycleAmount ? booking.firstCycleRent : null;
  const refund = booking && isVoid ? refundNote(booking.totalPaidAmount, booking.bookingStatus) : null;

  // Challan and Booking details link to each other: go back when the challan is already open below this screen.
  const openChallan = () => {
    if (!booking) return;
    if (returnToBookingScreen(navigation, "Challan", [booking.bookingId])) return;
    navigation.navigate("Challan", { bookingId: booking.bookingId, challanNumber: booking.challanNumber ?? undefined });
  };

  // Employees: Confirmed bookings only; the entry appears once its count is known (hidden on a 404 / 503 answer).
  const employeesBookingId = booking && booking.bookingId > 0 && showsEmployees(statusFields) ? booking.bookingId : 0;
  const employeeIds = useMemo(() => (employeesBookingId ? [employeesBookingId] : []), [employeesBookingId]);
  const { entries: employeeEntries, reload: reloadEmployees } = useEmployeeSummaries(employeeIds);
  const employeeEntry = employeesBookingId ? employeeEntries[employeesBookingId] : undefined;
  const employeeSummary = employeeEntry?.status === "ready" ? employeeEntry.summary : null;
  const showEmployees = employeeEntry?.status === "ready" || employeeEntry?.status === "unknown";
  // Back from the Employees screen (or the app): the count may have changed.
  useFocusEffect(
    useCallback(() => {
      reloadEmployees();
    }, [reloadEmployees]),
  );

  const cancel = async () => {
    if (!cancelTarget) return;
    try {
      const ok = await confirm({
        title: "Cancel this booking?",
        message: "Its challan will no longer be valid. This cannot be undone.",
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
        destructive: true,
        icon: "close-circle-outline",
        onConfirm: () => cancelMyBooking(cancelTarget),
      });
      if (!ok) return;
      toast.success("Booking cancelled.");
      load(true);
    } catch (err) {
      // The API's own reason when it refuses; reload so the screen shows the booking as it is now.
      toast.error(errorMessage(err, "The booking could not be cancelled. Please try again."));
      load(true);
    }
  };

  return (
    <Screen>
      <AppHeader title="Booking details" subtitle={booking ? `Booking #${booking.bookingId}` : undefined} />
      {loading ? (
        <LoadingState message="Loading booking" />
      ) : error || !booking ? (
        <ScrollableState>
          <ErrorState message={error} onRetry={() => load()} />
        </ScrollableState>
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
          <DoorSuspendedBanner
            notice={booking}
            onOpenInvoice={(id, number) => invoicePdf.open(id, number)}
            onOpenChallan={showChallan ? openChallan : undefined}
          />
          {refund ? (
            <Banner
              tone="info"
              title="Refund"
              message={refund}
              actionLabel="Contact us"
              onAction={() => navigation.navigate("ContactUs")}
            />
          ) : null}
          <Card>
            <TitleRow
              title={booking.spaceName ?? "Booking"}
              variant="heading"
              numberOfLines={0}
              right={<StatusPill status={status} size="md" />}
              style={styles.titleRow}
            />
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
            {billingPeriod ? <InfoRow label="Billing period" value={billingPeriod} /> : null}
            {booking.monthlyRent ? <InfoRow label="Monthly rent" value={formatMoney(booking.monthlyRent)} /> : null}
            {booking.currentCycleAmount ? (
              <InfoRow label="Rent per billing period" value={formatMoney(booking.currentCycleAmount)} />
            ) : null}
            {advanceRent ? <InfoRow label="Advance rent on the challan" value={formatMoney(advanceRent)} /> : null}
            {booking.securityDeposit ? (
              <InfoRow label="Security deposit (refundable)" value={formatMoney(booking.securityDeposit)} />
            ) : null}
            {showBillingFigures && booking.nextBillDueDate ? (
              <InfoRow label="Next bill due" value={formatDate(booking.nextBillDueDate)} />
            ) : null}
            {booking.totalPaidAmount !== null ? <InfoRow label="Paid so far" value={formatMoney(booking.totalPaidAmount)} /> : null}
            {showBillingFigures && booking.balanceLeft !== null ? (
              <InfoRow label="Balance left" value={formatMoney(booking.balanceLeft)} />
            ) : null}
            <Divider spacing={8} />
            {/* "Total payable" only while the challan is still to be paid; afterwards it is the challan's total. */}
            {pending ? (
              <InfoRow label="Total payable" value={formatMoney(booking.totalPayable)} emphasize />
            ) : (
              <InfoRow label="Challan total" value={formatMoney(booking.totalPayable)} />
            )}
            {!pending && !isVoid ? (
              <AppText variant="caption" color="textMuted" style={styles.top}>
                Your invoices and what is due are on the Payments tab.
              </AppText>
            ) : null}
          </Card>

          {showChallan ? (
            <>
              <SectionHeader title="Challan" />
              <Card>
                {booking.challanNumber ? (
                  <InfoRow label="Challan no." value={booking.challanNumber} icon="document-text-outline" />
                ) : (
                  <AppText variant="bodySmall" color="textSecondary">
                    The bank challan of this booking, with the amount payable.
                  </AppText>
                )}
                <Button
                  title="View challan"
                  leftIcon="document-text-outline"
                  variant="secondary"
                  fullWidth
                  style={styles.top}
                  onPress={openChallan}
                />
              </Card>
            </>
          ) : null}

          {showEmployees ? (
            <>
              <SectionHeader title="Employees" />
              <Card>
                <AppText variant="bodySmall" color="textSecondary">
                  {employeeSummary
                    ? `${seatsUsedLabel(employeeSummary)}. ${
                        employeeSummary.canManage
                          ? "Add the people who work in this space; WorkNest checks them at the branch."
                          : "See who works in this space."
                      }`
                    : "The people who work in this space."}
                </AppText>
                <Button
                  title={employeesButtonLabel(employeeSummary)}
                  leftIcon="people-outline"
                  rightIcon="chevron-forward"
                  variant="secondary"
                  fullWidth
                  style={styles.top}
                  accessibilityLabel={employeeSummary ? `Employees, ${seatsUsedLabel(employeeSummary)}` : "Employees"}
                  onPress={() =>
                    navigation.navigate("Employees", {
                      bookingId: booking.bookingId,
                      spaceName: booking.spaceName ?? undefined,
                    })
                  }
                />
              </Card>
            </>
          ) : null}

          {cancellable ? (
            <Button title="Cancel booking" variant="danger" leftIcon="close-outline" fullWidth onPress={cancel} />
          ) : null}
          {cancelNote ? (
            <AppText variant="caption" color="textMuted" align="center">
              {cancelNote}
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
    titleRow: { marginBottom: t.spacing.xs },
    top: { marginTop: t.spacing.sm },
  });
