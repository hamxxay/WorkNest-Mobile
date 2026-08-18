import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";
import { getChallan } from "../../services/mockQuotationService";
import { simulatePayment } from "../../services/mockPaymentService";
import type { Challan } from "../../data/mockQuotationData";
import type { AppStackParamList } from "../../navigation/types";

export default function QuotationPaymentScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "QuotationPayment">>();
  const { quotationId } = route.params;

  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getChallan(quotationId)
      .then(setChallan)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load challan."))
      .finally(() => setLoading(false));
  }, [quotationId]);

  async function handlePayment() {
    if (!challan) return;
    setPaying(true);
    setError("");
    try {
      const result = await simulatePayment(challan.challanId, challan.amount);
      setTransactionId(result.transactionId);
      setPaidAt(result.paidAt);
      setPaid(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading challan…</Text>
        </View>
      </Screen>
    );
  }

  if (error && !challan) {
    return (
      <Screen>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />
          <Text style={s.errorTitle}>Challan Not Found</Text>
          <Text style={s.errorBody}>{error}</Text>
          <Pressable style={s.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={s.primaryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable style={s.topBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={s.topTitle}>Payment</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Status banner */}
        {paid ? (
          <View style={s.paidBanner}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <Text style={s.paidBannerText}>Payment Approved</Text>
          </View>
        ) : (
          <View style={s.pendingBanner}>
            <Ionicons name="card-outline" size={22} color="#d97706" />
            <Text style={s.pendingBannerText}>Payment Required</Text>
          </View>
        )}

        {/* Challan card */}
        {challan && (
          <View style={s.challanCard}>
            <View style={s.challanHeader}>
              <View>
                <Text style={s.challanHeaderLabel}>Challan No.</Text>
                <Text style={s.challanHeaderValue}>{challan.challanId}</Text>
              </View>
              <View style={[s.statusPill, paid ? s.statusPaid : s.statusPending]}>
                <Text style={[s.statusPillText, { color: paid ? colors.success : "#d97706" }]}>
                  {paid ? "Paid" : "Pending Payment"}
                </Text>
              </View>
            </View>

            <View style={s.infoBlock}>
              <InfoRow label="Quotation" value={challan.quotationId} />
              <InfoRow label="Customer" value={challan.customerName} />
              <InfoRow label="Issued" value={challan.issuedAt} />
              {challan.deadline && <InfoRow label="Payment Deadline" value={challan.deadline} highlight />}
            </View>

            <View style={s.amountBlock}>
              <Text style={s.amountLabel}>Amount Payable</Text>
              <Text style={s.amountValue}>PKR {challan.amount.toLocaleString()}</Text>
            </View>

            {challan.instructions && !paid && (
              <View style={s.instructionsBlock}>
                <Text style={s.instructionsTitle}>Payment Instructions</Text>
                <Text style={s.instructionsText}>{challan.instructions}</Text>
              </View>
            )}

            {paid && (
              <View style={s.receiptBlock}>
                <Text style={s.receiptTitle}>Payment Receipt</Text>
                <InfoRow label="Transaction ID" value={transactionId} />
                <InfoRow label="Paid At" value={paidAt} />
                <InfoRow label="Status" value="Approved ✓" />
              </View>
            )}
          </View>
        )}

        {!!error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        {!paid ? (
          <Pressable style={[s.primaryBtn, paying && { opacity: 0.6 }]} onPress={handlePayment} disabled={paying}>
            {paying
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="card-outline" size={20} color="#fff" /><Text style={s.primaryBtnText}>Proceed to Payment</Text></>
            }
          </Pressable>
        ) : (
          <Pressable style={s.homeBtn} onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}>
            <Ionicons name="home-outline" size={18} color={colors.primary} />
            <Text style={s.homeBtnText}>Back to Home</Text>
          </Pressable>
        )}

      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: highlight ? colors.danger : colors.foreground, fontSize: 13, fontWeight: "600", flex: 2, textAlign: "right" }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
    loadingText: { color: colors.mutedForeground, fontSize: 14 },
    errorTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
    errorBody: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
    topBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },

    paidBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.successMuted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: "#6ee7b7" },
    paidBannerText: { color: colors.success, fontSize: 16, fontWeight: "800" },
    pendingBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fef3c7", borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: "#fde68a" },
    pendingBannerText: { color: "#d97706", fontSize: 16, fontWeight: "800" },

    challanCard: { backgroundColor: colors.card, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadows.md },
    challanHeader: { backgroundColor: "#1e3a5f", padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    challanHeaderLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginBottom: 3 },
    challanHeaderValue: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
    statusPaid: { backgroundColor: colors.successMuted, borderColor: "#6ee7b7" },
    statusPending: { backgroundColor: "#fef3c7", borderColor: "#fde68a" },
    statusPillText: { fontSize: 12, fontWeight: "700" },

    infoBlock: { paddingHorizontal: 16, paddingVertical: 12, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    amountBlock: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: colors.primaryMuted, alignItems: "center" },
    amountLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700", marginBottom: 4 },
    amountValue: { color: colors.primary, fontSize: 28, fontWeight: "900" },

    instructionsBlock: { margin: 16, backgroundColor: "#eff6ff", borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: "#bfdbfe" },
    instructionsTitle: { color: "#1e40af", fontSize: 13, fontWeight: "700", marginBottom: 6 },
    instructionsText: { color: "#1e40af", fontSize: 13, lineHeight: 19 },

    receiptBlock: { margin: 16, backgroundColor: colors.successMuted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: "#6ee7b7", gap: 2 },
    receiptTitle: { color: colors.success, fontSize: 13, fontWeight: "700", marginBottom: 4 },

    errorBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.dangerMuted, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.danger },
    errorText: { flex: 1, color: colors.danger, fontSize: 13 },

    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 15, ...shadows.sm, shadowColor: colors.primary },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    homeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 14, borderWidth: 1.5, borderColor: colors.primary },
    homeBtnText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  });
