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
import {
  getDashboardSummary,
  getRecentBookings,
  getRecentContacts,
  type DashboardSummary,
  type RecentBooking,
  type RecentContact,
} from "../../../services/adminService";

// ─── Status badge helper ──────────────────────────────────────────────────────
function statusColor(status: string | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "approved":
    case "active":
      return "#059669";
    case "pending":
      return "#f59e0b";
    case "cancelled":
    case "rejected":
      return "#ef4444";
    default:
      return "#6366f1";
  }
}

// ─── Stat card config ─────────────────────────────────────────────────────────
type StatCard = {
  label: string;
  key: keyof DashboardSummary;
  icon: string;
};

const STAT_CARDS: StatCard[] = [
  { label: "Total Users",   key: "users",       icon: "people-outline"        },
  { label: "Spaces",        key: "spaces",       icon: "business-outline"      },
  { label: "Bookings",      key: "bookings",     icon: "calendar-outline"      },
  { label: "Contacts",      key: "contacts",     icon: "mail-outline"          },
  { label: "Locations",     key: "locations",    icon: "location-outline"      },
  { label: "Memberships",   key: "memberships",  icon: "card-outline"          },
  { label: "Pricing Plans", key: "plans",        icon: "pricetag-outline"      },
  { label: "Gallery",       key: "gallery",      icon: "images-outline"        },
];

const QUICK_ACTIONS = [
  { label: "Manage Users",   icon: "person-circle-outline", screen: "UserList"    },
  { label: "Manage Spaces",  icon: "grid-outline",          screen: "SpaceList"   },
  { label: "View Bookings",  icon: "list-outline",          screen: "BookingList" },
  { label: "Payments",       icon: "card-outline",          screen: "PaymentList" },
];

export default function AdminDashboard({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const [summary, setSummary]             = useState<DashboardSummary>({});
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [summaryData, bookingsData, contactsData] = await Promise.all([
        getDashboardSummary(),
        getRecentBookings(5).catch(() => [] as RecentBooking[]),
        getRecentContacts(5).catch(() => [] as RecentContact[]),
      ]);

      setSummary(summaryData);
      setRecentBookings(bookingsData);
      setRecentContacts(contactsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (val: number | undefined) =>
    val == null ? "—" : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val);

  return (
    <Screen>
      <DashboardHeader role="Admin" title="Admin Dashboard" />
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
          System overview and operational controls.
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

        {/* ── Stats grid ── */}
        <Text style={styles.sectionLabel}>Overview</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading KPIs…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {STAT_CARDS.map((card) => (
              <View key={card.label} style={styles.statCard}>
                <View style={styles.statIconWell}>
                  <Ionicons name={card.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{fmt(summary[card.key] as number | undefined)}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Quick actions ── */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              activeOpacity={0.75}
              onPress={() => {
                try { navigation?.navigate(action.screen); } catch {}
              }}
            >
              <Ionicons name={action.icon} size={26} color={colors.primary} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Bookings ── */}
        <Text style={styles.sectionLabel}>Recent Bookings</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : recentBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No recent bookings.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recentBookings.map((b, i) => (
              <View
                key={b.id ?? i}
                style={[styles.listRow, i < recentBookings.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.listRowLeft}>
                  <Text style={styles.listRowPrimary} numberOfLines={1}>
                    {b.spaceName ?? "Space"}
                  </Text>
                  <Text style={styles.listRowSecondary} numberOfLines={1}>
                    {b.userEmail ?? "—"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(b.bookingStatus) + "22" },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor(b.bookingStatus) }]}>
                    {b.bookingStatus ?? "—"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Recent Contacts ── */}
        <Text style={styles.sectionLabel}>Recent Contacts</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : recentContacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="mail-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No recent contacts.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recentContacts.map((c, i) => (
              <View
                key={c.id ?? i}
                style={[styles.listRow, i < recentContacts.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.listRowLeft}>
                  <Text style={styles.listRowPrimary} numberOfLines={1}>
                    {c.fullName ?? "—"}
                  </Text>
                  <Text style={styles.listRowSecondary} numberOfLines={1}>
                    {c.email ?? "—"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(c.status) + "22" },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor(c.status) }]}>
                    {c.status ?? "—"}
                  </Text>
                </View>
              </View>
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

    // Stats
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
      ...shadows.sm,
    },
    statIconWell: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },

    // Quick actions
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    actionCard: {
      width: "47%",
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      alignItems: "center",
      gap: 8,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },

    // List card (recent items)
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
