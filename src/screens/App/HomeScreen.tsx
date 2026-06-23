import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HERO_SLIDES = [
  {
    uri: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1400&auto=format&fit=crop",
    tag: "MODERN OFFICE",
    headline: "Where Great\nWork Begins",
    sub: "Private desks & shared spaces",
    accent: "#0d9488",
    tableUri: "https://images.unsplash.com/photo-1554295405-abb8fd54f153?w=800&auto=format&fit=crop",
  },
  {
    uri: "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=1400&auto=format&fit=crop",
    tag: "MEETING ROOMS",
    headline: "Built for Bold\nDecisions",
    sub: "Fully equipped boardrooms",
    accent: "#0f766e",
    tableUri: "https://images.unsplash.com/photo-1600508774634-4e11d34730e2?w=800&auto=format&fit=crop",
  },
  {
    uri: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1400&auto=format&fit=crop",
    tag: "CREATIVE COWORK",
    headline: "Inspire Your\nBest Work",
    sub: "Open coworking & lounges",
    accent: "#115e59",
    tableUri: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&auto=format&fit=crop",
  },
];

const QUICK_ACTIONS = [
  { icon: "calendar-outline", label: "Book Now", screen: "Booking" as const },
  { icon: "pricetag-outline", label: "Pricing", screen: "Pricing" as const },
  { icon: "images-outline", label: "Gallery", screen: "Gallery" as const },
  { icon: "mail-outline", label: "Contact", screen: "ContactUs" as const },
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

        {/* ── Search bar ── */}
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.primary} />
            <TextInput
              value={searchQuery}
              onChangeText={(value) =>
                setSearchQuery(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.search }))
              }
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
              onSubmitEditing={() => {
                if (searchQuery.trim().length > 0) {
                  navigation.navigate("Booking", { initialSearch: searchQuery.trim() });
                }
              }}
              placeholder="Search spaces, locations…"
              placeholderTextColor={colors.mutedForeground}
              maxLength={INPUT_LIMITS.search}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Suggestions dropdown */}
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
                    navigation.navigate("Booking", { initialSearch: option });
                  }}
                >
                  <Ionicons name="location-outline" size={15} color={colors.primary} />
                  <Text style={styles.searchSuggestionText}>{option}</Text>
                  <Ionicons name="arrow-forward-outline" size={13} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Search button — only shown when there is a query */}
          {searchQuery.trim().length > 0 && !isSearchFocused && (
            <Pressable
              style={styles.searchSubmitBtn}
              onPress={() =>
                navigation.navigate("Booking", { initialSearch: searchQuery.trim() })
              }
            >
              <Ionicons name="search" size={15} color="#fff" />
              <Text style={styles.searchSubmitText}>Search "{searchQuery.trim()}"</Text>
            </Pressable>
          )}
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
              onPress={() => {
                if (action.screen === "ContactUs") {
                  navigation.navigate("ContactUs", { source: "home" });
                } else {
                  navigation.navigate(action.screen as any);
                }
              }}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon as any} size={22} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
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
              {plan.popular ? <Text style={styles.popularBadge}>Most Popular</Text> : null}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>PKR {Number(plan.price).toFixed(0)}/mo</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
              
              <View style={styles.featuresList}>
                {plan.features.slice(0, 3).map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
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
            <Ionicons name="close" color={colors.white} size={22} />
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
  const colors = useThemeColors();
  const [activeIndex, setActiveIndex] = useState(0);

  // Background crossfade
  const bgOpacity = useRef(new Animated.Value(1)).current;
  // Foreground card float animation (looping)
  const floatAnim = useRef(new Animated.Value(0)).current;
  // Tag + headline slide-up on change
  const textY = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  // Table card scale pulse
  const tableScale = useRef(new Animated.Value(1)).current;

  const slide = HERO_SLIDES[activeIndex];
  const nextIndex = (activeIndex + 1) % HERO_SLIDES.length;

  // Looping float
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [floatAnim]);

  // Auto-advance
  useEffect(() => {
    const id = setInterval(() => advanceTo((activeIndex + 1) % HERO_SLIDES.length), 4200);
    return () => clearInterval(id);
  }, [activeIndex]);

  function advanceTo(idx: number) {
    // 1. fade text out + slide up
    Animated.parallel([
      Animated.timing(textOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(textY, { toValue: -14, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      // 2. crossfade bg
      Animated.sequence([
        Animated.timing(bgOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      // 3. table pop
      Animated.sequence([
        Animated.timing(tableScale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
        Animated.spring(tableScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
      // 4. swap slide + fade text in
      setActiveIndex(idx);
      textY.setValue(14);
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]).start();
    });
  }

  const HERO_H = 310;
  const TABLE_W = SCREEN_WIDTH * 0.52;
  const TABLE_H = TABLE_W * 0.72;

  return (
    <View style={{ marginTop: 10, marginHorizontal: 18 }}>
      {/* ── Main card ── */}
      <View
        style={{
          height: HERO_H,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "#0a2420",
          shadowColor: slide.accent,
          shadowOpacity: 0.38,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 16 },
          elevation: 18,
        }}
      >
        {/* BG image crossfade — next layer always underneath */}
        <SmartImage
          uri={HERO_SLIDES[nextIndex].uri}
          style={StyleSheet.absoluteFillObject as any}
          resizeMode="cover"
        />
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
          <SmartImage
            uri={slide.uri}
            style={StyleSheet.absoluteFillObject as any}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Deep scrim — left side lighter to let text breathe */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: "transparent",
              // multi-stop feel via nested views
            },
          ]}
          pointerEvents="none"
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(4,24,20,0.62)" },
          ]}
          pointerEvents="none"
        />

        {/* ── Floating table card (right side) ── */}
        <Animated.View
          style={{
            position: "absolute",
            right: 14,
            bottom: 18,
            width: TABLE_W,
            height: TABLE_H,
            borderRadius: 20,
            overflow: "hidden",
            transform: [{ translateY: floatAnim }, { scale: tableScale }],
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 20,
            shadowOffset: { width: -4, height: 10 },
            elevation: 16,
          }}
        >
          <SmartImage uri={slide.tableUri} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          {/* soft inner glow border */}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: "rgba(94,234,212,0.25)",
              },
            ]}
            pointerEvents="none"
          />
          {/* bottom label chip */}
          <View
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              backgroundColor: "rgba(10,36,32,0.82)",
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 5,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "#5eead4",
              }}
            />
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 }}>
              {slide.tag}
            </Text>
          </View>
        </Animated.View>

        {/* ── Text content (left side) ── */}
        <Animated.View
          style={{
            position: "absolute",
            left: 20,
            top: 0,
            bottom: 0,
            width: SCREEN_WIDTH * 0.46,
            justifyContent: "center",
            gap: 8,
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          }}
          pointerEvents="none"
        >
          {/* tag pill */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: "rgba(13,148,136,0.25)",
              borderWidth: 1,
              borderColor: "rgba(94,234,212,0.4)",
              borderRadius: 999,
              alignSelf: "flex-start",
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#5eead4" }} />
            <Text style={{ color: "#5eead4", fontSize: 9, fontWeight: "800", letterSpacing: 1.4 }}>
              WORKNEST
            </Text>
          </View>

          {/* headline */}
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 26,
              fontWeight: "800",
              lineHeight: 31,
              letterSpacing: -0.6,
              textShadowColor: "rgba(0,0,0,0.5)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 10,
            }}
          >
            {slide.headline}
          </Text>

          {/* sub */}
          <Text
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: 11,
              fontWeight: "500",
              lineHeight: 16,
            }}
          >
            {slide.sub}
          </Text>

          {/* mini stats row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            {[
              { n: "50+", l: "Spaces" },
              { n: "24/7", l: "Access" },
            ].map((s) => (
              <View
                key={s.l}
                style={{
                  backgroundColor: "rgba(13,148,136,0.22)",
                  borderRadius: 10,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(94,234,212,0.2)",
                }}
              >
                <Text style={{ color: "#5eead4", fontSize: 13, fontWeight: "800" }}>{s.n}</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "600" }}>{s.l}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Slide counter (top-right) ── */}
        <View
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            backgroundColor: "rgba(10,36,32,0.7)",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>
            {activeIndex + 1} / {HERO_SLIDES.length}
          </Text>
        </View>
      </View>

      {/* ── Animated progress dots ── */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
        {HERO_SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => advanceTo(i)}>
            <View
              style={{
                height: 4,
                width: i === activeIndex ? 28 : 8,
                borderRadius: 999,
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
              }}
            />
          </Pressable>
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
  container: { paddingBottom: 24 },

  // ── Search ──
  searchCard: {
    marginTop: 16,
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primaryMuted,
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
    backgroundColor: colors.card,
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
  searchSuggestionItemPressed: { backgroundColor: colors.primaryMuted },
  searchSuggestionText: { flex: 1, color: colors.foreground, fontSize: 14 },
  searchSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  searchSubmitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1,
  },
  // ── Quick actions ──
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginHorizontal: 18,
  },
  quickAction: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  quickActionPressed: { opacity: 0.7 },
  quickActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quickActionLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  actionButtons: {
    gap: 8,
    marginHorizontal: 18,
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
  section: { marginTop: 20, marginHorizontal: 18 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: colors.foreground, fontWeight: "800", fontSize: 19, letterSpacing: -0.3 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryCard: {
    width: "48%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.muted,
    height: 110,
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
  modalTitle: { color: colors.white, fontSize: 20, fontWeight: "700" },
  modalDesc: { color: "#cbd5e1", fontSize: 14 },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 4,
  },
  popularCard: { borderColor: colors.primary, borderWidth: 2 },
  popularBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    overflow: "hidden",
  },
  planName: { color: colors.foreground, fontWeight: "800", fontSize: 16 },
  planPrice: { color: colors.primary, fontWeight: "800", fontSize: 20, marginTop: 4 },
  planDescription: { color: colors.mutedForeground, fontSize: 13, marginTop: 4, marginBottom: 8 },
  featuresList: { gap: 6, marginVertical: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featureText: { color: colors.foreground, fontSize: 13, fontWeight: "500" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    backgroundColor: colors.card,
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
