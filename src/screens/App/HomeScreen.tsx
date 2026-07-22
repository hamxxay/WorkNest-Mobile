import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated2, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { getWorkspaces } from "../../services/workspaceService";
import { useAuth } from "../../context/AuthContext";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../components/Header";
import { ChatBot } from "../../components/ChatBot";
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
  { icon: "laptop-outline", label: "Hot Desk", screen: "Booking" as const, color: "#0d9488" },
  { icon: "briefcase-outline", label: "Office", screen: "Booking" as const, color: "#0f766e" },
  { icon: "people-outline", label: "Meeting", screen: "Booking" as const, color: "#F59E0B" },
  { icon: "star-outline", label: "Amenities", screen: "Booking" as const, color: "#6366f1" },
];

const CATEGORIES = ["All", "Co-Working", "Private Office", "Meeting Room", "Event Space"];

const STATIC_SPACES = [
  {
    id: "ws-01",
    number: "01",
    name: "Private Office",
    description: "A dedicated office suite for focused work or small teams.",
    icon: "business-outline",
    features: ["Secure keycard access", "Premium desk & chair", "High-speed internet", "Daily cleaning"],
    popular: false,
  },
  {
    id: "ws-02",
    number: "02",
    name: "Hot Desk",
    description: "Flexible desk access for remote workers and freelancers.",
    icon: "laptop-outline",
    features: ["Flexible hours", "Community lounge", "Printer & scanner", "Locker storage"],
    popular: true,
  },
  {
    id: "ws-03",
    number: "03",
    name: "Meeting Room",
    description: "Fully equipped rooms for presentations and team sessions.",
    icon: "people-outline",
    features: ["AV & display setup", "Whiteboard & supplies", "Up to 10 people", "Catering available"],
    popular: false,
  },
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
  const { user, isLoadingUser } = useAuth();
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(startOfMonth(new Date()));

  const [searchOptions, setSearchOptions] = useState<string[]>([]);

  useEffect(() => {
    getGalleryImages()
      .then((items) => setGalleryImages(items.slice(0, 4)))
      .catch(() => setGalleryImages([]));
  }, []);

  useEffect(() => {
    if (isLoadingUser) return;
    setLoadingSpaces(true);
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items.slice(0, 6));
        const opts = Array.from(
          new Set(
            items.flatMap((w: any) => [w.name.trim(), w.location.trim(), w.type.trim()])
              .filter((v: string) => v.length > 0),
          ),
        ).sort((a: string, b: string) => a.localeCompare(b));
        setSearchOptions(opts);
      })
      .catch(() => {
        setWorkspaces([]);
        setSearchOptions([]);
      })
      .finally(() => setLoadingSpaces(false));
  }, [isLoadingUser, user]);

  const visibleSearchOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query.length === 0
      ? searchOptions
      : searchOptions.filter((o) => o.toLowerCase().includes(query));
    return filtered.slice(0, 8);
  }, [searchOptions, searchQuery]);

  const featuredWorkspaces = useMemo(() => {
    if (activeCategory === "All") return workspaces;
    return workspaces.filter((w: any) =>
      w.type?.toLowerCase().replace(/[^a-z ]/g, "").includes(activeCategory.toLowerCase().replace(/[^a-z ]/g, ""))
    );
  }, [workspaces, activeCategory]);

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
      <Header />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Greeting + search ── */}
        <View style={styles.heroBlock}>
          {/* <Text style={styles.heroGreeting}>Good {getTimeOfDay()} 👋</Text> */}
          <Text style={styles.heroHeading}>Find Your Ideal <Text style={[styles.heroHeading,{color: colors.primary}]}>Workspace</Text></Text>

          {/* Search bar */}
          <View style={styles.searchWrap}>
            <View style={[styles.searchRow, isSearchFocused && styles.searchRowFocused]}>
              <Ionicons name="search" size={18} color={colors.primary} />
              <TextInput
                value={searchQuery}
                onChangeText={(v) => setSearchQuery(sanitizeTextForState(v, { maxLength: INPUT_LIMITS.search }))}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                onSubmitEditing={() => {
                  if (searchQuery.trim()) navigation.navigate("Booking", { initialSearch: searchQuery.trim() });
                }}
                placeholder="Search spaces or locations…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={INPUT_LIMITS.search}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : (
                <Pressable style={styles.searchBtn} onPress={() => navigation.navigate("Booking")}>
                  <Ionicons name="options-outline" size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>

            {/* {isSearchFocused && visibleSearchOptions.length > 0 && (
              <View style={styles.searchSuggestions}>
                {visibleSearchOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [styles.searchSuggestionItem, pressed && styles.searchSuggestionItemPressed]}
                    onPress={() => {
                      setSearchQuery(option);
                      setIsSearchFocused(false);
                      navigation.navigate("Booking", { initialSearch: option });
                    }}
                  >
                    <Ionicons name="location-outline" size={14} color={colors.primary} />
                    <Text style={styles.searchSuggestionText}>{option}</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            )} */}
          </View>

          {/* Quick type chips */}
          {/* <View style={styles.quickChips}>
            {QUICK_ACTIONS.map((q) => (
              <Pressable
                key={q.label}
                style={[styles.quickChip, { borderColor: q.color + "55" }]}
                onPress={() => navigation.navigate("Booking", { initialRoomType: q.label as any })}
              >
                <Ionicons name={q.icon as any} size={14} color={q.color} />
                <Text style={[styles.quickChipText, { color: q.color }]}>{q.label}</Text>
              </Pressable>
            ))}
          </View> */}
        </View>

        {/* ── Featured workspaces ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Featured Spaces</Text>
            <Pressable onPress={() => navigation.navigate("Booking")}>
              <Text style={styles.linkText}>View All</Text>
            </Pressable>
          </View>
        
          {/* Category filter pills */}
          {/* <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView> */}

          {/* Workspace cards horizontal scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
            {loadingSpaces ? (
              [0, 1, 2].map((i) => <FeaturedSkeletonCard key={i} />)
            ) : featuredWorkspaces.length === 0 ? (
              <View style={styles.featuredEmpty}>
                <Text style={styles.featuredEmptyText}>No spaces in this category</Text>
              </View>
            ) : (
              featuredWorkspaces.map((ws: any, idx: number) => (
                <Pressable
                  key={`${String(ws.id)}-${idx}`}
                  style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                  onPress={() => navigation.navigate("SpaceDetail", { workspace: ws })}
                >
                  <SmartImage uri={ws.image} style={styles.featuredImage} resizeMode="cover" />
                  {/* Availability badge */}
                  <View style={[styles.availBadge, ws.available ? styles.availBadgeGreen : styles.availBadgeRed]}>
                    <View style={[styles.availDot, { backgroundColor: ws.available ? "#10b981" : "#ef4444" }]} />
                    <Text style={[styles.availText, { color: ws.available ? "#10b981" : "#ef4444" }]}>
                      {ws.available ? "Available" : "Occupied"}
                    </Text>
                  </View>
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredName} numberOfLines={1}>{ws.name}</Text>
                    <View style={styles.featuredMeta}>
                      <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                      <Text style={styles.featuredMetaText} numberOfLines={1}>{ws.location}</Text>
                    </View>
                    <View style={styles.featuredFooter}>
                      <View style={styles.featuredCapacity}>
                        <Ionicons name="people-outline" size={12} color={colors.primary} />
                        <Text style={styles.featuredCapacityText}>{ws.availableCount}/{ws.totalCount} available</Text>
                      </View>
                      <Text style={styles.featuredPrice}>PKR {ws.price}/day</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── Gallery ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gallery Preview</Text>
            <Pressable onPress={() => navigation.navigate("Gallery")}>
              <Text style={styles.linkText}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, index) => (
              <Pressable
                key={`gallery-${String(img.id ?? "missing")}-${index}`}
                style={({ pressed }) => [styles.galleryCard, pressed && styles.galleryCardPressed]}
                onPress={() => setLightboxIndex(index)}
              >
                <SmartImage uri={img.src} style={styles.galleryImage} />
                <View style={styles.galleryCardOverlay} pointerEvents="none" />
                <View style={styles.galleryZoomIcon} pointerEvents="none">
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.8)" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Our Spaces ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Our premium spaces</Text>
            <Pressable onPress={() => navigation.navigate("Pricing")}>
              <Text style={styles.linkText}>See All</Text>
            </Pressable>
          </View>

          {STATIC_SPACES.map((space) => (
            <View
              key={space.id}
              style={[styles.spaceCard, space.popular && styles.spaceCardPopular]}
            >
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

              <View style={styles.spaceTitleRow}>
                <View style={[styles.spaceIconWell, space.popular && styles.spaceIconWellPopular]}>
                  <Ionicons
                    name={space.icon as any}
                    size={22}
                    color={space.popular ? "#fff" : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.spaceName}>{space.name}</Text>
                  <Text style={styles.spaceDesc}>{space.description}</Text>
                </View>
              </View>

              <View style={styles.spaceDivider} />

              <View style={styles.featuresList}>
                {space.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.spaceBtn,
                  space.popular && styles.spaceBtnPopular,
                  pressed && styles.spaceBtnPressed,
                ]}
                onPress={() => navigation.navigate("Booking", { initialSearch: space.name })}
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

          <Pressable
            style={styles.tourBtn}
            onPress={() => navigation.navigate("ContactUs", { source: "tour" })}
          >
            <Ionicons name="navigate-outline" size={16} color="#fff" />
            <Text style={styles.tourBtnText}>Book a Tour</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ChatBot />

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
                    style={[styles.dayCell, !day.isCurrentMonth && styles.dayCellMuted, isSelected && styles.dayCellSelected]}
                    onPress={() => { if (!isPast) setSelectedDate(day.date); }}
                    disabled={isPast}
                  >
                    <Text style={[styles.dayText, (!day.isCurrentMonth || isPast) && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>
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

      {/* ── Full-screen lightbox ── */}
      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setLightboxIndex(null)}
      >
        <StatusBar hidden />
        {lightboxIndex !== null && (
          <HomeLightbox
            images={galleryImages}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </Modal>
    </Screen>
  );
}

// ── Inline lightbox (same as GalleryScreen) ──
const LB_SPRING = { damping: 22, stiffness: 280, mass: 0.8 };

function HomeLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const [index, setIndex] = useState(startIndex);
  const image = images[index];

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.82);
  const cardOpacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const navOpacity = useSharedValue(1);

  function resetZoom() {
    "worklet";
    scale.value = withSpring(1, LB_SPRING);
    translateX.value = withSpring(0, LB_SPRING);
    translateY.value = withSpring(0, LB_SPRING);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  }

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 260 });
    cardScale.value = withSpring(1, LB_SPRING);
    cardOpacity.value = withTiming(1, { duration: 220 });
  }, []);

  useEffect(() => { resetZoom(); }, [index]);

  function navigateTo(next: number) {
    swipeX.value = withTiming(0, { duration: 0 });
    setIndex(next);
  }

  function handleClose() {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    cardScale.value = withTiming(0.84, { duration: 200 });
    cardOpacity.value = withTiming(0, { duration: 200 }, () => runOnJS(onClose)());
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        const maxX = ((scale.value - 1) * SW) / 2;
        const maxY = ((scale.value - 1) * SH) / 2;
        translateX.value = Math.min(Math.max(savedX.value + e.translationX, -maxX), maxX);
        translateY.value = Math.min(Math.max(savedY.value + e.translationY, -maxY), maxY);
      } else {
        swipeX.value = e.translationX;
        navOpacity.value = interpolate(Math.abs(e.translationX), [0, SW * 0.3], [1, 0.3], Extrapolation.CLAMP);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1.05) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      } else {
        const threshold = SW * 0.28;
        if (e.translationX < -threshold && index < images.length - 1) {
          swipeX.value = withTiming(-SW, { duration: 220 }, () => runOnJS(navigateTo)(index + 1));
        } else if (e.translationX > threshold && index > 0) {
          swipeX.value = withTiming(SW, { duration: 220 }, () => runOnJS(navigateTo)(index - 1));
        } else {
          swipeX.value = withSpring(0, LB_SPRING);
        }
        navOpacity.value = withTiming(1, { duration: 180 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) { resetZoom(); }
      else { scale.value = withSpring(2.4, LB_SPRING); savedScale.value = 2.4; }
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }], opacity: cardOpacity.value }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + swipeX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const navStyle = useAnimatedStyle(() => ({ opacity: navOpacity.value }));

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Animated2.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,14,12,0.96)" }, backdropStyle]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      <Animated2.View style={[lbStyles.card, cardStyle]}>
        <GestureDetector gesture={composed}>
          <Animated2.View style={lbStyles.imageWrap}>
            <Animated2.Image
              source={{ uri: image.src }}
              style={[lbStyles.image, imageStyle]}
              resizeMode="contain"
            />
          </Animated2.View>
        </GestureDetector>
      </Animated2.View>

      {/* Top bar */}
      <Animated2.View style={[lbStyles.topBar, navStyle]} pointerEvents="box-none">
        <Pressable style={lbStyles.closeBtn} onPress={handleClose} hitSlop={10}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <View style={lbStyles.counter}>
          <Text style={lbStyles.counterText}>{index + 1} / {images.length}</Text>
        </View>
        <View style={lbStyles.zoomHint}>
          <Ionicons name="expand-outline" size={13} color="rgba(255,255,255,0.55)" />
          <Text style={lbStyles.zoomHintText}>Pinch or double-tap to zoom</Text>
        </View>
      </Animated2.View>

      {/* Prev / Next */}
      <Animated2.View style={[lbStyles.navRow, navStyle]} pointerEvents="box-none">
        {index > 0 ? (
          <Pressable style={lbStyles.navBtn} onPress={() => navigateTo(index - 1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : <View style={lbStyles.navBtn} />}
        {index < images.length - 1 ? (
          <Pressable style={lbStyles.navBtn} onPress={() => navigateTo(index + 1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        ) : <View style={lbStyles.navBtn} />}
      </Animated2.View>

      {/* Caption */}
      <Animated2.View style={[lbStyles.caption, navStyle]} pointerEvents="none">
        <Text style={lbStyles.captionTitle} numberOfLines={1}>{image.title}</Text>
        {!!image.category && <Text style={lbStyles.captionSub}>{image.category}</Text>}
      </Animated2.View>

      {/* Dots */}
      {images.length > 1 && (
        <Animated2.View style={[lbStyles.dots, navStyle]} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[lbStyles.dot, i === index && lbStyles.dotActive]} />
          ))}
        </Animated2.View>
      )}
    </GestureHandlerRootView>
  );
}

