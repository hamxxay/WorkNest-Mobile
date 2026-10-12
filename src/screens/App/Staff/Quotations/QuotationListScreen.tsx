import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listQuotations, type StaffQuotation } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 15;

/**
 * Quotations (GET quotation?page=&limit=&search=): every version is its own row, newest first; admins and sales
 * executives see their own locations. Search by quotation number or customer.
 */
export default function QuotationListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const fetchPage = useCallback((page: number) => listQuotations({ page, limit: PAGE_SIZE, search }), [search]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Quotations"
        subtitle={list.total ? `${list.total} in total` : undefined}
        actions={[{ icon: "add", accessibilityLabel: "New quotation", onPress: () => navigation.navigate("QuotationForm") }]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search number or customer" />
      <AsyncList
        key={list.listKey}
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
        empty={{
          icon: "document-text-outline",
          title: search ? "No quotations found" : "No quotations yet",
          message: search ? `Nothing matches "${search}".` : "Create a quotation for a customer.",
          actionLabel: search ? undefined : "New quotation",
          onAction: search ? undefined : () => navigation.navigate("QuotationForm"),
        }}
        renderItem={({ item }) => (
          <QuotationCard quotation={item} onPress={() => navigation.navigate("QuotationDetail", { quotationId: item.id })} />
        )}
      />
    </StaffScreen>
  );
}

export function QuotationCard({ quotation: q, onPress }: { quotation: StaffQuotation; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Quotation ${q.quotationNumber}, ${q.customerName}, ${q.status}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {q.customerName || "Customer"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {q.quotationNumber} · v{q.version}
          </AppText>
        </View>
        <StatusPill status={q.status} />
      </View>
      <View style={[styles.row, styles.gapTop]}>
        <AppText variant="bodySmall" color="textSecondary" style={styles.flex} numberOfLines={1}>
          {[q.spaceName, q.locationName].filter(Boolean).join(" · ") || "Space"}
        </AppText>
        <AppText variant="bodyStrong">{formatMoney(q.totalPayable || q.totalAmount)}</AppText>
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
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.xs },
});
