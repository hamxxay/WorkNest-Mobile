import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import {
  getDashboardSummary,
  getRecentBookings,
  getRecentContacts,
  type RecentBooking,
  type RecentContact,
} from "../../services/adminService";

export default function AdminDashboardScreen({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [stats, setStats] = useState({
    users: 0,
    spaces: 0,
    bookings: 0,
    contacts: 0,
    locations: 0,
    plans: 0,
    gallery: 0,
    memberships: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);

  const mergeNumericStats = (summary: Record<string, unknown>) => {
    setStats((prev) => ({
      users: typeof summary.users === "number" ? summary.users : prev.users,
      spaces: typeof summary.spaces === "number" ? summary.spaces : prev.spaces,
      bookings: typeof summary.bookings === "number" ? summary.bookings : prev.bookings,
      contacts: typeof summary.contacts === "number" ? summary.contacts : prev.contacts,
      locations: typeof summary.locations === "number" ? summary.locations : prev.locations,
      plans: typeof summary.plans === "number" ? summary.plans : prev.plans,
      gallery: typeof summary.gallery === "number" ? summary.gallery : prev.gallery,
      memberships:
        typeof summary.memberships === "number" ? summary.memberships : prev.memberships,
    }));
  };

  useEffect(() => {
    Promise.allSettled([
      getDashboardSummary(),
      getRecentBookings(5),
      getRecentContacts(5),
    ])
      .then(([summaryResult, bookingsResult, contactsResult]) => {
        if (summaryResult.status === "fulfilled") {
          mergeNumericStats(summaryResult.value as Record<string, unknown>);
          setStatsError("");
        } else {
          setStatsError("Unable to load dashboard stats. Check admin session/API.");
        }
        if (bookingsResult.status === "fulfilled") {
          setRecentBookings(bookingsResult.value);
        }
        if (contactsResult.status === "fulfilled") {
          setRecentContacts(contactsResult.value);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Users", value: stats.users },
    { label: "Spaces", value: stats.spaces },
    { label: "Bookings", value: stats.bookings },
    { label: "Contacts", value: stats.contacts },
    { label: "Locations", value: stats.locations },
    { label: "Pricing Plans", value: stats.plans },
    { label: "Gallery", value: stats.gallery },
    { label: "Memberships", value: stats.memberships },
  ];

  const body = (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {!embedded ? <Header /> : null}

      {!embedded ? <Text style={styles.title}>Admin Dashboard</Text> : null}
      {!embedded ? (
        <Text style={styles.subtitle}>Overview of your workspace management system.</Text>
      ) : null}

      {loading ? <Text style={styles.helper}>Loading dashboard...</Text> : null}
      {!loading && !!statsError ? <Text style={styles.errorText}>{statsError}</Text> : null}

      <View style={styles.grid}>
        {cards.map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>Recent Bookings</Text>
        {recentBookings.length === 0 ? (
          <Text style={styles.helper}>No bookings yet.</Text>
        ) : (
          recentBookings.map((booking) => (
            <View key={booking.id} style={styles.row}>
              <Text style={styles.rowText}>{booking.userEmail ?? "-"}</Text>
              <Text style={styles.rowText}>{booking.spaceName ?? "-"}</Text>
              <Text style={styles.rowStatus}>{booking.bookingStatus ?? "-"}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>Recent Contacts</Text>
        {recentContacts.length === 0 ? (
          <Text style={styles.helper}>No contacts yet.</Text>
        ) : (
          recentContacts.map((contact) => (
            <View key={contact.id} style={styles.row}>
              <Text style={styles.rowText}>{contact.fullName ?? "-"}</Text>
              <Text style={styles.rowText}>{contact.email ?? "-"}</Text>
              <Text style={styles.rowStatus}>{contact.status ?? "-"}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  if (embedded) {
    return body;
  }

  return (
    <Screen>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 28 },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: colors.mutedForeground, fontSize: 15, marginBottom: 18 },
  helper: { color: colors.mutedForeground, fontSize: 13 },
  errorText: { color: "#dc2626", fontSize: 13, marginTop: 6, marginBottom: 8, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    minWidth: 150,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  cardLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
  cardValue: { color: colors.foreground, fontSize: 23, fontWeight: "800" },
  tableCard: {
    marginTop: 14,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  tableTitle: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  rowText: { color: colors.mutedForeground, fontSize: 12 },
  rowStatus: { color: colors.primary, fontSize: 12, fontWeight: "700" },
});
