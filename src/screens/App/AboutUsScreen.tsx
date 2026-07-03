import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";

const { width: SW } = Dimensions.get("window");

const STATS = [
  { value: "500+", label: "Spaces" },
  { value: "12K+", label: "Bookings" },
  { value: "98%", label: "Satisfaction" },
  { value: "30+", label: "Cities" },
];

const FEATURES = [
  {
    icon: "flash-outline",
    title: "Instant Booking",
    desc: "Search, filter, and confirm your workspace in seconds — no back-and-forth.",
  },
  {
    icon: "grid-outline",
    title: "Diverse Spaces",
    desc: "Hot desks, private offices, meeting rooms, and creative studios.",
  },
  {
    icon: "time-outline",
    title: "Flexible Plans",
    desc: "Book by the hour, day, week, or month — whatever fits your schedule.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Trusted & Secure",
    desc: "Verified listings, secure payments, and real reviews from real users.",
  },
];

const VALUES = [
  { icon: "people-outline", label: "Community First" },
  { icon: "leaf-outline", label: "Sustainability" },
  { icon: "bulb-outline", label: "Innovation" },
  { icon: "heart-outline", label: "Inclusivity" },
];

export default function AboutUsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <Screen>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />
          <View style={styles.logoWell}>
            <View style={styles.logoGlow} />
            <Image
              source={require("../../../public/Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroTitle}>WorkNest</Text>
          <Text style={styles.heroTagline}>Your workspace, your way.</Text>
          <Text style={styles.heroDesc}>
            A modern platform connecting professionals with flexible, inspiring
            workspaces — wherever they need to be.
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statPill}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWell}>
              <Ionicons name="rocket-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Our Mission</Text>
          </View>
          <Text style={styles.sectionText}>
            We believe the future of work is flexible. WorkNest was built to
            empower professionals, freelancers, remote teams, and businesses by
            removing the friction of finding reliable, high-quality workspaces.
          </Text>
        </View>

        {/* Features */}
        <Text style={styles.blockTitle}>What We Offer</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={styles.featureIconWell}>
                <Ionicons name={f.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Values */}
        <Text style={styles.blockTitle}>Our Values</Text>
        <View style={styles.valuesRow}>
          {VALUES.map((v) => (
            <View key={v.label} style={styles.valueChip}>
              <Ionicons name={v.icon} size={18} color={colors.primary} />
              <Text style={styles.valueLabel}>{v.label}</Text>
            </View>
          ))}
        </View>

        {/* Vision */}
        <View style={styles.visionCard}>
          <Ionicons name="eye-outline" size={28} color={colors.white} style={styles.visionIcon} />
          <Text style={styles.visionTitle}>Our Vision</Text>
          <Text style={styles.visionText}>
            To become the go-to platform for flexible workspaces worldwide —
            helping people work better, wherever they are.
          </Text>
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Thank you for choosing WorkNest 🙌{"\n"}We look forward to helping you
          find your perfect work spot.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    scroll: { paddingBottom: 48 },

    // Hero
    hero: {
      alignItems: "center",
      paddingTop: 36,
      paddingBottom: 40,
      paddingHorizontal: 24,
      overflow: "hidden",
    },
    heroBlobTop: {
      position: "absolute",
      width: SW * 1.1,
      height: SW * 1.1,
      borderRadius: SW * 0.55,
      backgroundColor: colors.primaryMuted,
      top: -SW * 0.6,
      right: -SW * 0.2,
      opacity: 0.6,
    },
    heroBlobBottom: {
      position: "absolute",
      width: SW * 0.7,
      height: SW * 0.7,
      borderRadius: SW * 0.35,
      backgroundColor: colors.accentMuted,
      bottom: -SW * 0.25,
      left: -SW * 0.15,
      opacity: 0.5,
    },
    logoWell: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      ...shadows.lg,
      shadowColor: colors.primary,
    },
    logoGlow: {
      position: "absolute",
      width: "100%",
      height: "100%",
      borderRadius: 28,
      backgroundColor: colors.secondary,
      opacity: 0.3,
    },
    logo: { width: 52, height: 52 },
    heroTitle: {
      fontSize: 36,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -1.2,
    },
    heroTagline: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
      marginTop: 4,
      letterSpacing: 0.2,
    },
    heroDesc: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
      marginTop: 12,
      maxWidth: 300,
    },

    // Stats
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginHorizontal: 20,
      marginBottom: 28,
      gap: 8,
    },
    statPill: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      alignItems: "center",
      ...shadows.sm,
    },
    statValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.primary,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginTop: 2,
    },

    // Section (mission)
    section: {
      marginHorizontal: 20,
      marginBottom: 28,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
      ...shadows.sm,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionIconWell: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    sectionText: {
      fontSize: 14,
      color: colors.mutedForeground,
      lineHeight: 22,
    },

    // Block title
    blockTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.4,
      marginHorizontal: 20,
      marginBottom: 14,
    },

    // Features grid
    featuresGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: 14,
      marginBottom: 28,
      gap: 10,
    },
    featureCard: {
      width: (SW - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
      ...shadows.sm,
    },
    featureIconWell: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground,
    },
    featureDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 18,
    },

    // Values
    valuesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: 20,
      marginBottom: 28,
      gap: 10,
    },
    valueChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    valueLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },

    // Vision card
    visionCard: {
      marginHorizontal: 20,
      marginBottom: 28,
      borderRadius: radii.xl,
      backgroundColor: colors.primary,
      padding: 24,
      alignItems: "center",
      gap: 10,
      ...shadows.md,
      shadowColor: colors.primary,
    },
    visionIcon: { opacity: 0.9 },
    visionTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.white,
      letterSpacing: -0.4,
    },
    visionText: {
      fontSize: 14,
      color: "rgba(255,255,255,0.85)",
      textAlign: "center",
      lineHeight: 22,
    },

    // Footer
    footerNote: {
      textAlign: "center",
      fontSize: 14,
      color: colors.mutedForeground,
      lineHeight: 22,
      marginHorizontal: 32,
    },
  });
