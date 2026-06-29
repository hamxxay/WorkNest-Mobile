import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";
import { cancelBooking, getMyBookings } from "../../services/workspaceService";

type BookingItem = {
  id: number | string;
  idGuid?: string;
  spaceName?: string;
  startDateTime?: string;
  endDateTime?: string;
  totalAmount?: number | null;
  bookingStatus?: string | null;
};

function getStatusConfig(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("confirm") || s.includes("active") || s.includes("approved"))
    return { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", icon: "checkmark-circle" as const, label: "Confirmed" };
  if (s.includes("cancel"))
    return { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.22)", icon: "close-circle" as const, label: "Cancelled" };
  if (s.includes("complet"))
    return { color: "#6366f1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.22)", icon: "checkmark-done-circle" as const, label: "Completed" };
  if (s.includes("pending"))
    return { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", icon: "time" as const, label: "Pending" };
  return { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", icon: "ellipse-outline" as const, label: status ?? "Unknown" };
}

function isUpcoming(item: BookingItem) {
  if (!item.startDateTime) return false;
  return new Date(item.startDateTime) > new Date();
}

export default function MyBookingsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  const loadBookings = async () => {
    setLoading(true);
    try {
      const items = await getMyBookings();
      setBookings(items as BookingItem[]);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBookings(); }, []);

  const handleCancel = (booking: BookingItem) => {
    const cancelId = booking.idGuid || booking.id;
    Alert.alert("Cancel booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          setCancellingId(String(cancelId));
          try {
            await cancelBooking(cancelId);
            await loadBookings();
          } catch {
            Alert.alert("Error", "Failed to cancel booking.");
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const upcoming = bookings.filter(isUpcoming);
  const history = bookings.filter((b) => !isUpcoming(b));
  const displayed = activeTab === "upcoming" ? upcoming : history;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        {/* Stats strip */}
        <View style={styles.statsRow}>
          {[
            { label: "Total", value: bookings.length, icon: "calendar-outline" as const, color: colors.primary },
            { label: "Upcoming", value: upcoming.length, icon: "time-outline" as const, color: "#F59E0B" },
            { label: "History", value: history.length, icon: "checkmark-done-outline" as const, color: "#6366f1" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + "18" }]}>
                <Ionicons name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {(["upcoming", "history"] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === "upcoming" ? "Upcoming" : "History"}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="hourglass-outline" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Loading bookings…</Text>
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={44} color={colors.border} />
            <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
            <Text style={styles.emptyText}>
              {activeTab === "upcoming" ? "You have no upcoming reservations." : "No past bookings found."}
            </Text>
          </View>
        ) : (
          displayed.map((booking) => {
            const status = getStatusConfig(booking.bookingStatus);
            const isCancelling = cancellingId === String(booking.idGuid || booking.id);
            const canCancel = !["cancel", "complet"].some((s) =>
              (booking.bookingStatus ?? "").toLowerCase().includes(s)
            );
            return (
              <View key={String(booking.id)} style={styles.card}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconWell}>
                    <Ionicons name="business-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {booking.spaceName ?? `Booking #${booking.id}`}
                    </Text>
                    <Text style={styles.cardSubtitle}>Booking #{booking.id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
                    <Ionicons name={status.icon} size={12} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                {/* Datetime row */}
                <View style={styles.dateRow}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>CHECK IN</Text>
                    <Text style={styles.dateValue}>{formatDate(booking.startDateTime)}</Text>
                  </View>
                  <View style={styles.dateDivider}>
                    <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
                  </View>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>CHECK OUT</Text>
                    <Text style={styles.dateValue}>{formatDate(booking.endDateTime)}</Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.amountRow}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                    <Text style={styles.amount}>PKR {Number(booking.totalAmount ?? 0).toFixed(2)}</Text>
                  </View>
                  {canCancel && activeTab === "upcoming" && (
                    <Pressable
                      style={[styles.cancelBtn, isCancelling && { opacity: 0.6 }]}
                      onPress={() => handleCancel(booking)}
                      disabled={isCancelling}
                    >
                      <Ionicons name="close-outline" size={14} color="#ef4444" />
                      <Text style={styles.cancelText}>{isCancelling ? "Cancelling…" : "Cancel"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.md,
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground },
  tabBtnTextActive: { color: colors.foreground },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  emptyText: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: "hidden",
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingBottom: 12,
  },
  cardIconWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  cardSubtitle: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBlock: { flex: 1, gap: 3 },
  dateLabel: { fontSize: 9, fontWeight: "800", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 },
  dateValue: { fontSize: 13, fontWeight: "700", color: colors.foreground },
  dateDivider: { paddingHorizontal: 10 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  amount: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#ef444440",
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cancelText: { color: "#ef4444", fontWeight: "700", fontSize: 12 },
});
