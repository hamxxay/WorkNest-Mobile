import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { DashboardHeader } from "../../../components/DashboardHeader";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";
import { getQuotations, type QuotationRecord } from "../../../services/quotationService";
import { getBookings, type BookingRecord } from "../../../services/bookingService";
import { getCustomers, type CustomerRecord } from "../../../services/customerService";

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusColor(status: string | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "accepted":
    case "confirmed":
    case "approved":
    case "active":
      return "#059669";
    case "pending":
    case "draft":
    case "sent":
      return "#f59e0b";
    case "cancelled":
    case "rejected":
    case "declined":
      return "#ef4444";
    default:
      return "#6366f1";
  }
}

// ─── Pipeline derivation ──────────────────────────────────────────────────────
function derivePipeline(quotations: QuotationRecord[]) {
  const counts = { draft: 0, sent: 0, accepted: 0, declined: 0 };
  for (const q of quotations) {
    const s = (q.status ?? "draft").toLowerCase();
    if (s === "draft")         counts.draft++;
    else if (s === "sent")     counts.sent++;
    else if (s === "accepted") counts.accepted++;
    else if (s === "declined") counts.declined++;
  }
  return [
    { label: "Draft",    count: counts.draft,    color: "#6366f1" },
    { label: "Sent",     count: counts.sent,     color: "#f59e0b" },
    { label: "Accepted", count: counts.accepted,  color: "#059669" },
    { label: "Declined", count: counts.declined,  color: "#ef4444" },
  ];
}

export default function SaleDashboard({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const [quotations, setQuotations]   = useState<QuotationRecord[]>([]);
  const [bookings, setBookings]       = useState<BookingRecord[]>([]);
  const [customers, setCustomers]     = useState<CustomerRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [quotRes, bookRes, custRes] = await Promise.all([
        getQuotations(1, 100).catch(() => ({ data: [] as QuotationRecord[], total: 0, page: 1, limit: 100 })),
        getBookings().catch(() => [] as BookingRecord[]),
        getCustomers().catch(() => [] as CustomerRecord[]),
      ]);

      setQuotations(quotRes.data);
      setBookings(Array.isArray(bookRes) ? bookRes : []);
      setCustomers(Array.isArray(custRes) ? custRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const totalQuotations = quotations.length;
  const acceptedQuotations = quotations.filter(
    (q) => (q.status ?? "").toLowerCase() === "accepted"
  ).length;
  const totalBookings = bookings.length;
  const totalCustomers = customers.length;

  const KPI_CARDS = [
    { label: "Total Customers",   value: totalCustomers,    icon: "people-outline"          },
    { label: "Total Quotations",  value: totalQuotations,   icon: "document-text-outline"   },
    { label: "Deals Closed",      value: acceptedQuotations, icon: "checkmark-circle-outline" },
    { label: "Total Bookings",    value: totalBookings,     icon: "calendar-outline"         },
  ];

  const pipeline = derivePipeline(quotations);
  const recentQuotations = [...quotations]
    .sort((a, b) => (b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1)
    .slice(0, 5);

  return (
    <Screen>
      <DashboardHeader role="Sales" title="Sales Dashboard" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={styles.subtitle}>
          Your pipeline, quotations, and performance at a glance.
        </Text>

        {/* ── Error banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── KPI cards ── */}
        <Text style={styles.sectionLabel}>Key Metrics</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading KPIs…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {KPI_CARDS.map((card) => (
              <View key={card.label} style={styles.kpiCard}>
                <View style={styles.kpiIconWell}>
                  <Ionicons name={card.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.kpiValue}>{card.value}</Text>
                <Text style={styles.kpiLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Pipeline ── */}
        <Text style={styles.sectionLabel}>Quotation Pipeline</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.pipelineRow}>
            {pipeline.map((stage) => (
              <View key={stage.label} style={styles.pipelineCard}>
                <View style={[styles.pipelineDot, { backgroundColor: stage.color }]} />
                <Text style={styles.pipelineCount}>{stage.count}</Text>
                <Text style={styles.pipelineLabel}>{stage.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Customer Management ── */}
        <Text style={styles.sectionLabel}>Customer Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate("CustomerCreate")}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate("CustomerList")}
          >
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Customer List</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quotation Management ── */}
        <Text style={styles.sectionLabel}>Quotation Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate("QuotationCreate")}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Quotation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate("QuotationList")}
          >
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Quotation List</Text>
          </TouchableOpacity>
        </View>

        {/* ── Booking Management ── */}
        <Text style={styles.sectionLabel}>Booking Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate("BookingCreate")}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Booking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate("BookingList")}
          >
            <Ionicons name="calendar-number-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Booking List</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent Quotations ── */}
        <Text style={styles.sectionLabel}>Recent Quotations</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : recentQuotations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No quotations yet.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recentQuotations.map((q, i) => (
              <TouchableOpacity
                key={q.id ?? i}
                style={[styles.listRow, i < recentQuotations.length - 1 && styles.listRowBorder]}
                activeOpacity={0.7}
                onPress={() => {
                  try { navigation.navigate("Quotation", { quotationId: String(q.id) }); } catch {}
                }}
              >
                <View style={styles.listRowLeft}>
                  <Text style={styles.listRowPrimary} numberOfLines={1}>
                    {q.quotationNumber ?? `#${q.id}`}
                  </Text>
                  <Text style={styles.listRowSecondary} numberOfLines={1}>
                    {q.customerName ?? "—"}{q.spaceName ? `  ·  ${q.spaceName}` : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(q.status) + "22" },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor(q.status) }]}>
                    {q.status ?? "draft"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },

    headingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    iconWell: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.sm,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginBottom: 16,
    },

    // Error
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#ef444420",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: "#ef4444",
      padding: 10,
      marginBottom: 8,
    },
    errorText: { flex: 1, color: "#ef4444", fontSize: 13 },
    retryText: { color: colors.primary, fontWeight: "700", fontSize: 13 },

    // Loading
    loadingBox: {
      alignItems: "center",
      paddingVertical: 32,
      gap: 10,
    },
    loadingText: {
      color: colors.mutedForeground,
      fontSize: 13,
    },

    sectionLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.mutedForeground,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 16,
      marginBottom: 10,
    },

    // KPI cards
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kpiCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
      ...shadows.sm,
    },
    kpiIconWell: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiValue: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    kpiLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },

    // Pipeline
    pipelineRow: { flexDirection: "row", gap: 8 },
    pipelineCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      alignItems: "center",
      gap: 6,
      ...shadows.sm,
    },
    pipelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    pipelineCount: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.foreground,
    },
    pipelineLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.mutedForeground,
      textAlign: "center",
    },

    // Action buttons
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    primaryAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 12,
      ...shadows.sm,
    },
    primaryActionText: {
      color: colors.white,
      fontWeight: "800",
      fontSize: 13,
    },
    secondaryAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryActionText: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 13,
    },

    // List card (recent quotations)
    listCard: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.sm,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    listRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listRowLeft: { flex: 1, gap: 2 },
    listRowPrimary: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    listRowSecondary: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    statusBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "capitalize",
    },

    // Empty state
    emptyCard: {
      backgroundColor: colors.muted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      color: colors.mutedForeground,
      fontSize: 13,
      textAlign: "center",
    },
  });
