import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { useEffect, useMemo, useState } from "react";
import { getPricingPlans, PricingPlan } from "../../services/pricingService";

const fallbackPlans: PricingPlan[] = [];

export default function PricingScreen() {
  const [plans, setPlans] = useState<PricingPlan[]>(fallbackPlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPricingPlans()
      .then((items) => {
        if (items.length > 0) {
          setPlans(items);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.price) - Number(b.price)),
    [plans]
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.hero}>
          <Text style={styles.title}>Simple, Transparent Pricing</Text>
          <Text style={styles.subtitle}>
            Choose the plan that fits your team and scale anytime.
          </Text>
        </View>

        {loading ? <Text style={styles.helper}>Loading plans...</Text> : null}

        {sortedPlans.map((plan) => (
          <View key={plan.id ?? plan.name} style={[styles.card, plan.popular && styles.popularCard]}>
            {plan.popular ? <Text style={styles.popularBadge}>Most Popular</Text> : null}
            <Text style={styles.cardTitle}>{plan.name}</Text>
            <Text style={styles.cardPrice}>${Number(plan.price).toFixed(0)}/mo</Text>
            <Text style={styles.cardDescription}>{plan.description}</Text>

            {plan.features.map((feature) => (
              <Text key={feature} style={styles.featureText}>* {feature}</Text>
            ))}

            <Pressable style={[styles.ctaButton, plan.popular && styles.ctaButtonPopular]}>
              <Text style={styles.ctaText}>{plan.cta ?? "Get Started"}</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.faqTitle}>FAQs</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 24 },
  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.mutedForeground },
  helper: { color: colors.mutedForeground, marginBottom: 10 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  popularCard: { borderColor: colors.primary },
  popularBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  cardPrice: { fontSize: 24, fontWeight: "800", color: colors.primary },
  cardDescription: { color: colors.mutedForeground, fontSize: 14 },
  featureText: { color: colors.foreground, fontSize: 14 },
  ctaButton: {
    marginTop: 8,
    borderRadius: radii.md,
    backgroundColor: colors.foreground,
    paddingVertical: 11,
    alignItems: "center",
  },
  ctaButtonPopular: { backgroundColor: colors.primary },
  ctaText: { color: colors.background, fontWeight: "700", fontSize: 14 },
  faqTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
});
