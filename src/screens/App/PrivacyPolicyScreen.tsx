import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";

const { width: SW } = Dimensions.get("window");

type Section = {
  number: string;
  title: string;
  icon: string;
  body?: string;
  bullets?: string[];
  footer?: string;
};

const SECTIONS: Section[] = [
  {
    number: "1",
    icon: "document-text-outline",
    title: "Information We Collect",
    body: "Information You Provide",
    bullets: [
      "Account details: name, email address, phone number, password, profile picture.",
      "Booking information: selected workspaces, dates, times, number of participants, special requests.",
      "Payment information (processed securely by third-party providers like Stripe — we do not store full card details).",
      "Communications: messages, support tickets, reviews, and feedback.",
      "Host information (if you list spaces): business details, space photos, descriptions, and banking info for payouts.",
    ],
    footer:
      "We also automatically collect device and usage data (IP address, device type, OS, app version), location data (with your permission), and cookies for analytics and functionality. We may also receive data from payment processors, authentication services, or workspace hosts.",
  },
  {
    number: "2",
    icon: "settings-outline",
    title: "How We Use Your Information",
    body: "We use your data to:",
    bullets: [
      "Create and manage your account.",
      "Process and confirm bookings.",
      "Provide customer support.",
      "Send important notifications (booking confirmations, reminders, updates).",
      "Improve our Service through analytics and user feedback.",
      "Personalize your experience (recommended spaces, saved preferences).",
      "Detect fraud and ensure platform security.",
      "Comply with legal obligations.",
      "(With your consent) Send marketing communications.",
    ],
  },
  {
    number: "3",
    icon: "share-social-outline",
    title: "Sharing Your Information",
    body: "We do not sell your personal data. We may share information with:",
    bullets: [
      "Workspace Hosts: Necessary booking details (name, contact, booking time) so they can prepare for your visit.",
      "Service Providers: Payment processors, cloud hosting, analytics, and customer support tools (under strict data processing agreements).",
      "Legal Reasons: When required by law, to protect rights, safety, or in response to valid legal requests.",
      "Business Transfers: In case of merger, acquisition, or sale of assets.",
    ],
  },
  {
    number: "4",
    icon: "analytics-outline",
    title: "Cookies and Tracking",
    body: "We use essential cookies for the Service to function and analytics cookies (e.g., Google Analytics) to understand usage. You can manage cookie preferences through your device or browser settings.",
  },
  {
    number: "5",
    icon: "shield-checkmark-outline",
    title: "Data Security",
    body: "We implement reasonable administrative, technical, and physical safeguards to protect your information. However, no system is completely secure — please keep your account credentials confidential.",
  },
  {
    number: "6",
    icon: "person-circle-outline",
    title: "Your Rights and Choices",
    body: "Depending on your location, you may have rights to:",
    bullets: [
      "Access, correct, or delete your personal data.",
      "Opt out of marketing communications.",
      "Withdraw consent (where applicable).",
      "Object to certain processing.",
    ],
    footer: "To exercise these rights, contact us at sales@worknestpk.com. We will respond within a reasonable time.",
  },
  {
    number: "7",
    icon: "time-outline",
    title: "Data Retention",
    body: "We keep your data as long as necessary for the purposes outlined or as required by law. You can request deletion of your account and associated data (subject to legal obligations).",
  },
  {
    number: "8",
    icon: "globe-outline",
    title: "International Transfers",
    body: "If you are outside Pakistan, your data may be transferred to and processed in other countries. We ensure appropriate safeguards are in place.",
  },
  {
    number: "9",
    icon: "happy-outline",
    title: "Children's Privacy",
    body: "Our Service is not intended for children under 18. We do not knowingly collect data from minors.",
  },
  {
    number: "10",
    icon: "refresh-outline",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email.",
  },
];

export default function PrivacyPolicyScreen() {
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
          <View style={styles.heroBlob} />
          <View style={styles.iconWell}>
            <Ionicons name="lock-closed" size={32} color={colors.white} />
          </View>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroDate}>Last Updated: July 03, 2026  ·  Effective: July 03, 2026</Text>
          <Text style={styles.heroDesc}>
            WorkNest respects your privacy and is committed to protecting your
            personal data. This policy explains how we collect, use, and
            safeguard your information when you use our Service.
          </Text>
          <View style={styles.noticePill}>
            <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
            <Text style={styles.noticeText}>
              By using WorkNest, you agree to the practices described here.
            </Text>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <View key={s.number} style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{s.number}</Text>
              </View>
              <View style={styles.sectionIconWell}>
                <Ionicons name={s.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>

            {s.body ? <Text style={styles.bodyText}>{s.body}</Text> : null}

            {s.bullets?.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}

            {s.footer ? <Text style={styles.footerText}>{s.footer}</Text> : null}
          </View>
        ))}

        {/* Contact card */}
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={24} color={colors.white} />
          <Text style={styles.contactTitle}>Contact Us</Text>
          <Text style={styles.contactLine}>sales@worknestpk.com</Text>
          <Text style={styles.contactLine}>
            3rd Floor EOBI Building-II, I-8 Markaz, Islamabad, Pakistan
          </Text>
        </View>
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
      paddingTop: 32,
      paddingBottom: 32,
      paddingHorizontal: 24,
      overflow: "hidden",
      gap: 10,
    },
    heroBlob: {
      position: "absolute",
      width: SW * 1.1,
      height: SW * 1.1,
      borderRadius: SW * 0.55,
      backgroundColor: colors.primaryMuted,
      top: -SW * 0.6,
      right: -SW * 0.2,
      opacity: 0.55,
    },
    iconWell: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
      ...shadows.md,
      shadowColor: colors.primary,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -1,
    },
    heroDate: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      letterSpacing: 0.2,
    },
    heroDesc: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 320,
    },
    noticePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    noticeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
      flexShrink: 1,
    },

    // Section card
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
      ...shadows.sm,
    },
    sectionHeadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    numberBadge: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    numberText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.white,
    },
    sectionIconWell: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.3,
      flex: 1,
    },
    bodyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      lineHeight: 22,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 8,
      flexShrink: 0,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 21,
    },
    footerText: {
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 21,
      fontStyle: "italic",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 2,
    },

    // Contact card
    contactCard: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: radii.xl,
      backgroundColor: colors.primary,
      padding: 24,
      alignItems: "center",
      gap: 8,
      ...shadows.md,
      shadowColor: colors.primary,
    },
    contactTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.white,
      letterSpacing: -0.3,
    },
    contactLine: {
      fontSize: 13,
      color: "rgba(255,255,255,0.85)",
      textAlign: "center",
      lineHeight: 20,
    },
  });
