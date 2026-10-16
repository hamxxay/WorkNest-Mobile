import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  Banner,
  Button,
  Card,
  InfoRow,
  ResponsiveGrid,
  STAT_CARD_MIN_WIDTH,
  Screen,
  StatCard,
  StatusPill,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatDateRange, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import { getMyBills, isOpenBill, refundNote, type BillsSummary, type MyBill } from "../../../services/billService";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import { GuestState } from "./shared/GuestState";
import { useInvoicePdf } from "./shared/useInvoicePdf";
import { LIST_CARD_MIN_WIDTH, useCardGrid } from "./shared/layout";
import { TitleRow } from "./shared/TitleRow";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

const EMPTY_SUMMARY: BillsSummary = { paidTotal: 0, dueTotal: 0, overdueTotal: 0, overdueCount: 0, count: 0 };

/** "Due" row: the last day to pay, how late it is, or when it was due. */
function dueText(bill: MyBill): string {
  const date = formatDate(bill.dueOn);
  if (bill.isOverdue && bill.daysOverdue > 0) return `${date} (${bill.daysOverdue} day${bill.daysOverdue === 1 ? "" : "s"} overdue)`;
  return date;
}

/**
 * Payments (tab): the customer's bills from GET /invoice/my — their invoices (paid, unpaid, overdue) and the
 * booking challans that have no invoice — with what is paid and what is still due. Invoices open as PDF; challans
 * open the challan screen. Payment is by bank challan / invoice only; every status comes from the API. An overdue
 * bill warns that door access is suspended more than 7 days after its due date.
 */
