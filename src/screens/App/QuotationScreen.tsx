import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";
import {
  acceptQuotation,
  declineQuotation,
  getQuotationActivities,
  getQuotationById,
  getQuotationVersions,
  type QuotationActivity,
} from "../../services/mockQuotationService";
import type { Quotation } from "../../data/mockQuotationData";
import type { AppStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";

// ─── Date formatter ──────────────────────────────────────────────────────────
function formatDate(raw: string | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} ${day} / ${month} / ${year}`;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  active:   { label: "Active",   bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  text: "#059669" },
  inactive: { label: "Inactive", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)", text: "#64748b" },
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  text: "#d97706" },
  approved: { label: "Approved", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)",  text: "#059669" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.3)",   text: "#dc2626" },
  expired:  { label: "Expired",  bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)", text: "#64748b" },
};

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
  const [versions, setVersions] = useState<Quotation[]>([]);
  const [activities, setActivities] = useState<QuotationActivity[]>([]);
  const [actioning, setActioning] = useState<"accept" | "decline" | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

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

  useEffect(() => {
    Promise.allSettled([getQuotationVersions(quotationId), getQuotationActivities()])
      .then(([versionsResult, activitiesResult]) => {
        if (versionsResult.status === "fulfilled") setVersions(versionsResult.value);
        if (activitiesResult.status === "fulfilled") setActivities(activitiesResult.value);
      });
  }, [quotationId]);

  function handleAccept() {
    if (!quotation) return;
    Alert.alert(
      "Accept Quotation",
      "Are you sure you want to accept this quotation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setActioning("accept");
            try {
              await acceptQuotation(quotationId, undefined, quotation.version);
              const [updated, latestActivities] = await Promise.all([
                getQuotationById(quotationId),
                getQuotationActivities(),
              ]);
              setQuotation(updated);
              setActivities(latestActivities);
            } catch (e) {
              Alert.alert("Unable to Accept", e instanceof Error ? e.message : "The quotation could not be accepted.");
            } finally {
              setActioning(null);
            }
          },
        },
      ]
    );
  }

  async function handleRejectConfirm() {
    if (!quotation) return;
    if (!rejectNote.trim()) {
      Alert.alert("Note Required", "Please enter a note before rejecting.");
      return;
    }
    setRejectModalVisible(false);
    setActioning("decline");
    try {
      await declineQuotation(quotationId, rejectNote.trim(), quotation.version);
      const [updated, latestActivities] = await Promise.all([
        getQuotationById(quotationId),
        getQuotationActivities(),
      ]);
      setQuotation(updated);
      setActivities(latestActivities);
      setRejectNote("");
    } catch (e) {
      Alert.alert("Unable to Reject", e instanceof Error ? e.message : "The quotation could not be rejected.");
    } finally {
      setActioning(null);
    }
  }

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
  const status = quotation.status?.toLowerCase() ?? "";
  if (__DEV__) console.log("[QuotationScreen] status:", JSON.stringify(quotation.status), "→", status);
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isActionable = ["active", "pending", "sent", "open", "new", "awaiting", "senttocustomer"].includes(status);
  const isAccepted = status === "approved" || status === "accepted";
  const isRejected = status === "rejected" || status === "declined";

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
              <Text style={s.quotationNumber}>{quotation.quotationNumber || quotation.id}</Text>
              <Text style={s.customerName}>{quotation.customerName}</Text>
            </View>
            <View style={s.brandMark}>
              <Text style={s.brandMarkText}>WN</Text>
            </View>
          </View>
          <View style={s.headerDates}>
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Issued</Text>
              <Text style={s.dateValue}>{formatDate(quotation.quotationDate)}</Text>
            </View>
            <View style={s.dateDivider} />
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Valid Until</Text>
              <Text style={[s.dateValue, { color: colors.danger }]}>{formatDate(quotation.validUntil)}</Text>
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
              <Text style={[s.tableCell, s.textRight]}>PKR {(item.price ?? 0).toLocaleString()}</Text>
              <Text style={[s.tableCell, s.textRight, s.tableCellBold]}>PKR {(item.total ?? 0).toLocaleString()}</Text>
            </View>
          ))}
          <View style={s.tableDivider} />
          {quotation.tax > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>PKR {(quotation.subtotal ?? 0).toLocaleString()}</Text>
            </View>
          )}
          {quotation.tax > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tax</Text>
              <Text style={s.totalValue}>PKR {(quotation.tax ?? 0).toLocaleString()}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.grandTotalRow]}>
            <Text style={s.grandTotalLabel}>Grand Total</Text>
            <Text style={s.grandTotalValue}>PKR {(quotation.total ?? 0).toLocaleString()}</Text>
          </View>
        </View>

        {/* Notes */}
        {!!quotation.notes && (
          <View style={s.notesCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={s.notesText}>{quotation.notes}</Text>
          </View>
        )}

        {versions.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Version History</Text>
            {versions.map((version) => (
              <View key={`${version.id}-${version.version}`} style={s.historyRow}>
                <Text style={s.historyTitle}>Version {version.version ?? 1}</Text>
                <Text style={s.historyMeta}>{version.status || "Created"}</Text>
              </View>
            ))}
          </View>
        )}

        {activities.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Recent Activity</Text>
            {activities.slice(0, 5).map((activity, index) => (
              <View key={activity.id || `${activity.action}-${index}`} style={s.activityRow}>
                <View style={s.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.historyTitle}>{activity.action}</Text>
                  <Text style={s.historyMeta}>{activity.description}{activity.createdAt ? ` · ${activity.createdAt}` : ""}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Reject Note Modal */}
        <Modal
          visible={rejectModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRejectModalVisible(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Reject Quotation</Text>
              <Text style={s.modalSubtitle}>Please provide a reason for rejection.</Text>
              <TextInput
                style={s.noteInput}
                placeholder="Enter note…"
                placeholderTextColor={colors.mutedForeground}
                value={rejectNote}
                onChangeText={setRejectNote}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <View style={s.modalActions}>
                <Pressable
                  style={s.modalCancel}
                  onPress={() => { setRejectModalVisible(false); setRejectNote(""); }}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={s.modalConfirm} onPress={handleRejectConfirm}>
                  <Text style={s.modalConfirmText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Actions */}
        {isActionable ? (
          <View style={s.decisionRow}>
            <Pressable
              style={[s.acceptAction, actioning && { opacity: 0.6 }]}
              onPress={handleAccept}
              disabled={!!actioning}
            >
              {actioning === "accept" ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-outline" size={19} color="#fff" />}
              <Text style={s.acceptActionText}>Accept</Text>
            </Pressable>
            <Pressable
              style={[s.declineAction, actioning && { opacity: 0.6 }]}
              onPress={() => setRejectModalVisible(true)}
              disabled={!!actioning}
            >
              {actioning === "decline" ? <ActivityIndicator size="small" color={colors.danger} /> : <Ionicons name="close-outline" size={19} color={colors.danger} />}
              <Text style={s.declineActionText}>Reject</Text>
            </Pressable>
          </View>
        ) : isAccepted ? (
          <View style={[s.statusNote, { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusNoteTitle, { color: colors.success }]}>Accepted</Text>
              <Text style={[s.statusNoteText, { color: colors.success }]}>Wait for invoice — invoice will be sent to you.</Text>
            </View>
          </View>
        ) : isRejected ? (
          <View style={[s.statusNote, { backgroundColor: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.3)" }]}>
            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusNoteTitle, { color: colors.danger }]}>Rejected</Text>
              <Text style={[s.statusNoteText, { color: colors.danger }]}>Wait for admin action.</Text>
            </View>
          </View>
        ) : (
          <View style={s.statusNote}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={s.statusNoteText}>Processing…</Text>
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

    historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    historyTitle: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
    historyMeta: { color: colors.mutedForeground, fontSize: 12, marginTop: 2, textTransform: "capitalize" },
    activityRow: { flexDirection: "row", gap: 9, paddingVertical: 7 },
    activityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },

    decisionRow: { flexDirection: "row", gap: 10 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
    modalCard: { backgroundColor: colors.card, borderRadius: radii.xl, padding: 24, width: "100%", gap: 12, borderWidth: 1, borderColor: colors.border },
    modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
    modalSubtitle: { color: colors.mutedForeground, fontSize: 13 },
    noteInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, padding: 12, color: colors.foreground, fontSize: 14, minHeight: 100, textAlignVertical: "top", backgroundColor: colors.muted },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalCancel: { flex: 1, paddingVertical: 13, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    modalCancelText: { color: colors.mutedForeground, fontWeight: "700" },
    modalConfirm: { flex: 1, paddingVertical: 13, borderRadius: radii.md, backgroundColor: colors.danger, alignItems: "center" },
    modalConfirmText: { color: "#fff", fontWeight: "800" },
    acceptAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.success, borderRadius: radii.md, paddingVertical: 13 },
    acceptActionText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    declineAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger, paddingVertical: 12 },
    declineActionText: { color: colors.danger, fontSize: 15, fontWeight: "800" },

    statusNote: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.muted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border },
    statusNoteTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
    statusNoteText: { flex: 1, color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  });
