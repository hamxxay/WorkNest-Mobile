import { ScrollView, StyleSheet, View } from "react-native";
import { AppHeader, AppText, Card, Screen } from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";

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
      "Payment information: your bank challans and their payment status. Payments are made at the bank (1Bill / HBL); the app never asks for card or bank-account details.",
      "Identity and agreement details: CNIC, company details and signed lease agreements, when you book an office or verify door access.",
      "Communications: messages, tour requests, support requests and feedback.",
    ],
    footer:
      "We also automatically collect device and usage data (IP address, device type, OS, app version), location data (with your permission), and cookies for analytics and functionality. We may also receive data from our bank (payment confirmations) and authentication services (Google / Firebase sign-in).",
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
      "Our bank: challan details needed to collect and confirm your payment.",
      "Service Providers: cloud hosting, sign-in, notifications and customer support tools (under strict data processing agreements).",
      "Legal Reasons: When required by law, to protect rights, safety, or in response to valid legal requests.",
      "Business Transfers: In case of merger, acquisition, or sale of assets.",
    ],
  },
  {
    number: "4",
    icon: "analytics-outline",
    title: "Device Storage and Cookies",
    body: "The app stores your sign-in session and settings on your device. The website uses essential cookies to work. You can clear app data from your device settings.",
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
  const styles = useThemedStyles(createStyles);
  return (
    <Screen>
      <AppHeader title="Privacy policy" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <AppText variant="body">
            WorkNest respects your privacy and is committed to protecting your personal data. This policy explains how
            we collect, use, and safeguard your information when you use our Service.
          </AppText>
          <AppText variant="bodySmall" color="textMuted" style={styles.top}>
            By using WorkNest, you agree to the practices described here.
          </AppText>
        </Card>
        {SECTIONS.map((section) => (
          <Card key={section.number}>
            <AppText variant="subheading">
              {section.number}. {section.title}
            </AppText>
            {section.body ? (
              <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
                {section.body}
              </AppText>
            ) : null}
            {section.bullets?.map((b) => (
              <View key={b} style={styles.bullet}>
                <AppText variant="bodySmall" color="primary">
                  {"\u2022"}
                </AppText>
                <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
                  {b}
                </AppText>
              </View>
            ))}
            {section.footer ? (
              <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
                {section.footer}
              </AppText>
            ) : null}
          </Card>
        ))}
        <Card variant="filled">
          <AppText variant="subheading">Contact us</AppText>
          <AppText variant="bodySmall" color="textSecondary" style={styles.top}>
            sales@worknestpk.com
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            3rd Floor EOBI Building-II, I-8 Markaz, Islamabad, Pakistan
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xxl },
    top: { marginTop: t.spacing.sm },
    bullet: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.xs },
    flex: { flex: 1 },
  });
