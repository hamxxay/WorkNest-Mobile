import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../../components/Header";
import { Screen } from "../../../components/Screen";
import { useThemeColors, useThemedStyles } from "../../../theme";
import { getBookings, type BookingRecord } from "../../../services/bookingService";

export default function SaleBookingListScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getBookings();
      setBookings(Array.isArray(result) ? result : []);
    } catch (error) {
      console.warn("Failed to load bookings", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  return (
    <Screen>
      <Header />
      <View style={styles.headerWrap}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="calendar-number-outline" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.eyebrow}>BOOKINGS</Text>
            <Text style={styles.title}>Booking List</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate("BookingCreate")}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>New Booking</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No bookings found yet.</Text>
              <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.navigate("BookingCreate")}>
                <Text style={styles.emptyActionText}>Create a booking</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bookings.map((booking, index) => (
              <View key={booking.id ?? `booking-${index}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.nameText}>#{booking.id ?? `BK-${index + 1}`}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{booking.status ?? "Draft"}</Text>
                  </View>
                </View>

                {booking.customerName ? <Text style={styles.metaText}>Customer: {booking.customerName}</Text> : null}
                {booking.customerEmail ? <Text style={styles.metaText}>Email: {booking.customerEmail}</Text> : null}
                {booking.phone ? <Text style={styles.metaText}>Phone: {booking.phone}</Text> : null}
                {booking.spaceId ? <Text style={styles.metaText}>Space ID: {booking.spaceId}</Text> : null}
                {booking.startDateTime ? <Text style={styles.metaText}>Starts: {booking.startDateTime}</Text> : null}
                {booking.endDateTime ? <Text style={styles.metaText}>Ends: {booking.endDateTime}</Text> : null}
                {booking.totalAmount != null ? <Text style={styles.metaText}>Total: PKR {Number(booking.totalAmount).toLocaleString()}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    headerWrap: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
      fontWeight: "800",
    },
    title: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    newBtnText: {
      color: colors.white,
      fontWeight: "700",
      fontSize: 12,
    },
    listContainer: { paddingHorizontal: 18, paddingBottom: 28, gap: 12 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    nameText: {
      color: colors.foreground,
      fontWeight: "800",
      fontSize: 16,
      flex: 1,
    },
    badge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 10,
      textTransform: "capitalize",
    },
    metaText: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 30,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    emptyAction: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    emptyActionText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
    },
  });
