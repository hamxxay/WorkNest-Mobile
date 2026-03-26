import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { logoutUser } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import type { RootStackParamList } from "../../navigation/types";
import { getMyBookings } from "../../services/workspaceService";

type BookingItem = {
  id: number;
  startDateTime?: string;
  endDateTime?: string;
  bookingStatus?: string;
};

type BookingSummary = {
  upcoming: number;
  completed: number;
  cancelled: number;
};

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clearSession, user } = useAuth();
  const [summary, setSummary] = useState<BookingSummary>({
    upcoming: 0,
    completed: 0,
    cancelled: 0,
  });

  const handleLogout = async () => {
    await logoutUser();
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "AuthStack", params: { screen: "Login" } }] });
  };

  useEffect(() => {
    let active = true;
    getMyBookings()
      .then((items) => {
        if (!active) return;
        setSummary(buildSummary(items as BookingItem[]));
      })
      .catch(() => {
        if (!active) return;
        setSummary({ upcoming: 0, completed: 0, cancelled: 0 });
      });

    return () => {
      active = false;
    };
  }, []);

  const summaryItems = useMemo(
    () => [
      { label: "Upcoming", value: summary.upcoming },
      { label: "Completed", value: summary.completed },
      { label: "Cancelled", value: summary.cancelled },
    ],
    [summary]
  );

  const displayName = user?.name?.trim() || "WorkNest Member";
  const displaySubtitle = user?.email?.trim() || "Signed in with Firebase";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.subText}>{displaySubtitle}</Text>
          </View>
          <Pressable style={styles.editButton}>
            <Ionicons name="create-outline" size={16} color={colors.background} />
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          <View style={styles.summaryRow}>
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.membershipCard}>
          <Text style={styles.sectionTitle}>Membership</Text>
          <View style={styles.membershipRow}>
            <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.membershipTitle}>WorkNest Plus</Text>
              <Text style={styles.subText}>Renews May 2026</Text>
            </View>
          </View>
          <Pressable style={styles.membershipButton}>
            <Text style={styles.membershipButtonText}>Manage Membership</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.background} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function buildSummary(bookings: BookingItem[]): BookingSummary {
  const now = new Date();
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;

  bookings.forEach((booking) => {
    const status = (booking.bookingStatus ?? "").toLowerCase();
    if (status.includes("cancel")) {
      cancelled += 1;
      return;
    }
    if (status.includes("complete")) {
      completed += 1;
      return;
    }

    const endDate = booking.endDateTime ? new Date(booking.endDateTime) : null;
    if (endDate && endDate < now) {
      completed += 1;
      return;
    }

    upcoming += 1;
  });

  return { upcoming, completed, cancelled };
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 24,
    gap: 14,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  subText: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  membershipCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  membershipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  membershipTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  membershipButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  membershipButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 14,
  },
});