export default function MyPaymentsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const bell = useNotificationsAction();
  const invoicePdf = useInvoicePdf();
  // One bill per row on phones, two on tablets and unfolded foldables.
  const grid = useCardGrid({ minItemWidth: LIST_CARD_MIN_WIDTH });

  const [bills, setBills] = useState<MyBill[]>([]);
  const [summary, setSummary] = useState<BillsSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setBills([]);
        setSummary(EMPTY_SUMMARY);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const result = await getMyBills();
        setBills(result.items);
        setSummary(result.summary);
      } catch (err) {
        setError(errorMessage(err, "Your bills could not be loaded. Please try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <AppHeader variant="brand" title="Payments" />
        <GuestState
          illustration="receipt"
          title="Sign in to see your payments"
          message="Your invoices, challans and what you have paid appear here once you sign in."
        />
      </Screen>
    );
  }

  const openChallan = (bill: MyBill) => {
    if (bill.bookingId) navigation.navigate("Challan", { bookingId: bill.bookingId, challanNumber: bill.number });
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader variant="brand" title="Payments" actions={bell} />
      <AsyncList
        // FlatList cannot change numColumns on the fly: a new list when the window gets wider or narrower.
        key={grid.numColumns}
        numColumns={grid.numColumns}
        columnWrapperStyle={grid.columnWrapperStyle}
        data={bills}
        keyExtractor={(b) => b.key}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Side by side, or one above the other on a narrow phone with large text. */}
            <ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH} maxColumns={2}>
              <StatCard label="Paid" value={formatMoney(summary.paidTotal, { compact: true })} tone="success" icon="checkmark-circle-outline" />
              <StatCard
                label="To pay"
                value={formatMoney(summary.dueTotal, { compact: true })}
                tone={summary.overdueCount > 0 ? "danger" : "warning"}
                icon="time-outline"
              />
            </ResponsiveGrid>
            {summary.overdueCount > 0 ? (
              <Banner
                tone="danger"
                title={summary.overdueCount === 1 ? "1 bill is overdue" : `${summary.overdueCount} bills are overdue`}
                message={`${formatMoney(summary.overdueTotal)} is past its due date. Door access to your space is suspended when a bill is more than 7 days overdue, until it is paid.`}
              />
            ) : null}
            {summary.dueTotal > 0 ? <ChallanPayHelp compact /> : null}
          </View>
        }
        empty={{
          illustration: "receipt",
          title: "No bills yet",
          message: "Your invoices and booking challans appear here after you book a space.",
          actionLabel: "Book a space",
          onAction: () => navigation.navigate("Spaces"),
        }}
        renderItem={({ item }) => {
          const open = isOpenBill(item);
          const refund = item.bookingClosed ? refundNote(item.paid, item.bookingStatus) : null;
          return (
            <Card
              style={grid.cellStyle}
              onPress={item.bookingId ? () => navigation.navigate("BookingDetail", { bookingId: item.bookingId! }) : undefined}
              accessibilityLabel={`${item.title} ${item.number}, ${item.status}`}
            >
              <TitleRow title={item.number} right={<StatusPill status={item.status} />} />
              <AppText variant="caption" color="textMuted">
                {[item.title, item.spaceName, item.locationName].filter(Boolean).join("  ·  ")}
              </AppText>
              <View style={styles.rows}>
                <InfoRow label="Total" value={item.total !== null ? formatMoney(item.total) : "Not available"} />
                {item.taxWithheld > 0 ? <InfoRow label="Tax withheld by you" value={formatMoney(item.taxWithheld)} /> : null}
                {item.paid > 0 ? <InfoRow label="Paid" value={formatMoney(item.paid)} /> : null}
                {open ? <InfoRow label="Balance to pay" value={formatMoney(item.balance)} emphasize /> : null}
                {item.issuedOn ? <InfoRow label="Issued" value={formatDate(item.issuedOn)} /> : null}
                {open && item.dueOn ? <InfoRow label={item.isOverdue ? "Was due" : "Pay by"} value={dueText(item)} /> : null}
                {item.status === "Expired" && item.dueOn ? <InfoRow label="Expired on" value={formatDate(item.dueOn)} /> : null}
                {item.periodStart || item.periodEnd ? (
                  <InfoRow label="Period" value={formatDateRange(item.periodStart, item.periodEnd)} />
                ) : null}
              </View>
              {item.accessSuspended ? (
                <AppText variant="bodySmall" color="danger" style={styles.note}>
                  Door access to this space is suspended until this bill is paid.
                </AppText>
              ) : item.accessSuspendsOn ? (
                <AppText variant="bodySmall" color="warning" style={styles.note}>
                  If this is still unpaid, door access to the space is suspended from {formatDate(item.accessSuspendsOn)}.
                </AppText>
              ) : null}
              {item.status === "Expired" ? (
                <AppText variant="bodySmall" color="textSecondary" style={styles.note}>
                  This challan can no longer be paid. Please contact WorkNest for a new one.
                </AppText>
              ) : null}
              {refund ? (
                <AppText variant="bodySmall" color="textSecondary" style={styles.note}>
                  {refund}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                {item.hasPdf && item.invoiceId ? (
                  <Button
                    title="Invoice PDF"
                    size="sm"
                    variant="secondary"
                    leftIcon="download-outline"
                    loading={invoicePdf.busyId === item.invoiceId}
                    disabled={invoicePdf.busyId !== null && invoicePdf.busyId !== item.invoiceId}
                    accessibilityLabel={`Download invoice ${item.number}`}
                    onPress={() => invoicePdf.open(item.invoiceId, item.number)}
                  />
                ) : null}
                {item.kind !== "invoice" && item.bookingId ? (
                  <Button
                    title="View challan"
                    size="sm"
                    variant="secondary"
                    leftIcon="document-text-outline"
                    onPress={() => openChallan(item)}
                  />
                ) : null}
                {refund ? (
                  <Button title="Contact us" size="sm" variant="ghost" onPress={() => navigation.navigate("ContactUs")} />
                ) : null}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    header: { gap: t.spacing.md, marginBottom: t.spacing.md },
    rows: { marginTop: t.spacing.sm },
    note: { marginTop: t.spacing.sm },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, marginTop: t.spacing.sm },
  });
