import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/types";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { WaveDivider } from "../components/WaveBackground";
import { colors, radii } from "../theme";

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Welcome to Your</Text>

          <Text style={styles.heroTitle}>
            Perfect <Text style={styles.heroTitleAccent}>Workspace.</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            A place where productivity meets community. Flexible workspaces with
            high-speed internet, private meeting rooms, and a vibrant community.
          </Text>

          <View style={styles.heroActions}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate("Booking")}
            >
              <Text style={styles.primaryButtonText}>Book Now</Text>
            </Pressable>

            <Pressable style={[styles.button, styles.secondaryButton]}>
              <Text style={styles.secondaryButtonText}>Contact Us</Text>
            </Pressable>
          </View>
        </View>

        <WaveDivider height={140} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Spaces</Text>

          <View style={styles.cardRow}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Downtown Hub</Text>
              <Text style={styles.cardMeta}>From $25 / day</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Riverside Loft</Text>
              <Text style={styles.cardMeta}>From $32 / day</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why WorkNest</Text>

          <Feature
            title="Instant booking"
            text="Reserve a desk or room in seconds."
          />
          <Feature
            title="Verified amenities"
            text="Fast Wi-Fi, coffee, quiet zones."
          />
          <Feature title="Team friendly" text="Spaces for 1 to 20 people." />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </Screen>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 20,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  heroTitleAccent: {
    color: colors.primary,
  },
  heroSubtitle: {
    color: colors.mutedForeground,
    fontSize: 16,
    marginTop: 10,
    lineHeight: 24,
    textAlign: "center",
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },

  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 16,
  },
  cardMeta: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: 6,
  },

  feature: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
  },
  featureTitle: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  featureText: {
    color: colors.mutedForeground,
    marginTop: 4,
    fontSize: 14,
    textAlign: "center",
  },
});
