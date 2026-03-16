import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { getPricingPlans, PricingPlan } from "../../services/pricingService";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";


export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  const goTo = (
    route: keyof MainTabParamList,
    params?: MainTabParamList[keyof MainTabParamList],
  ) => {
    navigation.navigate(route as never, params as never);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.heroCard}>
          <SmartImage
            uri="https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&auto=format&fit=crop"
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Find Your Perfect Workspace</Text>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a coworking space"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            <Pressable style={styles.dropdown}>
              <Text style={styles.dropdownText}>Location</Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            {/* <Pressable style={styles.dropdown}>
              <Text style={styles.dropdownText}>Date</Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable> */}
            <Pressable style={styles.searchButton} onPress={() => goTo("Booking")}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <Pressable style={[styles.actionButton, styles.blueButton]} onPress={() => goTo("Booking")}>
              <Text style={styles.blueButtonText}>Explore Spaces</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => goTo("Booking", { initialRoomType: "Meeting/Conference" })}
            >
              <Text style={styles.blueButtonText}>Book a Room</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.orangeButton]} onPress={() => goTo("Pricing")}>
              <Text style={styles.orangeButtonText}>View Pricing</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gallery Preview</Text>
          </View>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, index) => (
              <View key={`gallery-${String(img.id ?? "missing")}-${index}`} style={styles.galleryCard}>
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

          {plans.map((plan, index) => (
            <View key={`plan-${String(plan.id ?? "missing")}-${plan.name}-${index}`} style={[styles.planCard, plan.popular && styles.popularCard]}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>${Number(plan.price).toFixed(0)}/mo</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingBottom: 24 },
  heroCard: {
    marginTop: 12,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.background,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    minHeight: 170,
    justifyContent: "flex-end",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    padding: 16,
  },
  searchCard: {
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.muted,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  dropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  dropdownText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  actionButtons: {
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  blueButton: {
    backgroundColor: colors.primary,
  },
  orangeButton: {
    backgroundColor: colors.accent,
  },
  blueButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  orangeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  section: { marginTop: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
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
    shadowColor: "#1F2A44",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  popularCard: { borderColor: colors.primary },
  planName: { color: colors.foreground, fontWeight: "700", fontSize: 16 },
  planPrice: { color: colors.primary, fontWeight: "800", fontSize: 20, marginTop: 6 },
  planDescription: { color: colors.mutedForeground, fontSize: 14, marginTop: 6 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});





