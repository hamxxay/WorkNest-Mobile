import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppHeader, AppText, Button, Card, ListRow, Screen, SectionHeader } from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";

const STEPS = [
  {
    icon: "search-outline",
    title: "Find a space",
    summary: "Browse the spaces open for booking.",
    details: [
      "Tap Book a space on Home (or See all under the spaces list).",
      "Search by name or location and filter by type: private office, shared desk or meeting room.",
      "Tap a space to see its type, location, capacity, listed rate and amenities.",
    ],
  },
  {
    icon: "calendar-outline",
    title: "Choose when",
    summary: "Meeting rooms by the hour, offices and desks by the month.",
    details: [
      "Tap Book this space.",
      "Meeting room: pick the date, start time and number of hours.",
      "Office or shared desk: pick the start date and number of months.",
      "The app checks availability as you choose and shows the listed rate.",
    ],
  },
  {
    icon: "person-outline",
    title: "Your details",
    summary: "Name and phone for the booking and the challan.",
    details: [
      "Check your name and phone number (your account email is used).",
      "Add notes for the team if needed, then tap Review booking.",
    ],
  },
  {
    icon: "document-text-outline",
    title: "Confirm and pay the challan",
    summary: "Confirm, then pay the bank challan.",
    details: [
      "Review the summary and accept the terms, then tap Confirm booking.",
      "WorkNest assigns your space and issues a bank challan with the exact amount.",
      "Pay it at any HBL branch, ATM or in your mobile banking app under 1Bill / Bill Payment.",
      "Your booking is confirmed once the payment reaches us; the status updates in the app.",
    ],
  },
  {
    icon: "checkmark-circle-outline",
    title: "Manage your bookings",
    summary: "Bookings, Payments and Agreements tabs.",
    details: [
      "Bookings: upcoming and past bookings, their challans, and Cancel while a booking is still pending.",
      "Payments: your challans and their payment status.",
      "Agreements: read and sign lease agreements our team sends you.",
    ],
  },
];

/** How to use the WorkNest app, step by step. */
export default function UserManualScreen() {
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <AppHeader title="User manual" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Booking in five steps" />
        {STEPS.map((step, i) => {
          const expanded = open === i;
          return (
            <Card key={step.title} padding={0}>
              <ListRow
                leftIcon={step.icon}
                title={`${i + 1}. ${step.title}`}
                subtitle={step.summary}
                right={null}
                chevron
                onPress={() => setOpen(expanded ? null : i)}
                accessibilityHint={expanded ? "Hides the steps" : "Shows the steps"}
              />
              {expanded ? (
                <View style={styles.details}>
                  {step.details.map((d) => (
                    <View key={d} style={styles.bullet}>
                      <AppText variant="bodySmall" color="primary">
                        {"\u2022"}
                      </AppText>
                      <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
                        {d}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })}
        <Card variant="filled">
          <AppText variant="subheading">Need help?</AppText>
          <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
            Our team is happy to help with bookings, challans and agreements.
          </AppText>
          <Button title="Contact us" variant="outline" size="sm" style={styles.button} onPress={() => navigation.navigate("ContactUs")} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xxl },
    details: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg, gap: t.spacing.xs },
    bullet: { flexDirection: "row", gap: t.spacing.sm },
    flex: { flex: 1 },
    top: { marginTop: t.spacing.sm },
    button: { alignSelf: "flex-start", marginTop: t.spacing.md },
  });
