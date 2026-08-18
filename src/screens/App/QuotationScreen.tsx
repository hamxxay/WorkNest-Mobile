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
import { getQuotationById } from "../../services/mockQuotationService";
import type { Quotation } from "../../data/mockQuotationData";
import type { AppStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  text: "#d97706" },
  approved: { label: "Approved", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  text: "#059669" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.3)",   text: "#dc2626" },
  expired:  { label: "Expired",  bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)", text: "#64748b" },
} as const;

export default function QuotationScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Quotation">>();
  const { quotationId } = route.params;

  const { user, isLoadingUser } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auth guard — redirect to Login then back after successful login
  useEffect(() => {
    if (!isLoadingUser && !user) {
      navigation.replace("Login", {
        redirectAfterLogin: { screen: "Quotation", params: { quotationId } },
      });
    }
  }, [isLoadingUser, user, navigation, quotationId]);

  useEffect(() => {
    setLoading(true);
    setError("");
    getQuotationById(quotationId)
      .then(setQuotation)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load quotation."))
      .finally(() => setLoading(false));
  }, [quotationId]);

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading quotation…</Text>
        </View>
      </Screen>
    );
  }

  if (error || !quotation) {
    return (
      <Screen>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />
          <Text style={s.errorTitle}>Quotation Not Found</Text>
          <Text style={s.errorBody}>{error || "This quotation does not exist or has been removed."}</Text>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const statusCfg = STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.pending;
  const isActionable = quotation.status === "pending" || quotation.status === "approved";

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable style={s.topBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={s.topTitle}>Quotation</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              style={s.shareBtn}
              onPress={() => navigation.navigate("ShareQuotation", { quotationId: quotation.id })}
            >
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
            </Pressable>
            <View style={[s.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
              <Text style={[s.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* Header card */}
        <View style={s.headerCard}>
          <View style={s.headerCardTop}>
            <View>
              <Text style={s.quotationNumber}>{quotation.id}</Text>
              <Text style={s.customerName}>{quotation.customerName}</Text>
            </View>
            <View style={s.brandMark}>
              <Text style={s.brandMarkText}>WN</Text>
            </View>
          </View>
          <View style={s.headerDates}>
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Issued</Text>
              <Text style={s.dateValue}>{quotation.quotationDate}</Text>
            </View>
            <View style={s.dateDivider} />
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Valid Until</Text>
              <Text style={[s.dateValue, { color: colors.danger }]}>{quotation.validUntil}</Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Items</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 3 }]}>Description</Text>
            <Text style={[s.tableHeaderCell, s.textCenter]}>Qty</Text>
            <Text style={[s.tableHeaderCell, s.textRight]}>Unit Price</Text>
            <Text style={[s.tableHeaderCell, s.textRight]}>Total</Text>
          </View>
          {quotation.items.map((item, i) => (
            <View key={item.id} style={[s.tableRow, i < quotation.items.length - 1 && s.tableRowBorder]}>
              <Text style={[s.tableCell, { flex: 3 }]}>{item.name}</Text>
              <Text style={[s.tableCell, s.textCenter]}>{item.quantity}</Text>
              <Text style={[s.tableCell, s.textRight]}>PKR {item.price.toLocaleString()}</Text>
              <Text style={[s.tableCell, s.textRight, s.tableCellBold]}>PKR {item.total.toLocaleString()}</Text>
            </View>
          ))}
          <View style={s.tableDivider} />
          {quotation.tax > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>PKR {quotation.subtotal.toLocaleString()}</Text>
            </View>
          )}
          {quotation.tax > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tax</Text>
              <Text style={s.totalValue}>PKR {quotation.tax.toLocaleString()}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.grandTotalRow]}>
            <Text style={s.grandTotalLabel}>Grand Total</Text>
            <Text style={s.grandTotalValue}>PKR {quotation.total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Notes */}
        {!!quotation.notes && (
          <View style={s.notesCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={s.notesText}>{quotation.notes}</Text>
          </View>
        )}

        {/* Actions */}
        {isActionable ? (
          <View style={s.actions}>
            <Pressable
              style={s.primaryAction}
              onPress={() => navigation.navigate("CustomerInfo", { quotationId: quotation.id })}
            >
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={s.primaryActionText}>Request Challan</Text>
            </Pressable>
            <Pressable
              style={s.secondaryAction}
              onPress={() => navigation.navigate("ModifyOrder", { quotationId: quotation.id })}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={s.secondaryActionText}>Modify Order</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.expiredNote}>
            <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
            <Text style={s.expiredNoteText}>
              This quotation is {quotation.status} and can no longer be actioned.
            </Text>
          </View>
        )}

      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
    loadingText: { color: colors.mutedForeground, fontSize: 14, marginTop: 8 },
    errorTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800", textAlign: "center" },
    errorBody: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 20 },
    backBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: radii.md },
    backBtnText: { color: "#fff", fontWeight: "700" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
    topBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1 },
    statusText: { fontSize: 12, fontWeight: "700" },
    shareBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

    headerCard: {
      backgroundColor: "#1e3a5f",
      borderRadius: radii.xl,
      padding: 20,
      gap: 16,
      ...shadows.md,
    },
    headerCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    quotationNumber: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
    customerName: { color: "#fff", fontSize: 20, fontWeight: "800" },
    brandMark: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
    brandMarkText: { color: "#fff", fontSize: 16, fontWeight: "900" },
    headerDates: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radii.md, padding: 12 },
    dateItem: { flex: 1, alignItems: "center" },
    dateLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", marginBottom: 3 },
    dateValue: { color: "#fff", fontSize: 13, fontWeight: "700" },
    dateDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },

    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
    sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800", marginBottom: 4 },

    tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableHeaderCell: { flex: 2, fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", paddingVertical: 10 },
    tableRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    tableCell: { flex: 2, fontSize: 13, color: colors.foreground },
    tableCellBold: { fontWeight: "700" },
    tableDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    textCenter: { textAlign: "center" },
    textRight: { textAlign: "right" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalLabel: { color: colors.mutedForeground, fontSize: 13 },
    totalValue: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
    grandTotalRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
    grandTotalLabel: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
    grandTotalValue: { color: colors.primary, fontSize: 18, fontWeight: "800" },

    notesCard: { flexDirection: "row", gap: 8, backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
    notesText: { flex: 1, color: colors.foreground, fontSize: 13, lineHeight: 19 },

    actions: { gap: 10 },
    primaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 15, ...shadows.sm, shadowColor: colors.primary },
    primaryActionText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 14, borderWidth: 1.5, borderColor: colors.primary },
    secondaryActionText: { color: colors.primary, fontSize: 16, fontWeight: "700" },

    expiredNote: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.muted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border },
    expiredNoteText: { flex: 1, color: colors.mutedForeground, fontSize: 13 },
  });
