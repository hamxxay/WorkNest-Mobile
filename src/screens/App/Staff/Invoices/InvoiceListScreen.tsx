import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, FilterChips, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { INVOICE_TYPES, listInvoices, type StaffInvoice } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 20;

const TYPE_FILTERS = [{ label: "All", value: 0 }, ...Object.entries(INVOICE_TYPES).map(([id, label]) => ({ label, value: Number(id) }))];

/** Invoices & billing (GET invoice?page=&limit=&search=&typeId=): type filter on the server, CMS overdue rule. */
export default function InvoiceListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState(0);
  const search = useDebounced(query.trim());
  const fetchPage = useCallback(
    (page: number) => listInvoices({ page, limit: PAGE_SIZE, search, typeId: typeId || null }),
    [search, typeId],
  );
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader title="Invoices & billing" subtitle={list.total ? `${list.total} invoices` : undefined} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search invoice number or customer" />
      <FilterChips value={typeId} onChange={setTypeId} options={TYPE_FILTERS} accessibilityLabel="Invoice type" style={styles.chipBar} contentContainerStyle={styles.chips} />
      <AsyncList
        data={list.items}
        keyExtractor={(i) => String(i.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ illustration: search || typeId ? "search" : "receipt", title: search || typeId ? "No invoices found" : "No invoices yet" }}
        renderItem={({ item }) => (
          <InvoiceCard invoice={item} onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: item.id, invoice: item })} />
        )}
      />
    </StaffScreen>
  );
}

export function InvoiceCard({ invoice: inv, onPress }: { invoice: StaffInvoice; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Invoice ${inv.invoiceNumber}, ${inv.customerName}, ${inv.status}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {inv.customerName || "Customer"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[inv.invoiceNumber, inv.invoiceType].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        <StatusPill status={inv.status} />
      </View>
      <View style={[styles.row, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={styles.flex} numberOfLines={1}>
          {[inv.spaceName, `Due ${formatDate(inv.dueOn)}`].filter(Boolean).join(" · ")}
        </AppText>
        <View style={styles.amount}>
          <AppText variant="bodyStrong">{formatMoney(inv.grandTotal)}</AppText>
          {inv.balanceDue > 0 && inv.balanceDue !== inv.grandTotal ? (
            <AppText variant="caption" color="warning">
              {formatMoney(inv.balanceDue)} due
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.sm },
  amount: { alignItems: "flex-end" },
});
