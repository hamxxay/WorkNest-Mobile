import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listBookings, type StaffBooking } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDateRange, formatMoney } from "../../../../utils/format";
import { ActiveFilterChips, ListFilterSheet, filteredEmpty, useListFilters } from "../shared/ListFilters";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";
import { useStackedMeta } from "../shared/layout";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 15;

/**
 * Bookings (GET booking?page=&limit=&search=&locationId=&status=&from=&to=): newest first, admins and sales
 * executives see their own locations. Search by customer, email, space or challan number; filter by location,
 * status and start date (on the server, ../shared/ListFilters).
 */
export default function BookingListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const filter = useListFilters("bookings");
  const { filters } = filter;
  const fetchPage = useCallback((page: number) => listBookings({ page, limit: PAGE_SIZE, search, ...filters }), [search, filters]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Bookings"
        subtitle={list.total ? `${list.total} in total` : undefined}
        actions={[filter.headerAction, { icon: "add", accessibilityLabel: "New booking", onPress: () => navigation.navigate("BookingForm") }]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer, space or challan" />
      <ActiveFilterChips state={filter} />
      <AsyncList
        data={list.items}
        keyExtractor={(b) => String(b.bookingId)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={
          filteredEmpty(filter, "bookings", search) ?? {
            illustration: search ? "search" : "calendar",
            title: search ? "No bookings found" : "No bookings yet",
            message: search ? `Nothing matches "${search}".` : undefined,
          }
        }
        renderItem={({ item }) => (
          <BookingCard booking={item} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.bookingId })} />
        )}
      />
      <ListFilterSheet state={filter} />
    </StaffScreen>
  );
}

function BookingCard({ booking: b, onPress }: { booking: StaffBooking; onPress: () => void }) {
  // Large text on a narrow phone: the status and the amount go under the text beside them.
  const stacked = useStackedMeta();
  return (
    <Card onPress={onPress} accessibilityLabel={`Booking ${b.bookingId}, ${b.customerName}, ${b.statusLabel}`}>
      <View style={stacked ? styles.stack : styles.row}>
        <View style={stacked ? undefined : styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={stacked ? 2 : 1}>
            {b.customerName || "Customer"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            #{b.bookingId}
            {b.challanNumber ? ` · ${b.challanNumber}` : ""}
          </AppText>
        </View>
        <StatusPill status={b.statusLabel || "Unknown"} />
      </View>
      <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.gapTop}>
        {[b.spaceName, b.locationName].filter(Boolean).join(" · ") || "Space"}
      </AppText>
      <View style={[stacked ? styles.stack : styles.row, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={stacked ? undefined : styles.flex}>
          {formatDateRange(b.contractStartDate || b.startOn, b.contractEndDate || b.endOn)}
        </AppText>
        {b.totalAmount ? (
          <AppText variant="amount" numberOfLines={1} style={styles.shrink}>
            {formatMoney(b.totalAmount)}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stack: { alignItems: "flex-start", gap: spacing.xs },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  gapTop: { marginTop: spacing.xs },
});
