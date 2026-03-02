import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";
import { cancelBooking, getMyBookings } from "../services/workspaceService";

type BookingItem = {
  id: number;
  spaceName?: string;
  startDateTime?: string;
  endDateTime?: string;
  totalAmount?: number;
  bookingStatus?: string;
};

export default function MyBookingsScreen() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

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

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = (id: number) => {
    Alert.alert("Cancel booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          setCancellingId(id);
          try {
            await cancelBooking(id);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />
        <Text style={styles.title}>My Bookings</Text>

        {loading ? <Text style={styles.helper}>Loading bookings...</Text> : null}
        {!loading && bookings.length === 0 ? (
          <Text style={styles.helper}>No bookings found.</Text>
        ) : null}

        {bookings.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <Text style={styles.cardTitle}>{booking.spaceName ?? `Booking #${booking.id}`}</Text>
            <Text style={styles.meta}>Start: {formatDate(booking.startDateTime)}</Text>
            <Text style={styles.meta}>End: {formatDate(booking.endDateTime)}</Text>
            <Text style={styles.meta}>Amount: ${Number(booking.totalAmount ?? 0).toFixed(2)}</Text>
            <Text style={styles.status}>Status: {booking.bookingStatus ?? "Unknown"}</Text>
            <Pressable
              style={styles.cancelButton}
              onPress={() => handleCancel(booking.id)}
              disabled={cancellingId === booking.id}
            >
              <Text style={styles.cancelText}>
                {cancellingId === booking.id ? "Cancelling..." : "Cancel Booking"}
              </Text>
            </Pressable>
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
  helper: { color: colors.mutedForeground, marginBottom: 12 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  cardTitle: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.mutedForeground, fontSize: 13 },
  status: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 2 },
  cancelButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: radii.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },
});
