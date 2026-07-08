import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../theme";

const { width: SW } = Dimensions.get("window");

const STEPS = [
  {
    icon: "search-outline",
    title: "Find a Workspace",
    color: "#0d9488",
    summary: "Browse and filter spaces that fit your needs.",
    details: [
      "Open the Booking tab from the bottom navigation bar.",
      "Use the search bar to look up a location or workspace name.",
      "Apply filters — room type (Office, Meeting Room, Co-Working), location, or availability.",
      "Scroll through the results and tap a card to view full details.",
    ],
  },
  {
    icon: "business-outline",
    title: "Review Space Details",
    color: "#0891b2",
    summary: "Check amenities, capacity, pricing, and photos.",
    details: [
      "On the Space Detail page, review the description, amenities, and capacity.",
      "Swipe through the photo gallery to get a feel for the space.",
      "Check the price per hour / day displayed on the card.",
      "Tap Book Now when you're ready to proceed.",
    ],
  },
  {
    icon: "calendar-outline",
    title: "Choose Dates & Slot",
    color: "#7c3aed",
    summary: "Pick your booking dates and preferred time slot.",
    details: [
      "Select your booking mode: Shared, Meeting, or Private Office.",
      "Tap on the calendar to choose your date(s). Multi-day selection is supported.",
      "Pick a time slot from the available options shown below the calendar.",
      "Tap Continue to move to the guest info step.",
    ],
  },
  {
    icon: "person-outline",
    title: "Enter Guest Info",
    color: "#d97706",
    summary: "Provide your name, email, and phone number.",
    details: [
      "Fill in your full name, email address, and phone number.",
      "These details are used to confirm your booking and send receipts.",
      "Double-check your email — your booking confirmation will be sent there.",
      "Tap Proceed to Payment once all fields are filled.",
    ],
  },
  {
    icon: "card-outline",
    title: "Complete Payment",
    color: "#dc2626",
    summary: "Review your order summary and confirm payment.",
    details: [
      "Review the booking summary: space name, dates, slot, and total price.",
      "Select your preferred payment method.",
      "Tap Confirm & Pay to finalize your booking.",
      "You'll receive a confirmation screen and an email receipt.",
    ],
  },
  {
    icon: "checkmark-circle-outline",
    title: "Manage Your Bookings",
    color: "#16a34a",
    summary: "View, track, and manage all your bookings.",
    details: [
      "Go to My Bookings from the bottom tab to see all upcoming and past bookings.",
      "Tap any booking to view its full details and status.",
      "Check My Payments to review your payment history and receipts.",
      "Contact support from the Profile menu if you need help with a booking.",
    ],
  },
];

const TIPS = [
  { icon: "time-outline", text: "Book in advance for popular spaces — they fill up fast." },
  { icon: "notifications-outline", text: "Check your email after booking for your confirmation." },
  { icon: "wifi-outline", text: "All listed spaces include WiFi unless noted otherwise." },
  { icon: "headset-outline", text: "Use Contact Us in the Profile menu for any issues." },
];

export default function UserManualScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <Screen>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIconWell, { backgroundColor: colors.primary }]}>
            <Ionicons name="book-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>User Manual</Text>
          <Text style={styles.heroSub}>How to book a workspace, step by step.</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                expanded !== null && i <= expanded && { backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>

        {/* Steps */}
        <Text style={styles.blockTitle}>Booking Guide</Text>
        {STEPS.map((step, i) => {
          const open = expanded === i;
          return (
            <Pressable
              key={i}
              style={[styles.stepCard, open && styles.stepCardOpen]}
              onPress={() => setExpanded(open ? null : i)}
            >
              {/* Step header */}
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumWell, { backgroundColor: step.color + "22" }]}>
                  <Text style={[styles.stepNum, { color: step.color }]}>{i + 1}</Text>
                </View>
                <View style={[styles.stepIconWell, { backgroundColor: step.color + "18" }]}>
                  <Ionicons name={step.icon} size={20} color={step.color} />
                </View>
                <View style={styles.stepMeta}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepSummary}>{step.summary}</Text>
                </View>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </View>

              {/* Expanded details */}
              {open && (
                <View style={styles.stepBody}>
                  <View style={[styles.stepDivider, { backgroundColor: step.color + "33" }]} />
                  {step.details.map((d, di) => (
                    <View key={di} style={styles.detailRow}>
                      <View style={[styles.detailBullet, { backgroundColor: step.color }]} />
                      <Text style={styles.detailText}>{d}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Tips */}
        <Text style={styles.blockTitle}>Quick Tips</Text>
        <View style={styles.tipsCard}>
          {TIPS.map((tip, i) => (
            <View key={i} style={[styles.tipRow, i < TIPS.length - 1 && styles.tipRowBorder]}>
              <View style={styles.tipIconWell}>
                <Ionicons name={tip.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footerCard}>
          <Ionicons name="headset-outline" size={24} color="#fff" />
          <Text style={styles.footerTitle}>Need more help?</Text>
          <Text style={styles.footerText}>
            Reach out via Contact Us in your Profile menu and our team will assist you.
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
      paddingBottom: 28,
      paddingHorizontal: 24,
    },
    heroIconWell: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
      ...shadows.lg,
      shadowColor: colors.primary,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -1,
    },
    heroSub: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 6,
      textAlign: "center",
    },

    // Progress
    progressRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginBottom: 28,
    },
    progressDot: {
      width: (SW - 80) / STEPS.length,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
    },

    // Block title
    blockTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.3,
      marginHorizontal: 20,
      marginBottom: 12,
    },

    // Step cards
    stepCard: {
      marginHorizontal: 20,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.sm,
    },
    stepCardOpen: {
      borderColor: colors.primary,
    },
    stepHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 10,
    },
    stepNumWell: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNum: {
      fontSize: 13,
      fontWeight: "900",
    },
    stepIconWell: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    stepMeta: { flex: 1, gap: 2 },
    stepTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    stepSummary: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    stepBody: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },
    stepDivider: { height: 1, marginBottom: 4 },
    detailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    detailBullet: {
      width: 6,
      height: 6,
      borderRadius: 999,
      marginTop: 6,
      flexShrink: 0,
    },
    detailText: {
      flex: 1,
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 20,
    },

    // Tips
    tipsCard: {
      marginHorizontal: 20,
      marginBottom: 28,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.sm,
    },
    tipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    tipRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tipIconWell: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 19,
    },

    // Footer
    footerCard: {
      marginHorizontal: 20,
      borderRadius: radii.xl,
      backgroundColor: colors.primary,
      padding: 24,
      alignItems: "center",
      gap: 8,
      ...shadows.md,
      shadowColor: colors.primary,
    },
    footerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: "#fff",
    },
    footerText: {
      fontSize: 13,
      color: "rgba(255,255,255,0.82)",
      textAlign: "center",
      lineHeight: 20,
    },
  });
