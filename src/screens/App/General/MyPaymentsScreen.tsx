import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  Button,
  Card,
  InfoRow,
  Screen,
  StatCard,
  StatusPill,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsAction } from "../../../hooks/useHeaderActions";
import { errorMessage } from "../../../services/apiClient";
import {
  getMyPayments,
  isPaid,
  isPendingPayment,
  summarizePayments,
  type MyPayment,
} from "../../../services/paymentService";
import { isChallanExpired } from "../../../services/bookingService";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import { GuestState } from "./shared/GuestState";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Payments (tab), like the website's My Payments: GET /payment/my plus the bank challan of each booking.
 * Payment is by challan only (1Bill / HBL); every status shown comes from the API, the app never marks anything
 * paid. (The API has no customer "my invoices" list yet.)
 */
export default function MyPaymentsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const bell = useNotificationsAction();

  const [payments, setPayments] = useState<MyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setPayments([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        setPayments(await getMyPayments());
      } catch (err) {
        setError(errorMessage(err, "Your payments could not be loaded. Please try again."));
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

  const totals = useMemo(() => summarizePayments(payments), [payments]);

  if (!user) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <AppHeader variant="brand" title="Payments" />
        <GuestState
          illustration="receipt"
          title="Sign in to see your payments"
          message="Your challans and their payment status appear here once you sign in."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "left", "right"]}>
      <AppHeader variant="brand" title="Payments" actions={bell} />
      <AsyncList
        data={payments}
        keyExtractor={(p) => String(p.id || p.publicId)}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.stats}>
              <StatCard label="Paid" value={formatMoney(totals.paid, { compact: true })} tone="success" icon="checkmark-circle-outline" />
              <StatCard label="Pending" value={formatMoney(totals.pending, { compact: true })} tone="warning" icon="time-outline" />
            </View>
            <ChallanPayHelp compact />
          </View>
        }
        empty={{
          illustration: "receipt",
          title: "No payments yet",
          message: "When you book, the challan to pay appears here.",
          actionLabel: "Book a space",
          onAction: () => navigation.navigate("Spaces"),
        }}
        renderItem={({ item }) => {
          const paid = isPaid(item);
          return (
            <Card
              onPress={
                item.bookingId
                  ? () => navigation.navigate("Challan", { bookingId: item.bookingId!, challanNumber: item.challanNumber ?? undefined })
                  : undefined
              }
              accessibilityLabel={`${item.challanNumber ? `Challan ${item.challanNumber}` : `Payment ${item.id}`}, ${item.status}`}
            >
              <View style={styles.titleRow}>
                <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                  {item.challanNumber ? `Challan ${item.challanNumber}` : `Payment #${item.id}`}
                </AppText>
                <StatusPill status={item.status} />
              </View>
              {item.spaceName ? (
                <AppText variant="caption" color="textMuted">
                  {item.spaceName}
                </AppText>
              ) : null}
              <View style={styles.rows}>
                <InfoRow label="Amount" value={item.amount !== null ? formatMoney(item.amount) : "Not available"} emphasize />
                {item.methodLabel ? <InfoRow label="Method" value={item.methodLabel} /> : null}
                {paid ? (
                  <InfoRow label="Paid on" value={formatDate(item.paidOn)} />
                ) : item.challanValidUntil && isPendingPayment(item) ? (
                  // A last day to pay only for a challan still waiting for payment; an expired one says so.
                  isChallanExpired(item.challanValidUntil) ? (
                    <InfoRow label="Expired on" value={formatDate(item.challanValidUntil)} />
                  ) : (
                    <InfoRow label="Pay before" value={formatDate(item.challanValidUntil)} />
                  )
                ) : null}
                <InfoRow label="Created" value={formatDate(item.createdOn)} />
              </View>
              {item.bookingId ? (
                <Button
                  title="View challan"
                  size="sm"
                  variant="secondary"
                  leftIcon="document-text-outline"
                  style={styles.action}
                  onPress={() =>
                    navigation.navigate("Challan", { bookingId: item.bookingId!, challanNumber: item.challanNumber ?? undefined })
                  }
                />
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
    header: { gap: t.spacing.md, marginBottom: t.spacing.md },
    stats: { flexDirection: "row", gap: t.spacing.md },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    rows: { marginTop: t.spacing.sm },
    action: { alignSelf: "flex-start", marginTop: t.spacing.sm },
  });
