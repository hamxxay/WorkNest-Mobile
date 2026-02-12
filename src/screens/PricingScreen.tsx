import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";

export default function PricingScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Header />
        <View style={styles.hero}>
          <Text style={styles.title}>Pricing</Text>
          <Text style={styles.subtitle}>Simple plans for every team size.</Text>
        </View>

        {[
          { name: "Free", price: "$0", details: "for one user" },
          { name: "Pro", price: "$15", details: "per user" },
          { name: "Enterprise", price: "$29", details: "per user" },
        ].map((plan) => (
          <View key={plan.name} style={styles.card}>
            <Text style={styles.cardTitle}>{plan.name}</Text>
            <Text style={styles.cardPrice}>{plan.price}</Text>
            <Text style={styles.cardText}>{plan.details}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 6,
  },
  cardText: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontSize: 14,
  },
});

