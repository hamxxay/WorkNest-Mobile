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
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { errorMessage } from "../../../services/apiClient";
import { getBookingChallan, openBookingChallanPdf, type BookingChallan } from "../../../services/bookingService";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Bank challan of one booking, exactly as the API issued it (GET /booking/{id}/challan). Customers pay it at
 * HBL / 1Bill like on worknestpk.com; the status shown is the API's, never set by the app. The PDF is the
 * server's own (GET /booking/{id}/challan-pdf), fetched with the sign-in token.
 */
export default function ChallanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "Challan">>();
  const bookingId = Number(route.params?.bookingId);
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

  return (
    <Screen>
      <AppHeader
        title="Bank challan"
        subtitle={number ? `No. ${number}` : undefined}
        actions={
          challan
            ? [{ icon: "download-outline", accessibilityLabel: "Download challan PDF", onPress: openPdf, disabled: pdfBusy }]
            : []
        }
      />
      {loading ? (
        <LoadingState message="Loading challan" />
      ) : error || !challan ? (
        <ErrorState illustration={error ? "cloud-off" : "receipt"} message={error || "This booking has no challan yet."} onRetry={() => load()} />
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
            <View style={styles.rowBetween}>
              <AppText variant="overline" color="textMuted">
                Challan / consumer no.
              </AppText>
              <StatusPill status={challan.bookingStatus ?? "Pending"} size="md" />
            </View>
            <AppText variant="display" selectable style={styles.number}>
              {challan.challanNumber ?? "Not issued yet"}
            </AppText>
            <InfoRow label="Pay before" value={formatDate(challan.validUntil)} icon="time-outline" emphasize />
            <Divider spacing={8} />
            <InfoRow label="Total payable" value={formatMoney(challan.totalPayable)} emphasize />
          </Card>

          <SectionHeader title="Amount breakdown" />
          <Card>
            {challan.lines.length > 0 ? (
              challan.lines.map((line, i) => (
                <InfoRow
                  key={line.lineId ?? i}
                  label={line.label}
                  value={formatMoney(line.lineTotal)}
                />
              ))
            ) : (
              <>
                {challan.currentCycleAmount !== null ? (
                  <InfoRow label="Rent" value={formatMoney(challan.currentCycleAmount)} />
                ) : null}
                {challan.securityDeposit ? (
                  <InfoRow label="Security deposit (refundable)" value={formatMoney(challan.securityDeposit)} />
                ) : null}
                {challan.taxAmount ? <InfoRow label="Tax" value={formatMoney(challan.taxAmount)} /> : null}
              </>
            )}
            {challan.discountAmount ? <InfoRow label="Discount" value={`- ${formatMoney(challan.discountAmount)}`} /> : null}
            <Divider spacing={8} />
            <InfoRow label="Total payable" value={formatMoney(challan.totalPayable)} emphasize />
          </Card>

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
            {challan.billingPeriodLabel ? <InfoRow label="Advance period" value={challan.billingPeriodLabel} /> : null}
            <InfoRow label="Booking ref" value={`#${challan.bookingId}`} />
            {challan.customerName ? <InfoRow label="Customer" value={challan.customerName} icon="person-outline" /> : null}
          </Card>

          <ChallanPayHelp />

          <View style={styles.actions}>
            <Button title="Download / share PDF" leftIcon="download-outline" fullWidth loading={pdfBusy} onPress={openPdf} />
            <Button
              title="View booking"
              variant="outline"
              fullWidth
              onPress={() => navigation.navigate("BookingDetail", { bookingId: challan.bookingId })}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm },
    number: { marginVertical: t.spacing.sm },
    actions: { gap: t.spacing.md },
  });
