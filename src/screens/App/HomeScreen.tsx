import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { getPricingPlans, PricingPlan } from "../../services/pricingService";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { getWorkspaces } from "../../services/workspaceService";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { INPUT_LIMITS, sanitizeTextForState } from "../../utils/inputSanitizer";

const HERO_SLIDES = [
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&auto=format&fit=crop",
];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function HomeScreen() {
  const navigation = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<MainTabParamList>,
      NativeStackNavigationProp<AppStackParamList>
    >
  >();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(startOfMonth(new Date()));

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

    getWorkspaces()
      .then((items) => {
        const nextSearchOptions = Array.from(
          new Set(
            items.flatMap((workspace) => [
              workspace.name.trim(),
              workspace.location.trim(),
              workspace.type.trim(),
            ]).filter((value) => value.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setSearchOptions(nextSearchOptions);
      })
      .catch(() => {
        setSearchOptions([]);
      });
  }, []);

  const visibleSearchOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filteredOptions =
      query.length === 0
        ? searchOptions
        : searchOptions.filter((option) => option.toLowerCase().includes(query));

    return filteredOptions.slice(0, 8);
  }, [searchOptions, searchQuery]);

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date";

  const homeCalendarDays = buildCalendarDays(datePickerMonth);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Header />

        <HeroSlideshow />

        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={(value) =>
                setSearchQuery(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.search }))
              }
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
              placeholder="Search for a coworking space"
              placeholderTextColor={colors.mutedForeground}
              maxLength={INPUT_LIMITS.search}
              style={styles.searchInput}
            />
          </View>

          {isSearchFocused && visibleSearchOptions.length > 0 ? (
            <View style={styles.searchSuggestions}>
              {visibleSearchOptions.map((option) => (
                <Pressable
                  key={option}
                  style={({ pressed }) => [
                    styles.searchSuggestionItem,
                    pressed && styles.searchSuggestionItemPressed,
                  ]}
                  onPress={() => {
                    setSearchQuery(option);
                    setIsSearchFocused(false);
                  }}
                >
                  <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                  <Text style={styles.searchSuggestionText}>{option}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* <View style={styles.filterRow}>
            <Pressable style={styles.dropdown} onPress={cycleLocation}>
              <Text
                style={[
                  styles.dropdownText,
                  selectedLocation ? styles.dropdownTextActive : undefined,
                ]}
                numberOfLines={1}
              >
                {selectedLocation || "Location"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={styles.dropdown} onPress={() => setDatePickerOpen(true)}>
              <Text
                style={[
                  styles.dropdownText,
                  selectedDate ? styles.dropdownTextActive : undefined,
                ]}
                numberOfLines={1}
              >
                {formattedDate}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              style={styles.searchButton}
              onPress={() =>
                navigation.navigate("Booking", {
                  initialLocation: selectedLocation || undefined,
                })
              }
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View> */}

        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gallery Preview</Text>
          </View>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, index) => (
              <Pressable
                key={`gallery-${String(img.id ?? "missing")}-${index}`}
                style={({ pressed }) => [styles.galleryCard, pressed && styles.galleryCardPressed]}
                onPress={() => setLightboxImage(img)}
              >
                <SmartImage uri={img.src} style={styles.galleryImage} />
              </Pressable>
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
              <Text style={styles.planPrice}>PKR {Number(plan.price).toFixed(0)}/mo</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>
          ))}
        
         <View style={styles.actionButtons}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Want to see the space in person?</Text>
          </View>
            <Pressable
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => navigation.navigate("ContactUs", { source: "tour" })}
            >
              <Text style={styles.blueButtonText}>Book a tour</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal transparent visible={datePickerOpen} animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => setDatePickerMonth((prev) => addMonths(prev, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[datePickerMonth.getMonth()]} {datePickerMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => setDatePickerMonth((prev) => addMonths(prev, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {homeCalendarDays.map((day, index) => {
                const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
                const isPast = day.date < startOfToday();

                return (
                  <Pressable
                    key={`${day.date.toISOString()}-${index}`}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.dayCellMuted,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      if (isPast) {
                        return;
                      }
                      setSelectedDate(day.date);
                    }}
                    disabled={isPast}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        (!day.isCurrentMonth || isPast) && styles.dayTextMuted,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rangeFooter}>
              <Text style={styles.rangeFooterText}>{formattedDate === "Date" ? "Select a date" : formattedDate}</Text>
              <Pressable style={styles.pickerDone} onPress={() => setDatePickerOpen(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLightboxImage(null)}>
          <Pressable style={styles.modalClose} onPress={() => setLightboxImage(null)}>
            <Ionicons name="close" color={colors.background} size={22} />
          </Pressable>
          {lightboxImage ? (
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <SmartImage uri={lightboxImage.src} style={styles.modalImage} resizeMode="cover" />
              <Text style={styles.modalTitle}>{lightboxImage.title}</Text>
              {lightboxImage.description ? (
                <Text style={styles.modalDesc}>{lightboxImage.description}</Text>
              ) : null}
            </Pressable>
          ) : null}
        </Pressable>

      </Modal>
    </Screen>
  );
}

function HeroSlideshow() {
  const heroFade = useRef(new Animated.Value(1)).current;
  const styles = useThemedStyles(createStyles);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      Animated.sequence([
        Animated.timing(heroFade, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(heroFade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      setActiveHeroIndex((currentIndex) => (currentIndex + 1) % HERO_SLIDES.length);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [heroFade]);

  return (
    <View style={styles.heroCard}>
      <Animated.View style={[styles.heroFadeLayer, { opacity: heroFade }]}>
        <SmartImage uri={HERO_SLIDES[activeHeroIndex]} style={styles.heroImage} />
      </Animated.View>
      <Text style={styles.heroTitle}>Find Your Perfect Workspace</Text>
      <View style={styles.heroDots}>
        {HERO_SLIDES.map((_, index) => (
          <View
            key={`hero-dot-${index}`}
            style={[
              styles.heroDot,
              index === activeHeroIndex ? styles.heroDotActive : undefined,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function buildCalendarDays(baseMonth: Date) {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  const startDate = new Date(year, month, 1 - startDay);
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    days.push({
      date,
      isCurrentMonth: date.getMonth() === month,
    });
  }

  return days;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
  heroFadeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImage: {
    width: "100%",
    height: 170,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    padding: 16,
    textShadowColor: "rgba(15, 23, 42, 0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroDots: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    gap: 6,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  heroDotActive: {
    width: 20,
    backgroundColor: "#FFFFFF",
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
  searchSuggestions: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  searchSuggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchSuggestionItemPressed: {
    backgroundColor: colors.muted,
  },
  searchSuggestionText: {
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
    flex: 1,
    marginRight: 8,
  },
  dropdownTextActive: {
    color: colors.foreground,
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
  blueButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  section: { marginTop: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: colors.foreground, fontWeight: "700", fontSize: 18 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryCard: {
    width: "48%",
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    height: 100,
  },
  galleryCardPressed: {
    transform: [{ scale: 1.05 }],
  },
  galleryImage: { width: "100%", height: "100%" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalClose: { position: "absolute", right: 20, top: 48, zIndex: 2 },
  modalContent: { gap: 10 },
  modalImage: { width: "100%", height: 280, borderRadius: radii.md },
  modalTitle: { color: colors.background, fontSize: 20, fontWeight: "700" },
  modalDesc: { color: "#cbd5e1", fontSize: 14 },
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pickerNav: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  pickerTitle: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    alignContent: "center",
    justifyContent: "center",
    
    borderRadius: 8,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    justifyContent: "space-around", 
    alignItems: "center",
    alignContent: "center",
  },
  dayText: {
    color: colors.foreground,
    fontWeight: "600",
    transform: [{ translateY: -10 }],
  },
  dayTextMuted: { color: colors.mutedForeground },
  dayTextSelected: { color: "#FFFFFF" },
  rangeFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeFooterText: { color: colors.mutedForeground, fontWeight: "600", fontSize: 12 },
  pickerDone: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  pickerDoneText: { color: "#FFFFFF", fontWeight: "700" },
});
