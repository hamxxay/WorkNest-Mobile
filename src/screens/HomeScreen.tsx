import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { SmartImage } from "../components/SmartImage";
import { colors, radii } from "../theme";
import { getGalleryImages, type GalleryImage } from "../services/galleryService";
import { getPricingPlans, type PricingPlan } from "../services/pricingService";
import { useAuth } from "../context/AuthContext";

const fallbackFeatures = [
  {
    title: "Real-Time Availability",
    text: "View live workspace availability and book instantly without conflicts.",
  },
  {
    title: "Easy Booking Process",
    text: "Simple booking flow with instant confirmations.",
  },
  {
    title: "Premium Workspaces",
    text: "Fully-equipped spaces with internet, meeting rooms, and amenities.",
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAdmin } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);

  useEffect(() => {
    getPricingPlans()
      .then((items) => setPlans(items.slice(0, 3)))
      .catch(() => {
        setPlans([]);
      });

    getGalleryImages()
      .then((items) => setGalleryImages(items.slice(0, 4)))
      .catch(() => {
        setGalleryImages([]);
      });
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Welcome to Your</Text>
          <Text style={styles.heroTitle}>
            Perfect <Text style={styles.heroTitleAccent}>Workspace.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Flexible spaces for freelancers, startups, and growing teams.
          </Text>

          <View style={styles.heroActions}>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={() => navigation.navigate("Booking")}>
              <Text style={styles.primaryButtonText}>Book Now</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate("Gallery")}>
              <Text style={styles.secondaryButtonText}>View Gallery</Text>
            </Pressable>
          </View>

          {isAdmin ? (
            <Pressable
              style={styles.adminButton}
              onPress={() => rootNavigation.navigate("AdminPanel")}
            >
              <Text style={styles.adminButtonText}>Open Admin Panel</Text>
            </Pressable>
          ) : null}

        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gallery Preview</Text>
            <Pressable onPress={() => navigation.navigate("Gallery")}>
              <Text style={styles.linkText}>View Full Gallery</Text>
            </Pressable>
          </View>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, index) => (
              <View key={img.id ?? index} style={styles.galleryCard}>
                <SmartImage uri={img.src} style={styles.galleryImage} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Plans for every work style</Text>
            <Pressable onPress={() => navigation.navigate("Pricing")}>
              <Text style={styles.linkText}>See All Plans</Text>
            </Pressable>
          </View>

          {plans.map((plan) => (
            <View key={plan.id ?? plan.name} style={[styles.planCard, plan.popular && styles.popularCard]}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>${Number(plan.price).toFixed(0)}/mo</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why WorkNest</Text>
          {fallbackFeatures.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 20 },
  hero: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  heroLabel: { color: colors.mutedForeground, fontSize: 15, fontWeight: "600" },
  heroTitle: { color: colors.foreground, fontSize: 30, fontWeight: "800", marginTop: 6, textAlign: "center" },
  heroTitleAccent: { color: colors.primary },
  heroSubtitle: {
    color: colors.mutedForeground,
    fontSize: 16,
    marginTop: 10,
    lineHeight: 24,
    textAlign: "center",
  },
  heroActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: radii.md },
  primaryButton: { backgroundColor: colors.primary },
  primaryButtonText: { color: colors.background, fontWeight: "700", fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary },
  secondaryButtonText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  adminButton: {
    marginTop: 12,
    backgroundColor: "#0f172a",
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  adminButtonText: { color: colors.background, fontWeight: "700", fontSize: 14 },
  section: { marginTop: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: colors.foreground, fontSize: 20, fontWeight: "700" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryCard: {
    width: "48%",
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    height: 100,
  },
  galleryImage: { width: "100%", height: "100%" },
  planCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  popularCard: { borderColor: colors.primary },
  planName: { color: colors.foreground, fontWeight: "700", fontSize: 16 },
  planPrice: { color: colors.primary, fontWeight: "800", fontSize: 20, marginTop: 6 },
  planDescription: { color: colors.mutedForeground, fontSize: 14, marginTop: 6 },
  feature: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
  },
  featureTitle: { color: colors.foreground, fontWeight: "600", fontSize: 16 },
  featureText: { color: colors.mutedForeground, marginTop: 4, fontSize: 14 },
});
