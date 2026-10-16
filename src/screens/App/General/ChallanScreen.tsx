import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
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
  SuccessCheck,
  statusLabel,
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { errorMessage } from "../../../services/apiClient";
import {
  challanStage,
  getBookingChallan,
  isPendingBooking,
  openBookingChallanPdf,
  type BookingChallan,
} from "../../../services/bookingService";
import { breakdownValue, monthsLabel } from "../../../services/amountBreakdown";
import { refundNote } from "../../../services/billService";
import { returnToBookingScreen } from "../../../navigation/stackReturn";
import { AmountBreakdown } from "./shared/AmountBreakdown";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import { ScrollableState } from "./shared/ScrollableState";
import { TitleRow } from "./shared/TitleRow";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** What the customer can do with this challan (bookingService.challanStage). */
function challanState(challan: BookingChallan) {
  const status = { status: challan.bookingStatus ?? "Pending", statusCode: challan.bookingStatusCode };
  const stage = challanStage({
    ...status,
    challanValidUntil: challan.validUntil,
    totalPaidAmount: challan.totalPaidAmount,
    totalPayable: challan.totalPayable,
  });
  return {
    payable: stage === "toPay",
    expired: stage === "expired",
    isVoid: stage === "void",
    // Still Pending, but the API reports the challan as paid: the team confirms the booking next.
    paidAwaitingConfirmation: stage === "settled" && isPendingBooking(status),
  };
}

/**
 * Bank challan of one booking, exactly as the API issued it (GET /booking/{id}/challan). Customers pay it at
 * HBL / 1Bill like on worknestpk.com; the status shown is the API's, never set by the app. The PDF is the
 * server's own (GET /booking/{id}/challan-pdf), fetched with the sign-in token.
 *
 * The breakdown is the API's `fields` (adds up to the total payable). Payment instructions only appear while the
 * challan can be paid: an expired challan asks the customer to contact WorkNest for a new one, and a cancelled,
 * rejected or no-show booking says the challan can no longer be paid (or, when it was paid, how much and to ask
 * WorkNest about a refund).
 */
