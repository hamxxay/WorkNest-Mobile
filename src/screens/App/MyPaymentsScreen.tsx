import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, useThemedStyles, useThemeColors } from "../../theme";
import { getMyPayments, type PaymentItem } from "../../services/paymentService";
import { useAuth } from "../../context/AuthContext";
import type { AppStackParamList } from "../../navigation/types";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function MyPaymentsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingPayments(true);
    getMyPayments()
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => { setLoadingPayments(false); setRefreshing(false); });
  };

  useEffect(() => { fetchPayments(); }, []);

  const loading = loadingPayments;

  // Guest wall
  if (!user) {
    return (
      <Screen>
        <Header />
        <View style={styles.guestWall}>
          <Ionicons name="card-outline" size={72} color={colors.primary} style={{ opacity: 0.5 }} />
          <Text style={styles.guestTitle}>Sign in to view payments</Text>
          <Text style={styles.guestSub}>Your payment history will appear here once you're signed in.</Text>
          <Pressable style={styles.guestBtn} onPress={() => navigation.navigate("Login")}>
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.guestBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const totalPaid = useMemo(
    () =>
      payments
        .filter((p) => getDisplayStatus(p) === "Paid")
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    [payments]
  );
  const totalPending = useMemo(
    () =>
      payments
        .filter((p) => getDisplayStatus(p) === "Pending")
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    [payments]
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPayments(true)} />}
      >
        <Header />
        <Text style={styles.title}>My Payments</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>PKR {totalPaid.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Pending</Text>
            <Text style={styles.summaryValue}>PKR {totalPending.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payments</Text>
        {loadingPayments && !payments.length ? <Text style={styles.helper}>Loading payments...</Text> : null}
        {!loadingPayments && payments.length === 0 ? (
          <Text style={styles.helper}>No payments found.</Text>
        ) : null}

        {payments.map((payment) => {
          const displayStatus = getDisplayStatus(payment);
          const isPending = displayStatus === "Pending";
          return (
            <View key={payment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardBody}>
                  {payment.voucherCode ? <Text style={styles.voucherCode}>Voucher: {payment.voucherCode}</Text> : null}
                  {payment.workspaceName ? <Text style={styles.meta}>Workspace: {payment.workspaceName}</Text> : null}
                  {payment.bookingSummary ? <Text style={styles.meta}>Booking: {payment.bookingSummary}</Text> : null}
                  <Text style={styles.meta}>Amount: PKR {Number(payment.amount ?? 0).toFixed(2)}</Text>
                  <Text style={styles.meta}>Method: {payment.paymentMethod ?? "N/A"}</Text>
                  {payment.referenceNumber ? <Text style={styles.meta}>Ref: {payment.referenceNumber}</Text> : null}
                  <Text style={styles.meta}>Date: {formatDate(payment.paidAt)}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardTitle}>#{payment.id}</Text>
                  <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusPaid]}>
                    <Text style={[styles.statusText, isPending ? styles.statusPendingText : styles.statusPaidText]}>
                      {displayStatus}
                    </Text>
                  </View>
                </View>
              </View>
              {isPending && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>⏳ Awaiting Admin Approval</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function getDisplayStatus(payment: PaymentItem): string {
  if (
    (payment.paymentMethod ?? "").toLowerCase().includes("cash") &&
    payment.paymentStatus !== "Paid"
  ) {
    return "Pending";
  }
  return payment.paymentStatus ?? "Unknown";
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground, marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
  summaryValue: { color: colors.foreground, fontSize: 20, fontWeight: "800", marginTop: 4 },
  helper: { color: colors.mutedForeground, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 5,
    marginBottom: 12,
  },
  cardTitle: { color: colors.foreground, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardBody: { flex: 1, gap: 3 },
  cardRight: { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusPending: { backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "#f59e0b" },
  statusPaid: { backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "#10b981" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusPendingText: { color: "#d97706" },
  statusPaidText: { color: "#059669" },
  voucherCode: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  meta: { color: colors.mutedForeground, fontSize: 13 },
  pendingBadge: {
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pendingBadgeText: { color: "#92400e", fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800", marginTop: 8, marginBottom: 8 },
  guestWall: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  guestTitle: { color: colors.foreground, fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  guestSub: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 21 },
  guestBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  guestBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
