import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listQuotations, type StaffQuotation } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { ActiveFilterChips, ListFilterSheet, filteredEmpty, useListFilters } from "../shared/ListFilters";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";
import { useStackedMeta } from "../shared/layout";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 15;

/**
 * Quotations (GET quotation?page=&limit=&search=&locationId=&status=&from=&to=): every version is its own row,
 * newest first; admins and sales executives see their own locations. Search by quotation number or customer;
 * filter by location, status and created date (on the server, ../shared/ListFilters).
 */
export default function QuotationListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const filter = useListFilters("quotations");
  const { filters } = filter;
  const fetchPage = useCallback((page: number) => listQuotations({ page, limit: PAGE_SIZE, search, ...filters }), [search, filters]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Quotations"
        subtitle={list.total ? `${list.total} in total` : undefined}
        actions={[filter.headerAction, { icon: "add", accessibilityLabel: "New quotation", onPress: () => navigation.navigate("QuotationForm") }]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search number or customer" />
      <ActiveFilterChips state={filter} />
      <AsyncList
        data={list.items}
        keyExtractor={(q) => String(q.id)}
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
          filteredEmpty(filter, "quotations", search) ?? {
            illustration: search ? "search" : "document",
            title: search ? "No quotations found" : "No quotations yet",
            message: search ? `Nothing matches "${search}".` : "Create a quotation for a customer.",
            actionLabel: search ? undefined : "New quotation",
            onAction: search ? undefined : () => navigation.navigate("QuotationForm"),
          }
        }
        renderItem={({ item }) => (
          <QuotationCard quotation={item} onPress={() => navigation.navigate("QuotationDetail", { quotationId: item.id })} />
        )}
      />
      <ListFilterSheet state={filter} />
    </StaffScreen>
  );
}

export function QuotationCard({ quotation: q, onPress }: { quotation: StaffQuotation; onPress: () => void }) {
  // Large text on a narrow phone: the status and the amount go under the text beside them.
  const stacked = useStackedMeta();
  return (
    <Card onPress={onPress} accessibilityLabel={`Quotation ${q.quotationNumber}, ${q.customerName}, ${q.status}`}>
      <View style={stacked ? styles.stack : styles.row}>
        <View style={stacked ? undefined : styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={stacked ? 2 : 1}>
            {q.customerName || "Customer"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {q.quotationNumber} · v{q.version}
          </AppText>
        </View>
        <StatusPill status={q.status} />
      </View>
      <View style={[stacked ? styles.stack : styles.row, styles.gapTop]}>
        <AppText variant="bodySmall" color="textSecondary" style={stacked ? undefined : styles.flex} numberOfLines={1}>
          {[q.spaceName, q.locationName].filter(Boolean).join(" · ") || "Space"}
        </AppText>
        <AppText variant="amount" numberOfLines={1} style={styles.shrink}>
          {formatMoney(q.totalPayable || q.totalAmount)}
        </AppText>
      </View>
      {q.validUntil ? (
        <AppText variant="caption" color="textMuted" style={styles.gapTop}>
          Valid until {formatDate(q.validUntil)}
        </AppText>
      ) : null}
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
