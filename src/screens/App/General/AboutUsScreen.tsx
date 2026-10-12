import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppHeader, AppText, Button, Card, Chip, ListRow, Screen, SectionHeader, Divider } from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";

const FEATURES = [
  { icon: "calendar-outline", title: "Book in the app", desc: "Find a space, pick your dates and get your challan in minutes." },
  { icon: "grid-outline", title: "Spaces for every team", desc: "Private offices, shared desks and meeting rooms." },
  { icon: "time-outline", title: "Flexible terms", desc: "Meeting rooms by the hour; private offices and shared desks by the month." },
  { icon: "shield-checkmark-outline", title: "Clear and secure", desc: "Bank challan payments and clear, signed agreements." },
];

const VALUES = ["Community first", "Sustainability", "Innovation", "Inclusivity"];

/** About WorkNest. */
export default function AboutUsScreen() {
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  return (
    <Screen>
      <AppHeader title="About WorkNest" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <Image source={require("../../../../public/Logo.png")} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
          <AppText variant="title" align="center">
            WorkNest
          </AppText>
          <AppText variant="subheading" color="primary" align="center">
            Your workspace, your way.
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            Flexible, well-run workspaces for professionals, freelancers, remote teams and businesses.
          </AppText>
        </Card>

        <SectionHeader title="Our mission" />
        <Card>
          <AppText variant="body" color="textSecondary">
            We believe the future of work is flexible. WorkNest was built to empower professionals, freelancers, remote
            teams and businesses by removing the friction of finding reliable, high-quality workspaces.
          </AppText>
        </Card>

        <SectionHeader title="What we offer" />
        <Card padding={0}>
          {FEATURES.map((f, i) => (
            <View key={f.title}>
              {i > 0 ? <Divider inset={68} /> : null}
              <ListRow leftIcon={f.icon} title={f.title} subtitle={f.desc} subtitleLines={3} />
            </View>
          ))}
        </Card>

        <SectionHeader title="Our values" />
        <View style={styles.chips}>
          {VALUES.map((v) => (
            <Chip key={v} label={v} />
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Book a tour" leftIcon="walk-outline" fullWidth onPress={() => navigation.navigate("BookTour")} />
          <Button title="Contact us" variant="outline" fullWidth onPress={() => navigation.navigate("ContactUs")} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    hero: { alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.xl },
    logo: { width: 72, height: 72 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    actions: { gap: t.spacing.md },
  });
