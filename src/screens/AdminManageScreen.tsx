import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii } from "../theme";
import {
  getBookingsPage,
  getContactsPage,
  getGalleryPage,
  getLocationsPage,
  getMembershipsPage,
  getPaymentsPage,
  getPricingPlansPage,
  getSpacesPage,
  getSpaceTypesPage,
  type AdminBooking,
  type AdminContact,
  type AdminGallery,
  type AdminLocation,
  type AdminMembership,
  type AdminPayment,
  type AdminPricingPlan,
  type AdminSpace,
  type AdminSpaceType,
  type PaginatedList,
} from "../services/adminService";

const PAGE_SIZE = 20;

export type AdminEntity =
  | "locations"
  | "space-types"
  | "spaces"
  | "bookings"
  | "pricing"
  | "memberships"
  | "payments"
  | "contacts"
  | "gallery";

type Config<T> = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  load: (query: { page?: number; limit?: number; search?: string }) => Promise<PaginatedList<T>>;
  itemId: (item: T) => string;
  primary: (item: T) => string;
  lines: (item: T) => string[];
};

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function asCurrency(value?: number): string {
  if (typeof value !== "number") {
    return "-";
  }
  return `$${value.toFixed(2)}`;
}

const configs: Record<AdminEntity, Config<any>> = {
  locations: {
    title: "Admin Locations",
    subtitle: "Manage workspace addresses and operating times.",
    searchPlaceholder: "Search locations",
    load: (query) => getLocationsPage(query),
    itemId: (item: AdminLocation) => `location-${item.id}`,
    primary: (item: AdminLocation) => item.name || `Location #${item.id}`,
    lines: (item: AdminLocation) => [
      `City: ${item.city || "-"}`,
      `Address: ${item.address || "-"}`,
      `Hours: ${item.openingTime || "-"} - ${item.closingTime || "-"}`,
      `Status: ${item.isActive === false ? "Inactive" : "Active"}`,
    ],
  },
  "space-types": {
    title: "Admin Space Types",
    subtitle: "Review available space categories.",
    searchPlaceholder: "Search space types",
    load: (query) => getSpaceTypesPage(query),
    itemId: (item: AdminSpaceType) => `space-type-${item.id}`,
    primary: (item: AdminSpaceType) => item.name || `Space Type #${item.id}`,
    lines: (item: AdminSpaceType) => [
      `Capacity: ${item.capacity ?? "-"}`,
      `Hourly Allowed: ${item.hourlyAllowed ? "Yes" : "No"}`,
      `Status: ${item.isActive === false ? "Inactive" : "Active"}`,
    ],
  },
  spaces: {
    title: "Admin Spaces",
    subtitle: "Monitor workspace inventory and pricing.",
    searchPlaceholder: "Search spaces",
    load: (query) => getSpacesPage(query),
    itemId: (item: AdminSpace) => `space-${item.id}`,
    primary: (item: AdminSpace) => item.name || `Space #${item.id}`,
    lines: (item: AdminSpace) => [
      `Location: ${item.locationName || "-"}`,
      `Type: ${item.spaceTypeName || "-"}`,
      `Code: ${item.code || "-"}`,
      `Price/Day: ${asCurrency(item.pricePerDay)}`,
      `Status: ${item.status || "-"}`,
    ],
  },
  bookings: {
    title: "Admin Bookings",
    subtitle: "Track recent booking activity and status.",
    searchPlaceholder: "Search bookings",
    load: (query) => getBookingsPage(query),
    itemId: (item: AdminBooking) => `booking-${item.id}`,
    primary: (item: AdminBooking) => item.spaceName || `Booking #${item.id}`,
    lines: (item: AdminBooking) => [
      `User: ${item.userEmail || "-"}`,
      `Start: ${formatDate(item.startDateTime)}`,
      `End: ${formatDate(item.endDateTime)}`,
      `Amount: ${asCurrency(item.totalAmount)}`,
      `Status: ${item.bookingStatus || "-"}`,
    ],
  },
  pricing: {
    title: "Admin Pricing Plans",
    subtitle: "Review billing cycles and plan values.",
    searchPlaceholder: "Search pricing plans",
    load: (query) => getPricingPlansPage(query),
    itemId: (item: AdminPricingPlan) => `pricing-${item.id}`,
    primary: (item: AdminPricingPlan) => item.name || `Plan #${item.id}`,
    lines: (item: AdminPricingPlan) => [
      `Price: ${asCurrency(item.price)}`,
      `Cycle: ${item.billingCycle || "-"}`,
      `Included Hours: ${item.includesHours ?? "-"}`,
      `Status: ${item.isActive === false ? "Inactive" : "Active"}`,
    ],
  },
  memberships: {
    title: "Admin Memberships",
    subtitle: "Track user subscriptions and lifecycle state.",
    searchPlaceholder: "Search memberships",
    load: (query) => getMembershipsPage(query),
    itemId: (item: AdminMembership) => `membership-${item.id}`,
    primary: (item: AdminMembership) => item.userEmail || `Membership #${item.id}`,
    lines: (item: AdminMembership) => [
      `Plan: ${item.planName || "-"}`,
      `Start: ${formatDate(item.startDate)}`,
      `End: ${formatDate(item.endDate)}`,
      `Status: ${item.status || "-"}`,
    ],
  },
  payments: {
    title: "Admin Payments",
    subtitle: "Review transactions and settlement status.",
    searchPlaceholder: "Search payments",
    load: (query) => getPaymentsPage(query),
    itemId: (item: AdminPayment) => `payment-${item.id}`,
    primary: (item: AdminPayment) => item.userEmail || `Payment #${item.id}`,
    lines: (item: AdminPayment) => [
      `Amount: ${asCurrency(item.amount)}`,
      `Method: ${item.paymentMethod || "-"}`,
      `Status: ${item.paymentStatus || "-"}`,
      `Paid At: ${formatDate(item.paidAt)}`,
    ],
  },
  contacts: {
    title: "Admin Contacts",
    subtitle: "Handle incoming inquiries and status updates.",
    searchPlaceholder: "Search contacts",
    load: (query) => getContactsPage(query),
    itemId: (item: AdminContact) => `contact-${item.id}`,
    primary: (item: AdminContact) => item.fullName || `Contact #${item.id}`,
    lines: (item: AdminContact) => [
      `Email: ${item.email || "-"}`,
      `Phone: ${item.phone || "-"}`,
      `Status: ${item.status || "-"}`,
      `Date: ${formatDate(item.createdAt)}`,
      `Message: ${item.message || "-"}`,
    ],
  },
  gallery: {
    title: "Admin Gallery",
    subtitle: "Review uploaded image metadata and order.",
    searchPlaceholder: "Search gallery images",
    load: (query) => getGalleryPage(query),
    itemId: (item: AdminGallery) => `gallery-${item.id}`,
    primary: (item: AdminGallery) => item.title || `Image #${item.id}`,
    lines: (item: AdminGallery) => [
      `Sort Order: ${item.sortOrder ?? "-"}`,
      `Status: ${item.isActive === false ? "Inactive" : "Active"}`,
      `Created: ${formatDate(item.createdAt)}`,
      `URL: ${item.imageUrl || "-"}`,
    ],
  },
};

