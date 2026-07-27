import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { generatePDF } from "react-native-html-to-pdf";
import RNShare from "react-native-share";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { apiRequest } from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import type { AppStackParamList } from "../../navigation/types";

type BookingDetail = {
  feeType?: string;
  FeeType?: string;
  amount?: number;
  Amount?: number;
  status?: number;
};

type ChallanData = {
  id?: number;
  idGuid?: string;
  challanNumber?: string;
  validityDate?: string;
  totalAmount?: number;
  bookingStatus?: number | string;
  startDateTime?: string;
  endDateTime?: string;
  notes?: string;
  customerCode?: string;
  spaceName?: string;
  spaceCode?: string;
  spaceTypeName?: string;
  locationName?: string;
  customerName?: string;
  customerEmail?: string;
  bookingDetails?: BookingDetail[];
};

type ApiChallanResponse = {
  booking?: ChallanData;
  bookingDetails?: BookingDetail[];
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(status?: number | string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "1" || s === "confirmed") return "Confirmed";
  if (s === "2" || s === "cancelled") return "Cancelled";
  if (s === "3" || s === "completed") return "Completed";
  if (s === "4" || s === "pending")   return "Pending";
  return "Pending";
}

export default function ChallanScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Challan">>();
  const { challanNumber, bookingGuid } = route.params;

  const [challan, setChallan] = useState<ChallanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const fetchChallan = async () => {
      setLoading(true);
      setError("");
      try {
        let data: ChallanData | null = null;
        let details: BookingDetail[] | undefined;

        if (challanNumber) {
          const res = await apiRequest<ApiChallanResponse>(
            API_ENDPOINTS.booking.challan(challanNumber),
            { requiresAuth: true }
          );
          data = res?.booking ?? (res as unknown as ChallanData);
          details = res?.bookingDetails ?? (data as any)?.bookingDetails;
        } else if (bookingGuid) {
          const res = await apiRequest<ApiChallanResponse>(
            API_ENDPOINTS.booking.details(bookingGuid),
            { requiresAuth: true }
          );
          data = res?.booking ?? (res as unknown as ChallanData);
          details = res?.bookingDetails ?? (data as any)?.bookingDetails;
        }

        if (!data) {
          setError("Challan not found.");
        } else {
          if (details?.length && !data.bookingDetails?.length) {
            data = { ...data, bookingDetails: details };
          }
          setChallan(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load challan.");
      } finally {
        setLoading(false);
      }
    };

    fetchChallan();
  }, [challanNumber, bookingGuid]);

  const buildChallanHtml = (c: ChallanData) => {
    const detailRows = (c.bookingDetails ?? []).map((d) => {
      const label = d.feeType ?? d.FeeType ?? "Fee";
      const amt = Number(d.amount ?? d.Amount ?? 0).toFixed(2);
      const isDeposit = label.toLowerCase().includes("security") || label.toLowerCase().includes("deposit");
      return `<tr><td>${label}${isDeposit ? ' <span style="color:#64748b;font-size:11px">(refundable)</span>' : ""}</td><td style="text-align:right">PKR ${amt}</td></tr>`;
    }).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:sans-serif;margin:0;padding:24px;background:#f1f5f9}
  .card{background:#fff;border-radius:12px;overflow:hidden;max-width:480px;margin:0 auto;box-shadow:0 4px 24px rgba(30,58,95,.12)}
  .header{background:#1e3a5f;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
  .brand{font-size:20px;font-weight:800;letter-spacing:.5px}.brand-sub{font-size:11px;opacity:.75;margin-top:2px}
  .challan-no{text-align:right}.challan-no-label{font-size:10px;opacity:.65}.challan-no-val{font-size:15px;font-weight:700;letter-spacing:1px;margin-top:2px}
  .validity{background:#fef3c7;border-bottom:1px solid #fde68a;padding:8px 24px;display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#92400e}
  .status{padding:14px 24px 4px}
  .badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}
  .confirmed{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#059669}
  .pending{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#d97706}
  .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
  .block{margin:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
  .block-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
  .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
  .row-label{color:#64748b}.row-val{font-weight:600;color:#1e293b;text-align:right}
  .divider{height:1px;background:#e2e8f0;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:9px 0;font-size:13px;color:#475569}
  td:last-child{text-align:right;font-weight:600;color:#1e293b}
  .total-row td{border-top:1px solid #e2e8f0;font-size:14px;font-weight:800;color:#1e3a5f;padding-top:10px}
  .ref{margin:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 14px;font-size:13px;color:#1e40af}
  .footer{text-align:center;padding:14px 20px 16px;border-top:1px dashed #e2e8f0;margin-top:12px;color:#94a3b8;font-size:11px}
  .footer-brand{color:#1e3a5f;font-weight:700;font-size:12px;margin-top:4px}
</style></head><body>
<div class="card">
  <div class="header">
    <div><div class="brand">WORKNEST</div><div class="brand-sub">Payment Challan</div></div>
    <div class="challan-no"><div class="challan-no-label">Challan No.</div><div class="challan-no-val">${c.challanNumber ?? "N/A"}</div></div>
  </div>
  <div class="validity"><span>⚠ Valid until: <strong>${formatDate(c.validityDate)}</strong></span><span>Pay before expiry</span></div>
  <div class="status"><span class="badge ${statusLabel(c.bookingStatus) === "Confirmed" || statusLabel(c.bookingStatus) === "Completed" ? "confirmed" : "pending"}"><span class="dot" style="background:${statusLabel(c.bookingStatus) === "Confirmed" || statusLabel(c.bookingStatus) === "Completed" ? "#10b981" : "#f59e0b"}"></span>${statusLabel(c.bookingStatus)}</span></div>
  <div class="block">
    <div class="row"><span class="row-label">Space</span><span class="row-val">${c.spaceName ?? "—"}${c.spaceCode ? ` (${c.spaceCode})` : ""}</span></div>
    <div class="row"><span class="row-label">Type</span><span class="row-val">${c.spaceTypeName ?? "—"}</span></div>
    <div class="row"><span class="row-label">Location</span><span class="row-val">${c.locationName ?? "—"}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="row-label">Check-In</span><span class="row-val">${formatDateTime(c.startDateTime)}</span></div>
    <div class="row"><span class="row-label">Check-Out</span><span class="row-val">${formatDateTime(c.endDateTime)}</span></div>
  </div>
  <div class="block">
    <div class="block-label">Customer</div>
    <div class="row"><span class="row-label">Name</span><span class="row-val">${c.customerName ?? "—"}</span></div>
    <div class="row"><span class="row-label">Email</span><span class="row-val">${c.customerEmail ?? "—"}</span></div>
    ${c.customerCode ? `<div class="row"><span class="row-label">Code</span><span class="row-val">${c.customerCode}</span></div>` : ""}
  </div>
  <div class="block">
    <div class="block-label">Amount Breakdown</div>
    <table>${detailRows}<tr class="total-row"><td>Total Payable</td><td>PKR ${Number(c.totalAmount ?? 0).toFixed(2)}</td></tr></table>
  </div>
  <div class="ref">Booking Ref: <strong>#${c.id ?? "—"}</strong></div>
  <div class="footer">Present this challan at the WorkNest counter to complete payment.<div class="footer-brand">worknestpk.com</div></div>
</div>
</body></html>`;
  };

  const getPdfPath = async (): Promise<string> => {
    if (!challan) throw new Error("No challan data");
    const result = await generatePDF({
      html: buildChallanHtml(challan),
      fileName: `WorkNest_Challan_${challan.challanNumber ?? "challan"}`,
      directory: Platform.OS === "ios" ? "Documents" : undefined,
    });
    const path = result?.filePath;
    if (!path) throw new Error("PDF generation failed: no file path returned");
    return path;
  };

  const handleSave = async () => {
    if (!challan) return;
    setSharing(true);
    try {
      const path = await getPdfPath();
      await RNShare.open({
        url: `file://${path}`,
        type: "application/pdf",
        title: `Save Challan — ${challan.challanNumber ?? ""}`,
        saveToFiles: true,
        failOnCancel: false,
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save PDF.");
    } finally {
      setSharing(false);
    }
  };

  const handleShare = async () => {
    if (!challan) return;
    setSharing(true);
    try {
      const path = await getPdfPath();
      await RNShare.open({
        url: `file://${path}`,
        type: "application/pdf",
        title: `WorkNest Challan — ${challan.challanNumber ?? ""}`,
        failOnCancel: false,
      });
    } catch {
      // user cancelled
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = async () => {
    if (!challan) return;
    setSharing(true);
    try {
      const path = await getPdfPath();
      await RNShare.open({
        url: `file://${path}`,
        type: "application/pdf",
        title: `Print Challan — ${challan.challanNumber ?? ""}`,
        failOnCancel: false,
      });
    } catch {
      Alert.alert("Error", "Failed to open print dialog.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading challan...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !challan) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error || "Challan not found."}</Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const status = statusLabel(challan.bookingStatus);
  const isConfirmed = status === "Confirmed" || status === "Completed";
  const hasDetails = (challan.bookingDetails?.length ?? 0) > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.topBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={styles.topTitle}>Payment Challan</Text>
          <Pressable style={styles.shareBtn} onPress={handleShare} disabled={sharing} hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Bank-style challan card (mirrors web design) ── */}
        <View style={styles.challanCard}>

          {/* Bank header — dark blue like web */}
          <View style={styles.bankHeader}>
            <View>
              <Text style={styles.bankBrand}>WORKNEST</Text>
              <Text style={styles.bankSubtitle}>Payment Challan</Text>
            </View>
            <View style={styles.bankRight}>
              <Text style={styles.bankChallanLabel}>Challan No.</Text>
              <Text style={styles.bankChallanNumber}>{challan.challanNumber ?? "N/A"}</Text>
            </View>
          </View>

          {/* Validity banner — amber like web */}
          <View style={styles.validityBanner}>
            <Text style={styles.validityText}>
              ⚠ Valid until: <Text style={styles.validityDate}>{formatDate(challan.validityDate)}</Text>
            </Text>
            <Text style={styles.validityRight}>Pay before expiry</Text>
          </View>

          {/* Status badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, isConfirmed ? styles.statusConfirmed : styles.statusPending]}>
              <View style={[styles.statusDot, { backgroundColor: isConfirmed ? "#10b981" : "#f59e0b" }]} />
              <Text style={[styles.statusText, { color: isConfirmed ? "#059669" : "#d97706" }]}>{status}</Text>
            </View>
          </View>

          {/* Space & Period block */}
          <View style={styles.infoBlock}>
            <InfoRow label="Space" value={`${challan.spaceName ?? "—"}${challan.spaceCode ? ` (${challan.spaceCode})` : ""}`} />
            <InfoRow label="Type" value={challan.spaceTypeName ?? "—"} />
            <InfoRow label="Location" value={challan.locationName ?? "—"} />
            <View style={styles.infoBlockDivider} />
            <InfoRow label="Check-In" value={formatDateTime(challan.startDateTime)} />
            <InfoRow label="Check-Out" value={formatDateTime(challan.endDateTime)} />
          </View>

          {/* Customer block */}
          <View style={styles.infoBlock}>
            <Text style={styles.blockSectionLabel}>CUSTOMER</Text>
            <InfoRow label="Name" value={challan.customerName ?? "—"} />
            <InfoRow label="Email" value={challan.customerEmail ?? "—"} />
            {challan.customerCode ? <InfoRow label="Code" value={challan.customerCode} /> : null}
          </View>

          {/* Amount breakdown — matches web table */}
          <View style={styles.amountBlock}>
            <View style={styles.amountBlockHeader}>
              <Text style={styles.amountBlockTitle}>AMOUNT BREAKDOWN</Text>
            </View>
            <View style={styles.amountBlockBody}>
              {hasDetails ? (
                challan.bookingDetails!.map((d, i) => {
                  const label = d.feeType ?? d.FeeType ?? "Fee";
                  const amt = d.amount ?? d.Amount ?? 0;
                  const isDeposit = label.toLowerCase().includes("security") || label.toLowerCase().includes("deposit");
                  return (
                    <View key={i} style={[styles.amountRow, i < challan.bookingDetails!.length - 1 && styles.amountRowBorder]}>
                      <Text style={styles.amountLabel}>
                        {label}
                        {isDeposit ? <Text style={styles.refundableTag}> (refundable)</Text> : null}
                      </Text>
                      <Text style={styles.amountValue}>PKR {Number(amt).toFixed(2)}</Text>
                    </View>
                  );
                })
              ) : null}
              <View style={[styles.amountRow, styles.amountTotalRow]}>
                <Text style={styles.amountTotalLabel}>Total Payable</Text>
                <Text style={styles.amountTotalValue}>PKR {Number(challan.totalAmount ?? 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Booking ref row */}
          <View style={styles.bookingRefRow}>
            <Text style={styles.bookingRefText}>
              Booking Ref: <Text style={styles.bookingRefId}>#{challan.id ?? "—"}</Text>
            </Text>
          </View>

          {/* Footer note */}
          <Text style={styles.footerNote}>
            Present this challan at the WorkNest counter to complete payment.
          </Text>
          <Text style={styles.footerBrand}>worknestpk.com</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={handleSave} disabled={sharing}>
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={styles.actionBtnText}>Save PDF</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handleShare} disabled={sharing}>
            <Ionicons name="share-outline" size={18} color={colors.primary} />
            <Text style={styles.actionBtnText}>Share</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handlePrint} disabled={sharing}>
            <Ionicons name="print-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>Print</Text>
          </Pressable>
        </View>

      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 2, textAlign: "right" }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { paddingHorizontal: 18, paddingBottom: 32, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { color: colors.mutedForeground, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 15, fontWeight: "700", textAlign: "center" },
  backBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: colors.primary, borderRadius: radii.md,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 12, paddingBottom: 4,
  },
  topBackBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.muted, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
  shareBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },

  challanCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#1e3a5f",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  // Bank header — dark blue matching web #1e3a5f
  bankHeader: {
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bankBrand: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  bankSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  bankRight: { alignItems: "flex-end" },
  bankChallanLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10 },
  bankChallanNumber: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1, marginTop: 2 },

  // Validity banner — amber matching web #fef3c7
  validityBanner: {
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  validityText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  validityDate: { fontWeight: "800" },
  validityRight: { color: "#92400e", fontSize: 11 },

  statusRow: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  statusConfirmed: { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" },
  statusPending: { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "700" },

  // Info blocks — light bg matching web #f8fafc
  infoBlock: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoBlockDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e2e8f0", marginVertical: 6 },
  blockSectionLabel: {
    fontSize: 10, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6,
  },

  // Amount breakdown — matches web table
  amountBlock: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  amountBlockHeader: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  amountBlockTitle: {
    fontSize: 10, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  amountBlockBody: { paddingHorizontal: 14 },
  amountRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 9,
  },
  amountRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  amountLabel: { color: "#475569", fontSize: 13, flex: 1 },
  amountValue: { color: "#1e293b", fontSize: 13, fontWeight: "600" },
  refundableTag: { color: "#64748b", fontSize: 11 },
  amountTotalRow: {
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    marginTop: 2,
  },
  amountTotalLabel: { color: "#1e3a5f", fontSize: 14, fontWeight: "800", flex: 1 },
  amountTotalValue: { color: "#1e3a5f", fontSize: 15, fontWeight: "800" },

  // Booking ref row — light blue matching web #eff6ff
  bookingRefRow: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bookingRefText: { color: "#1e40af", fontSize: 13 },
  bookingRefId: { fontWeight: "700" },

  footerNote: {
    color: "#94a3b8", fontSize: 11, lineHeight: 16,
    textAlign: "center", marginTop: 14, marginHorizontal: 20,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  footerBrand: {
    color: "#1e3a5f", fontSize: 12, fontWeight: "700",
    textAlign: "center", marginTop: 4, marginBottom: 16,
  },

  actions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnText: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
});