export default function ChallanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "Challan">>();
  const bookingId = Number(route.params?.bookingId);
  const justBooked = !!route.params?.justBooked;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();

  const [challan, setChallan] = useState<BookingChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        setChallan(await getBookingChallan(bookingId));
      } catch (err) {
        setError(errorMessage(err, "The challan could not be loaded. Please try again."));
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

  const openPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await openBookingChallanPdf(bookingId, challan?.challanNumber ?? route.params?.challanNumber);
    } catch (err) {
      toast.error(errorMessage(err, "The challan PDF could not be downloaded. Please try again."));
    } finally {
      setPdfBusy(false);
    }
  };

  const number = challan?.challanNumber ?? route.params?.challanNumber;
  const state = challan ? challanState(challan) : null;
  // No PDF to print and pay for an expired challan or a booking that will not go ahead.
  const pdfAvailable = !!state && !state.expired && !state.isVoid;
  const advancePeriod = challan
    ? breakdownValue(challan.fields, "advanceRentPeriod") ?? monthsLabel(challan.billingPeriodMonths)
    : null;
  const totalLabel = state?.payable ? "Total payable" : "Challan total";
  // Paid, then the booking was rejected / cancelled: the amount paid and who to ask about a refund.
  const refund = challan && state?.isVoid ? refundNote(challan.totalPaidAmount, challan.bookingStatus) : null;

  // Challan and Booking details link to each other: go back when the booking is already open below this screen.
  const openBooking = () => {
    if (!challan) return;
    if (returnToBookingScreen(navigation, "BookingDetail", [challan.bookingId, challan.bookingPublicId])) return;
    navigation.navigate("BookingDetail", { bookingId: challan.bookingId });
  };

  return (
    <Screen>
      <AppHeader
        title="Bank challan"
        subtitle={number ? `No. ${number}` : undefined}
        actions={
          pdfAvailable
            ? [{ icon: "download-outline", accessibilityLabel: "Download challan PDF", onPress: openPdf, disabled: pdfBusy }]
            : []
        }
      />
      {loading ? (
        <LoadingState message="Loading challan" />
      ) : error || !challan || !state ? (
        <ScrollableState>
          <ErrorState
            illustration={error ? "cloud-off" : "receipt"}
            title={justBooked ? "Booking created, challan not loaded" : undefined}
            message={error || "This booking has no challan yet."}
            onRetry={() => load()}
          />
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
          {justBooked && state.payable ? (
            <Card variant="outlined" style={styles.booked}>
              <SuccessCheck size={48} haptic accessibilityLabel={null} />
              <View style={styles.flex} accessible accessibilityLiveRegion="polite">
                <AppText variant="subheading">Booking created</AppText>
                <AppText variant="bodySmall" color="textSecondary">
                  Pay this challan before the date below to confirm it.
                </AppText>
              </View>
            </Card>
          ) : null}
          {state.expired ? (
            <Banner
              tone="warning"
              title="Challan expired"
              message={`This challan expired on ${formatDate(challan.validUntil)} and can no longer be paid. Please contact WorkNest for a new challan.`}
              actionLabel="Contact us"
              onAction={() => navigation.navigate("ContactUs")}
            />
          ) : state.isVoid && refund ? (
            <Banner
              tone="warning"
              title="Refund"
              message={refund}
              actionLabel="Contact us"
              onAction={() => navigation.navigate("ContactUs")}
            />
          ) : state.isVoid ? (
            <Banner
              tone="info"
              title={statusLabel(challan.bookingStatus)}
              message="This booking will not go ahead, so this challan can no longer be paid. Contact WorkNest if you have any questions."
            />
          ) : state.paidAwaitingConfirmation ? (
            <Banner
              tone="success"
              title="Payment received"
              message="We have received your payment for this challan. Your booking is confirmed once our team has checked it."
            />
          ) : null}
          <Card>
            <TitleRow
              title="Challan / consumer no."
              variant="overline"
              color="textMuted"
              numberOfLines={0}
              right={<StatusPill status={state.expired ? "Expired" : challan.bookingStatus ?? "Pending"} size="md" />}
            />
            {/* The long consumer number stays readable without taking several lines of 56px digits. */}
            <AppText variant="display" selectable maxFontSizeMultiplier={1.5} style={styles.number}>
              {challan.challanNumber ?? "Not issued yet"}
            </AppText>
            {state.payable ? (
              <InfoRow label="Pay before" value={formatDate(challan.validUntil)} icon="time-outline" emphasize />
            ) : state.expired ? (
              <InfoRow label="Expired on" value={formatDate(challan.validUntil)} icon="time-outline" />
            ) : challan.issuedOn ? (
              // Pakistan date from the API (it converts the stored UTC time, like validUntil).
              <InfoRow label="Issued" value={formatDate(challan.issuedOn)} icon="calendar-outline" />
            ) : null}
            {refund && challan.totalPaidAmount ? (
              <InfoRow label="You paid" value={formatMoney(challan.totalPaidAmount)} icon="cash-outline" />
            ) : null}
            <Divider spacing={8} />
            <InfoRow label={totalLabel} value={formatMoney(challan.totalPayable)} emphasize />
          </Card>

          {challan.fields.length > 0 ? (
            <AmountBreakdown
              fields={challan.fields}
              totalLabel={totalLabel}
              totalValue={challan.totalPayable !== null ? formatMoney(challan.totalPayable) : undefined}
            />
          ) : (
            <>
              {/* Older API without `fields`: the challan's own amounts, which add up to the total payable. */}
              <SectionHeader title="Amount breakdown" />
              <Card>
                {challan.currentCycleAmount !== null ? (
                  <InfoRow
                    label={advancePeriod ? `Advance rent (${advancePeriod})` : "Advance rent"}
                    value={formatMoney(challan.currentCycleAmount)}
                  />
                ) : null}
                {challan.securityDeposit ? (
                  <InfoRow label="Security deposit (refundable)" value={formatMoney(challan.securityDeposit)} />
                ) : null}
                {challan.taxAmount ? <InfoRow label="Tax" value={formatMoney(challan.taxAmount)} /> : null}
                {challan.discountAmount ? (
                  <InfoRow label="Discount" value={`- ${formatMoney(challan.discountAmount)}`} />
                ) : null}
                <Divider spacing={8} />
                <InfoRow label={totalLabel} value={formatMoney(challan.totalPayable)} emphasize />
              </Card>
            </>
          )}

          <SectionHeader title="Booking" />
          <Card>
            <InfoRow
              label="Space"
              value={`${challan.spaceName ?? "Not set"}${challan.spaceCode ? ` (${challan.spaceCode})` : ""}`}
              icon="business-outline"
            />
            {challan.branchName || challan.locationName ? (
              <InfoRow label="Location" value={challan.branchName ?? challan.locationName ?? ""} icon="location-outline" />
            ) : null}
            <InfoRow label="Period" value={formatDateRange(challan.startOn, challan.endOn)} icon="calendar-outline" />
            {/* The advance covers the billing period in months (the breakdown above already shows it when sent). */}
            {advancePeriod && !breakdownValue(challan.fields, "advanceRentPeriod") ? (
              <InfoRow label="Advance period" value={advancePeriod} />
            ) : null}
            <InfoRow label="Booking ref" value={`#${challan.bookingId}`} />
            {challan.customerName ? <InfoRow label="Customer" value={challan.customerName} icon="person-outline" /> : null}
          </Card>

          {state.payable ? <ChallanPayHelp /> : null}

          <View style={styles.actions}>
            {pdfAvailable ? (
              <Button title="Download / share PDF" leftIcon="download-outline" fullWidth loading={pdfBusy} onPress={openPdf} />
            ) : null}
            <Button title="View booking" variant="outline" fullWidth onPress={openBooking} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    number: { marginVertical: t.spacing.sm },
    booked: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    flex: { flex: 1 },
    actions: { gap: t.spacing.md },
  });
