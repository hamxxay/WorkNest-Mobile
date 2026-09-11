import { ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { Header } from "../../../components/Header";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";

// Placeholder stat cards — replace values with real API data later
const STAT_CARDS = [
  { label: "Total Users",    value: "—", icon: "people-outline"         },
  { label: "Total Spaces",   value: "—", icon: "business-outline"       },
  { label: "Bookings",       value: "—", icon: "calendar-outline"       },
  { label: "Revenue",        value: "—", icon: "cash-outline"           },
  { label: "Locations",      value: "—", icon: "location-outline"       },
  { label: "Contacts",       value: "—", icon: "mail-outline"           },
];

// Placeholder quick-action sections — wire up navigation later
const QUICK_ACTIONS = [
  { label: "Manage Users",    icon: "person-circle-outline"  },
  { label: "Manage Spaces",   icon: "grid-outline"           },
  { label: "View Bookings",   icon: "list-outline"           },
  { label: "Payments",        icon: "card-outline"           },
];

export default function AdminDashboard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <Screen>
      <Header />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page heading ── */}
        <View style={styles.headingRow}>
          <View style={styles.iconWell}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.eyebrow}>ROLE · ADMIN</Text>
            <Text style={styles.title}>Admin Dashboard</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          System overview and operational controls.
        </Text>

        {/* ── Stats grid ── */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.grid}>
          {STAT_CARDS.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <View style={styles.statIconWell}>
                <Ionicons name={card.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick actions ── */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <View key={action.label} style={styles.actionCard}>
              <Ionicons name={action.icon} size={26} color={colors.primary} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Placeholder activity feed ── */}
        <Text style={styles.sectionLabel}>Recent Activity</Text>
        <View style={styles.placeholderCard}>
          <Ionicons name="time-outline" size={28} color={colors.mutedForeground} />
          <Text style={styles.placeholderText}>
            Recent bookings and events will appear here.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 20, paddingBottom: 32, gap: 4 },

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
      // ...shadows.sm,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },

    // Placeholder
    placeholderCard: {
      backgroundColor: colors.muted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      gap: 10,
    },
    placeholderText: {
      color: colors.mutedForeground,
      fontSize: 13,
      textAlign: "center",
    },
  });
