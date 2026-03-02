import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";
import { getPricingPlans, type PricingPlan } from "../services/pricingService";

type Faq = { question: string; answer: string; open: boolean };

const fallbackPlans: PricingPlan[] = [
  {
    id: 1,
    name: "Standard",
    price: 29,
    description: "Flexible access for freelancers and solo founders.",
    features: ["5 hours / month", "High-speed WiFi", "Community events"],
    popular: false,
    cta: "Get Started",
  },
  {
    id: 2,
    name: "Premium",
    price: 79,
    description: "Unlimited access for remote teams and power users.",
    features: ["Unlimited access", "Meeting rooms", "24/7 entry"],
    popular: true,
    cta: "Start Free Trial",
  },
  {
    id: 3,
    name: "Executive",
    price: 199,
    description: "Private offices with premium services included.",
    features: ["Private office", "Concierge support", "Guest passes"],
    popular: false,
    cta: "Contact Sales",
  },
];

const initialFaqs: Faq[] = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes, you can upgrade or downgrade your plan anytime. Changes apply from the next billing cycle.",
    open: false,
  },
  {
    question: "Are there any long-term commitments?",
    answer:
      "No. Plans are month-to-month and can be cancelled anytime.",
    open: false,
  },
  {
    question: "Do you offer team or enterprise pricing?",
    answer:
      "Yes, custom pricing is available for teams of 5 or more.",
    open: false,
  },
];

export default function PricingScreen() {
  const [plans, setPlans] = useState<PricingPlan[]>(fallbackPlans);
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs);

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
              <Text key={feature} style={styles.featureText}>• {feature}</Text>
            ))}

            <Pressable style={[styles.ctaButton, plan.popular && styles.ctaButtonPopular]}>
              <Text style={styles.ctaText}>{plan.cta ?? "Get Started"}</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.faqTitle}>FAQs</Text>
        {faqs.map((faq, index) => (
          <View key={faq.question} style={styles.faqCard}>
            <Pressable
              onPress={() => {
                setFaqs((prev) =>
                  prev.map((entry, i) =>
                    i === index ? { ...entry, open: !entry.open } : entry
                  )
                );
              }}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
            </Pressable>
            {faq.open ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}
          </View>
        ))}
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
  faqCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  faqQuestion: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
  faqAnswer: { color: colors.mutedForeground, fontSize: 14, lineHeight: 20 },
});
