import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { useEffect, useMemo, useState } from "react";
import { getPricingPlans, type PricingPlan } from "../../services/pricingService";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";

const fallbackPlans: PricingPlan[] = [];

const STATIC_SPACES = [
  {
    id: "ws-01",
    number: "01",
    name: "Private Office",
    description: "A dedicated office suite for focused work or small teams.",
    icon: "business-outline",
    features: [
      "Secure keycard access",
      "Premium desk & chair",
      "High-speed internet",
      "Daily cleaning",
    ],
    type: "Private Office" as const,
    popular: false,
  },
  {
    id: "ws-02",
    number: "02",
    name: "Hot Desk",
    description: "Flexible desk access for remote workers and freelancers.",
    icon: "laptop-outline",
    features: [
      "Flexible hours",
      "Community lounge",
      "Printer & scanner",
      "Locker storage",
    ],
    type: "Co-Working Space" as const,
    popular: true,
  },
  {
    id: "ws-03",
    number: "03",
    name: "Meeting Room",
    description: "Fully equipped rooms for presentations and team sessions.",
    icon: "people-outline",
    features: [
      "AV & display setup",
      "Whiteboard & supplies",
      "Up to 10 people",
      "Catering available",
    ],
    type: "Meeting Room" as const,
    popular: false,
  },
];

export default function PricingScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [plans, setPlans] = useState<PricingPlan[]>(fallbackPlans);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<AppStackParamList>
  >>();

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
          <Text style={styles.title}>Simple, Transparent Booking</Text>
          <Text style={styles.subtitle}>
            Choose the space that fits your team and scale anytime.
          </Text>
        </View>

        {/* ── Workspace type cards ── */}
        <Text style={styles.sectionLabel}>Our Spaces</Text>
        {STATIC_SPACES.map((space) => (
          <View
            key={space.id}
            style={[styles.spaceCard, space.popular && styles.spaceCardPopular]}
          >
            {/* Number + popular badge row */}
            <View style={styles.spaceCardHeader}>
              <View style={styles.spaceNumberBadge}>
                <Text style={styles.spaceNumber}>{space.number}</Text>
              </View>
              {space.popular && (
                <View style={styles.popularPill}>
                  <View style={styles.popularPillDot} />
                  <Text style={styles.popularPillText}>Most Popular</Text>
                </View>
              )}
            </View>

            {/* Icon + title */}
            <View style={styles.spaceTitleRow}>
              <View style={[styles.spaceIconWell, space.popular && styles.spaceIconWellPopular]}>
                <Ionicons
                  name={space.icon as any}
                  size={24}
                  color={space.popular ? "#fff" : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.spaceName}>{space.name}</Text>
                <Text style={styles.spaceDesc}>{space.description}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.spaceDivider} />

            {/* Features */}
            <View style={styles.featuresList}>
              {space.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.spaceBtn,
                space.popular && styles.spaceBtnPopular,
                pressed && styles.spaceBtnPressed,
              ]}
              onPress={() =>
                navigation.navigate("Booking", {
                  initialSearch: space.name,
                })
              }
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={space.popular ? "#fff" : colors.primary}
              />
              <Text style={[styles.spaceBtnText, space.popular && styles.spaceBtnTextPopular]}>
                Book Now
              </Text>
            </Pressable>
          </View>
        ))}
{/* 
        {/* ── Pricing plans ── 
        <Text style={styles.sectionLabel}>Pricing Plans</Text>
        {loading ? <Text style={styles.helper}>Loading plans...</Text> : null}

        {sortedPlans.map((plan) => (
          <View key={plan.id ?? plan.name} style={[styles.card, plan.popular && styles.popularCard]}>
            {plan.popular ? <Text style={styles.popularBadge}>Most Popular</Text> : null}
            <Text style={styles.cardTitle}>{plan.name}</Text>
            <Text style={styles.cardPrice}>PKR {Number(plan.price).toFixed(0)}/mo</Text>
            <Text style={styles.cardDescription}>{plan.description}</Text>

            <View style={styles.featuresList}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <Pressable style={[styles.ctaButton, plan.popular && styles.ctaButtonPopular]}>
              <Text style={styles.ctaText}>{plan.cta ?? "Get Started"}</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.faqTitle}>FAQs</Text> */}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.lg,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: 0.2, color: colors.foreground },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.mutedForeground },
  helper: { color: colors.mutedForeground, marginBottom: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 8,
    shadowColor: "#0B1B3A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  popularCard: { borderColor: colors.primary, borderWidth: 2 },
  popularBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground },
  cardPrice: { fontSize: 28, fontWeight: "800", color: colors.primary, marginVertical: 4 },
  cardDescription: { color: colors.mutedForeground, fontSize: 14, marginBottom: 10 },
  featuresList: { gap: 8, marginVertical: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
  ctaButton: {
    marginTop: 12,
    borderRadius: radii.md,
    backgroundColor: colors.foreground,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaButtonPopular: { backgroundColor: colors.primary },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  faqTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: 14,
    marginTop: 4,
  },
  // ── Space cards ──
  spaceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  spaceCardPopular: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  spaceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spaceNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  spaceNumber: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  popularPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularPillDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  popularPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  spaceTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  spaceIconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  spaceIconWellPopular: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  spaceName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  spaceDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 3,
    lineHeight: 18,
  },
  spaceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  spaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 11,
    backgroundColor: colors.primaryMuted,
  },
  spaceBtnPopular: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  spaceBtnPressed: {
    opacity: 0.78,
  },
  spaceBtnText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  spaceBtnTextPopular: {
    color: "#fff",
  },
});