const SW = Dimensions.get("window").width;
const SH = Dimensions.get("window").height;

const lbStyles = StyleSheet.create({
  card: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  imageWrap: { width: SW, height: SH, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  image: { width: SW, height: SH * 0.72 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: 18, paddingBottom: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(4,14,12,0.55)",
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  counter: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  counterText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  zoomHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  zoomHintText: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  navRow: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    pointerEvents: "box-none",
  },
  navBtn: {
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: "rgba(13,148,136,0.3)",
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 12,
  },
  caption: { position: "absolute", bottom: 72, left: 0, right: 0, paddingHorizontal: 24, gap: 3 },
  captionTitle: { color: "#fff", fontSize: 17, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  captionSub: { color: "#5eead4", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  dots: { position: "absolute", bottom: 38, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.3)" },
  dotActive: { width: 20, backgroundColor: "#0d9488" },
});

function FeaturedSkeletonCard() {
  const colors = useThemeColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <Animated.View
      style={[
        {
          width: SCREEN_WIDTH * 0.62,
          borderRadius: 22,
          backgroundColor: colors.card,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.primary,
          shadowOpacity: 0.07,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        },
        { opacity },
      ]}
    >
      {/* image placeholder */}
      <View style={{ width: "100%", height: 150, backgroundColor: colors.primaryMuted }} />
      <View style={{ padding: 14, gap: 10 }}>
        {/* name */}
        <View style={{ height: 14, width: "70%", borderRadius: 7, backgroundColor: colors.primaryMuted }} />
        {/* location */}
        <View style={{ height: 11, width: "50%", borderRadius: 6, backgroundColor: colors.muted }} />
        {/* footer row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ height: 11, width: "40%", borderRadius: 6, backgroundColor: colors.muted }} />
          <View style={{ height: 11, width: "28%", borderRadius: 6, backgroundColor: colors.primaryMuted }} />
        </View>
      </View>
    </Animated.View>
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
          backgroundColor: colors.primary,
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
            { backgroundColor: "rgba(0,0,0,0.32)" },
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
              backgroundColor: "rgba(0,0,0,0.65)",
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
              backgroundColor: "rgba(255,255,255,0.2)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.5)",
              borderRadius: 999,
              alignSelf: "flex-start",
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#5eead4" }} />
            <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "800", letterSpacing: 1.4 }}>
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
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 10,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>{s.n}</Text>
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

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { paddingBottom: 56 },

  // ── Hero block ──
  heroBlock: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 4,
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  heroHeading: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 14,
    textAlign: "center",
  },

  // ── Search ──
  searchWrap: { gap: 0 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchRowFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchSuggestions: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    elevation: 2,
  },
  searchSuggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchSuggestionItemPressed: { backgroundColor: colors.primaryMuted },
  searchSuggestionText: { flex: 1, color: colors.foreground, fontSize: 13 },

  // ── Quick type chips ──
  quickChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  // ── Quick actions ──
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginHorizontal: 18,
  },
  quickAction: {
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  quickActionPressed: { opacity: 0.7 },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quickActionLabel: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  // ── Featured cards ──
  categoryScroll: { marginBottom: 14 },
  categoryContent: { gap: 8, paddingRight: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
  },
  categoryChipTextActive: { color: colors.white },
  featuredScroll: { gap: 14, paddingRight: 4, paddingBottom: 6 },
  featuredCard: {
    width: SCREEN_WIDTH * 0.62,
    borderRadius: 22,
    backgroundColor: colors.card,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuredImage: {
    width: "100%",
    height: 150,
    backgroundColor: colors.muted,
  },
  availBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  availBadgeGreen: { backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  availBadgeRed: { backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontWeight: "700" },
  featuredBody: { padding: 14, gap: 6 },
  featuredName: { color: colors.foreground, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  featuredMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredMetaText: { color: colors.mutedForeground, fontSize: 12, flex: 1 },
  featuredFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  featuredCapacity: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredCapacityText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  featuredPrice: { color: colors.foreground, fontSize: 13, fontWeight: "800" },
  featuredEmpty: { paddingVertical: 32, paddingHorizontal: 24, alignItems: "center" },
  featuredEmptyText: { color: colors.mutedForeground, fontSize: 14 },
  // ── Space cards ──
  spaceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 14,
    gap: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  spaceCardPopular: { borderColor: colors.primary, borderWidth: 2 },
  spaceCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  spaceNumber: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  popularPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularPillDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.7)" },
  popularPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  spaceTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  spaceIconWell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  spaceIconWellPopular: { backgroundColor: colors.primary, borderColor: colors.primary },
  spaceName: { fontSize: 16, fontWeight: "800", color: colors.foreground, letterSpacing: -0.2 },
  spaceDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 3, lineHeight: 18 },
  spaceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  spaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 11,
    backgroundColor: colors.primaryMuted,
  },
  spaceBtnPopular: { backgroundColor: colors.primary, borderColor: colors.primary },
  spaceBtnPressed: { opacity: 0.78 },
  spaceBtnText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  spaceBtnTextPopular: { color: "#fff" },
  tourBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: colors.secondary,
  },
  tourBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
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
  galleryCardPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  galleryImage: { width: "100%", height: "100%" },
  galleryCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,24,20,0.25)",
  },
  galleryZoomIcon: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
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