export default function AdminManageScreen({
  entity,
  embedded = false,
}: {
  entity: AdminEntity;
  embedded?: boolean;
}) {
  const config = useMemo(() => configs[entity], [entity]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);

  const loadItems = useCallback(
    async (targetPage: number, targetSearch: string, append: boolean) => {
      const response = await config.load({
        page: targetPage,
        limit: PAGE_SIZE,
        search: targetSearch || undefined,
      });
      setTotal(response.total);
      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setPage(targetPage);
      setError("");
    },
    [config]
  );

  useEffect(() => {
    setLoading(true);
    loadItems(1, searchQuery, false)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to load data.";
        setError(message);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [loadItems, searchQuery]);

  const hasMore = total == null ? items.length >= page * PAGE_SIZE : items.length < total;

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) {
      return;
    }
    const nextPage = page + 1;
    setLoadingMore(true);
    loadItems(nextPage, searchQuery, true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to load more.";
        setError(message);
      })
      .finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!embedded ? <Text style={styles.title}>{config.title}</Text> : null}
        {!embedded ? <Text style={styles.subtitle}>{config.subtitle}</Text> : null}

        <View style={styles.searchRow}>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={config.searchPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable onPress={handleSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {loading ? <Text style={styles.helper}>Loading...</Text> : null}
        {!loading && !!error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && items.length === 0 ? <Text style={styles.helper}>No records found.</Text> : null}

        <View style={styles.list}>
          {items.map((item) => (
            <View key={config.itemId(item)} style={styles.card}>
              <Text style={styles.primaryText}>{config.primary(item)}</Text>
              {config.lines(item).map((line, index) => (
                <Text key={`${config.itemId(item)}-${index}`} style={styles.lineText}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {!loading && hasMore ? (
          <Pressable style={styles.moreButton} onPress={handleLoadMore} disabled={loadingMore}>
            <Text style={styles.moreButtonText}>{loadingMore ? "Loading..." : "Load More"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800", marginTop: 14, marginBottom: 4 },
  subtitle: { color: colors.mutedForeground, fontSize: 14, marginBottom: 14 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: colors.muted,
  },
  searchButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  searchButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  helper: { color: colors.mutedForeground, fontSize: 13, marginBottom: 8 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 8, fontWeight: "600" },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  primaryText: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  lineText: { color: colors.mutedForeground, fontSize: 13 },
  moreButton: {
    marginTop: 14,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  moreButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
});
