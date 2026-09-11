import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { Header } from "../../../components/Header";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";

// Placeholder KPI cards — replace values with real API data later
const KPI_CARDS = [
  { label: "Total Leads",     value: "—", icon: "person-add-outline"    },
  { label: "Deals Closed",    value: "—", icon: "checkmark-circle-outline" },
  { label: "Revenue",         value: "—", icon: "cash-outline"          },
  { label: "Quotations Sent", value: "—", icon: "document-text-outline" },
];

// Placeholder pipeline stages — wire up real data later
const PIPELINE_STAGES = [
  { label: "New Leads",    count: "—", color: "#0d9488" },
  { label: "In Progress",  count: "—", color: "#f59e0b" },
  { label: "Negotiation",  count: "—", color: "#6366f1" },
  { label: "Closed Won",   count: "—", color: "#059669" },
];

export default function SaleDashboard({ navigation }: { navigation: any }) {
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
            <Ionicons name="trending-up-outline" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.eyebrow}>ROLE · SALES</Text>
            <Text style={styles.title}>Sales Dashboard</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Your pipeline, quotations, and performance at a glance.
        </Text>

        {/* ── KPI cards ── */}
        <Text style={styles.sectionLabel}>Key Metrics</Text>
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

        {/* ── Pipeline ── */}
        <Text style={styles.sectionLabel}>Pipeline</Text>
        <View style={styles.pipelineRow}>
          {PIPELINE_STAGES.map((stage) => (
            <View key={stage.label} style={styles.pipelineCard}>
              <View style={[styles.pipelineDot, { backgroundColor: stage.color }]} />
              <Text style={styles.pipelineCount}>{stage.count}</Text>
              <Text style={styles.pipelineLabel}>{stage.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Customer Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate("CustomerCreate")}>
            <Ionicons name="person-add-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate("CustomerList")}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Customer List</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Quotation Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate("QuotationCreate")}>
            <Ionicons name="document-text-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Quotation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate("QuotationList")}>
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Quotation List</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Booking Management</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate("BookingCreate")}>
            <Ionicons name="calendar-outline" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Create Booking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate("BookingList")}>
            <Ionicons name="calendar-number-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Booking List</Text>
          </TouchableOpacity>
        </View>

        {/* ── Placeholder recent activity ── */}
        <Text style={styles.sectionLabel}>Recent Quotations</Text>
        <View style={styles.placeholderCard}>
          <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
          <Text style={styles.placeholderText}>
            Your recent quotations and follow-ups will appear here.
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
