import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { getMyPayments, type PaymentItem } from "../../services/paymentService";

export default function MyPaymentsScreen() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPayments()
      .then((items) => setPayments(items))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPaid = useMemo(
    () =>
      payments
        .filter((payment) => payment.paymentStatus === "Paid")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments]
  );
  const totalPending = useMemo(
    () =>
      payments
        .filter((payment) => payment.paymentStatus === "Pending")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments]
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />
        <Text style={styles.title}>My Payments</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>${totalPaid.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Pending</Text>
            <Text style={styles.summaryValue}>${totalPending.toFixed(2)}</Text>
          </View>
        </View>

        {loading ? <Text style={styles.helper}>Loading payments...</Text> : null}
        {!loading && payments.length === 0 ? (
          <Text style={styles.helper}>No payments found.</Text>
        ) : null}

        {payments.map((payment) => (
          <View key={payment.id} style={styles.card}>
            <Text style={styles.cardTitle}>Payment #{payment.id}</Text>
            <Text style={styles.meta}>Amount: ${Number(payment.amount ?? 0).toFixed(2)}</Text>
            <Text style={styles.meta}>Method: {payment.paymentMethod ?? "N/A"}</Text>
            <Text style={styles.meta}>Status: {payment.paymentStatus ?? "Unknown"}</Text>
            <Text style={styles.meta}>Date: {formatDate(payment.paidAt)}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 5,
    marginBottom: 12,
  },
  cardTitle: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.mutedForeground, fontSize: 13 },
});
