import { memo, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { radii, shadows, useThemeColors } from "../../theme";
import { DEFAULT_AMENITIES, HOME_FILTERS, HOME_SPACING, PREMIUM_COPY } from "./constants";
import type { HomeFilter, Workspace } from "./types";

type PressHandler = (workspace: Workspace) => void;

export const HomeHeader = memo(function HomeHeader({
  userName,
  location,
  isGuest,
  onSignIn,
  onMenu,
}: {
  userName?: string;
  location: string;
  isGuest: boolean;
  onSignIn: () => void;
  onMenu: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          {isGuest ? "Welcome Guest" : `Good ${getGreeting()}, ${userName}`}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.primary} />
          <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={1}>
            {isGuest ? "Browse workspaces freely" : location}
          </Text>
        </View>
      </View>
      {isGuest ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn} style={[styles.signInButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      ) : (
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={[styles.headerIcon, { borderColor: colors.border }]} android_ripple={{ color: colors.primaryMuted }}>
            <Ionicons name="notifications-outline" size={21} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile menu" onPress={onMenu} style={[styles.avatar, { backgroundColor: colors.primary }]} android_ripple={{ color: "rgba(255,255,255,0.2)" }}>
            <Text style={styles.avatarText}>{userName?.slice(0, 1).toUpperCase() || "W"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

export const SearchSection = memo(function SearchSection({
  value,
  focused,
  onChangeText,
  onFocus,
  onBlur,
  onSubmit,
  onFilter,
}: {
  value: string;
  focused: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  onFilter: () => void;
}) {
  const colors = useThemeColors();
  const focus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(focus, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focus, focused]);
  const borderColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  return (
    <Animated.View style={[styles.searchShell, { borderColor, shadowOpacity: focus.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.16] }) }]}>
      <Ionicons name="search" size={22} color={colors.primary} />
      <TextInput
        accessibilityLabel="Search workspaces and locations"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        placeholder="Search by workspace, city, or amenity"
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="search"
        style={[styles.searchInput, { color: colors.foreground }]}
      />
      {value.length > 0 && <Pressable accessibilityLabel="Clear search" hitSlop={12} onPress={() => onChangeText("")}><Ionicons name="close-circle" size={20} color={colors.mutedForeground} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Open workspace filters" onPress={onFilter} style={[styles.filterButton, { backgroundColor: colors.primaryMuted }]} android_ripple={{ color: colors.primaryMuted }}>
        <Ionicons name="options-outline" size={20} color={colors.primary} />
      </Pressable>
    </Animated.View>
  );
});

export const FilterChips = memo(function FilterChips({ activeFilter, onSelect }: { activeFilter: HomeFilter | null; onSelect: (filter: HomeFilter) => void }) {
  const colors = useThemeColors();
  return <View style={styles.chipRow}>{HOME_FILTERS.map((filter) => {
    const selected = activeFilter === filter;
    return <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Filter by ${filter}`} onPress={() => onSelect(filter)} style={[styles.chip, { borderColor: colors.border }, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]} android_ripple={{ color: colors.primaryMuted }}><Text style={[styles.chipText, { color: selected ? "#fff" : colors.foreground }]}>{filter}</Text></Pressable>;
  })}</View>;
});

export const SectionHeader = memo(function SectionHeader({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress?: () => void }) {
  const colors = useThemeColors();
  return <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{subtitle && <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}</View>{onPress && <Pressable accessibilityRole="button" accessibilityLabel={`View all ${title}`} onPress={onPress} hitSlop={10}><Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text></Pressable>}</View>;
});

export const WorkspaceCard = memo(function WorkspaceCard({ workspace, onDetails, onBook, premium = false }: { workspace: Workspace; onDetails: PressHandler; onBook: PressHandler; premium?: boolean }) {
  const colors = useThemeColors();
  const availability = getAvailability(workspace);
  const amenities = workspace.amenities?.length ? workspace.amenities.slice(0, 4) : DEFAULT_AMENITIES;
  return <View style={[styles.workspaceCard, { backgroundColor: colors.card }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${workspace.name}`} onPress={() => onDetails(workspace)}>
      <Image source={{ uri: workspace.image }} style={styles.workspaceImage} accessibilityLabel={`${workspace.name} workspace`} />
      <View style={styles.imageOverlay} pointerEvents="none" />
      {premium && <View style={styles.premiumBadge}><Ionicons name="diamond" size={12} color="#fff" /><Text style={styles.premiumBadgeText}>PREMIUM</Text></View>}
      <View style={[styles.availabilityBadge, { backgroundColor: availability.background }]}><View style={[styles.statusDot, { backgroundColor: availability.color }]} /><Text style={[styles.availabilityText, { color: availability.color }]}>{availability.label}</Text></View>
      <View style={styles.ratingBadge}><Ionicons name="star" size={13} color="#FBBF24" /><Text style={styles.ratingText}>{getRating(workspace)}</Text></View>
    </Pressable>
    <View style={styles.cardBody}>
      <Text style={[styles.workspaceName, { color: colors.foreground }]} numberOfLines={1}>{workspace.name}</Text>
      <View style={styles.metaRow}><Ionicons name="location-outline" size={15} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{workspace.location}</Text><Text style={[styles.metaText, { color: colors.mutedForeground }]}>·</Text><Ionicons name="people-outline" size={15} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{workspace.capacity || "Flexible"}</Text></View>
      {premium && <Text style={[styles.premiumDescription, { color: colors.mutedForeground }]} numberOfLines={2}>{PREMIUM_COPY[Math.abs(String(workspace.id).length) % PREMIUM_COPY.length]}</Text>}
      {!premium && <View style={styles.amenityRow}>{amenities.map((amenity) => <View key={amenity} style={[styles.amenityPill, { backgroundColor: colors.primaryMuted }]}><Text style={[styles.amenityText, { color: colors.primary }]}>{amenity}</Text></View>)}</View>}
      <View style={styles.cardFooter}><View><Text style={[styles.fromText, { color: colors.mutedForeground }]}>{premium ? "Starting from" : "From"}</Text><Text style={[styles.price, { color: colors.foreground }]}>PKR {formatPrice(workspace.price)}<Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>/day</Text></Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Book ${workspace.name}`} onPress={() => onBook(workspace)} style={[styles.bookButton, { backgroundColor: colors.primary }]} android_ripple={{ color: "rgba(255,255,255,0.18)" }}><Text style={styles.bookButtonText}>Book Now</Text></Pressable></View>
      {!premium && <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${workspace.name}`} onPress={() => onDetails(workspace)} style={styles.detailsButton}><Text style={[styles.detailsText, { color: colors.primary }]}>View Details</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></Pressable>}
    </View>
  </View>;
});

export const SkeletonCard = memo(function SkeletonCard() { const colors = useThemeColors(); return <View style={[styles.skeleton, { backgroundColor: colors.card }]}><View style={[styles.skeletonImage, { backgroundColor: colors.primaryMuted }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.primaryMuted, width: "65%" }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.primaryMuted, width: "82%" }]} /></View>; });

export const EmptyState = memo(function EmptyState({ onClear }: { onClear: () => void }) { const colors = useThemeColors(); return <View style={[styles.empty, { backgroundColor: colors.primaryMuted }]}><Ionicons name="search-outline" size={28} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No spaces found</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try a different search or filter.</Text><Pressable onPress={onClear}><Text style={[styles.seeAll, { color: colors.primary }]}>Clear filters</Text></Pressable></View>; });

function getGreeting() { const hour = new Date().getHours(); return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"; }
function formatPrice(value: number) { return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
function getRating(workspace: Workspace) { return (4.4 + (Math.abs(Number(workspace.id) || workspace.name.length) % 6) / 10).toFixed(1); }
function getAvailability(workspace: Workspace) { if (!workspace.available) return { label: "Sold Out", color: "#DC2626", background: "#FEE2E2" }; if (typeof workspace.availableCount === "number" && workspace.availableCount <= 2) return { label: "Few Left", color: "#D97706", background: "#FEF3C7" }; return { label: "Available", color: "#059669", background: "#D1FAE5" }; }

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: HOME_SPACING.md, paddingTop: HOME_SPACING.sm, paddingBottom: HOME_SPACING.md },
  headerCopy: { flex: 1, paddingRight: HOME_SPACING.sm }, eyebrow: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 }, locationRow: { flexDirection: "row", alignItems: "center", gap: HOME_SPACING.xxs, marginTop: HOME_SPACING.xs }, locationText: { fontSize: 13, fontWeight: "600", flexShrink: 1 }, headerActions: { flexDirection: "row", alignItems: "center", gap: HOME_SPACING.sm }, headerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 }, avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarText: { color: "#fff", fontSize: 17, fontWeight: "800" }, signInButton: { minHeight: 48, paddingHorizontal: HOME_SPACING.md, borderRadius: radii.md, justifyContent: "center" }, signInText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  searchShell: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: HOME_SPACING.sm, borderRadius: radii.md, borderWidth: 1.5, paddingLeft: HOME_SPACING.md, backgroundColor: "#fff", ...shadows.md }, searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, minHeight: 48 }, filterButton: { width: 46, height: 46, marginRight: HOME_SPACING.xs, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: HOME_SPACING.xs, marginTop: HOME_SPACING.md }, chip: { minHeight: 40, paddingHorizontal: HOME_SPACING.sm, borderRadius: radii.pill, justifyContent: "center", borderWidth: 1 }, chipText: { fontSize: 13, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: HOME_SPACING.md }, sectionTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 }, sectionSubtitle: { fontSize: 13, marginTop: HOME_SPACING.xxs }, seeAll: { fontSize: 14, fontWeight: "800" },
  workspaceCard: { width: 288, borderRadius: radii.md, marginRight: HOME_SPACING.md, overflow: "hidden", ...shadows.md }, workspaceImage: { height: 166, width: "100%", backgroundColor: "#E6F4F1" }, imageOverlay: { ...StyleSheet.absoluteFill, bottom: "auto", height: 166, backgroundColor: "rgba(4, 33, 31, 0.18)" }, availabilityBadge: { position: "absolute", top: HOME_SPACING.sm, left: HOME_SPACING.sm, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill }, statusDot: { width: 7, height: 7, borderRadius: 4 }, availabilityText: { fontSize: 11, fontWeight: "800" }, ratingBadge: { position: "absolute", right: HOME_SPACING.sm, top: HOME_SPACING.sm, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "rgba(10,22,40,0.78)" }, ratingText: { color: "#fff", fontSize: 11, fontWeight: "800" }, premiumBadge: { position: "absolute", left: HOME_SPACING.sm, bottom: HOME_SPACING.sm, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#115E59" }, premiumBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }, cardBody: { padding: HOME_SPACING.md }, workspaceName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: HOME_SPACING.xs }, metaText: { fontSize: 12, fontWeight: "600", maxWidth: 80 }, amenityRow: { flexDirection: "row", flexWrap: "wrap", gap: HOME_SPACING.xs, marginTop: HOME_SPACING.sm }, amenityPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.pill }, amenityText: { fontSize: 10, fontWeight: "800" }, premiumDescription: { fontSize: 13, lineHeight: 18, marginTop: HOME_SPACING.sm, minHeight: 36 }, cardFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: HOME_SPACING.md }, fromText: { fontSize: 11, fontWeight: "600" }, price: { fontSize: 18, fontWeight: "900", marginTop: 1 }, priceUnit: { fontSize: 11, fontWeight: "600" }, bookButton: { minHeight: 44, paddingHorizontal: HOME_SPACING.sm, borderRadius: 12, justifyContent: "center", overflow: "hidden" }, bookButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" }, detailsButton: { minHeight: 40, marginTop: HOME_SPACING.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, detailsText: { fontSize: 13, fontWeight: "800" },
  skeleton: { width: 288, borderRadius: radii.md, padding: HOME_SPACING.md, marginRight: HOME_SPACING.md, ...shadows.sm }, skeletonImage: { height: 166, borderRadius: 12 }, skeletonLine: { height: 14, borderRadius: 7, marginTop: HOME_SPACING.md }, empty: { alignItems: "center", width: 288, borderRadius: radii.md, padding: HOME_SPACING.lg, marginRight: HOME_SPACING.md }, emptyTitle: { marginTop: HOME_SPACING.sm, fontSize: 16, fontWeight: "800" }, emptyText: { marginTop: HOME_SPACING.xxs, fontSize: 13, textAlign: "center", marginBottom: HOME_SPACING.sm },
});
