import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listBookings, type StaffBooking } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDateRange, formatMoney } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 15;

/**
 * Bookings (GET booking?page=&limit=&search=): newest first, admins and sales executives see their own
 * locations. Search by customer, email, space or challan number (the API has no status / date filter).
 */
export default function BookingListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const fetchPage = useCallback((page: number) => listBookings({ page, limit: PAGE_SIZE, search }), [search]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Bookings"
        subtitle={list.total ? `${list.total} in total` : undefined}
        actions={[{ icon: "add", accessibilityLabel: "New booking", onPress: () => navigation.navigate("BookingForm") }]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer, space or challan" />
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
        empty={{ icon: "calendar-outline", title: search ? "No bookings found" : "No bookings yet", message: search ? `Nothing matches "${search}".` : undefined }}
        renderItem={({ item }) => (
          <BookingCard booking={item} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.bookingId })} />
        )}
      />
    </StaffScreen>
  );
}

function BookingCard({ booking: b, onPress }: { booking: StaffBooking; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Booking ${b.bookingId}, ${b.customerName}, ${b.statusLabel}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
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
      <View style={[styles.row, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          {formatDateRange(b.contractStartDate || b.startOn, b.contractEndDate || b.endOn)}
        </AppText>
        {b.totalAmount ? <AppText variant="amount">{formatMoney(b.totalAmount)}</AppText> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.xs },
});
