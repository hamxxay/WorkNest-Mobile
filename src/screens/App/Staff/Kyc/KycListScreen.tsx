import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, ListRow, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listKycCustomers, type KycListItem } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { CompletenessBar } from "./CompletenessBar";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 20;

/** KYC portal (GET kyc?page=&limit=&search=): customers with their document counts and completeness. */
export default function KycListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const fetchPage = useCallback((page: number) => listKycCustomers({ page, limit: PAGE_SIZE, search }), [search]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader title="KYC Portal" subtitle={list.total ? `${list.total} customers` : undefined} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customers" />
      <AsyncList
        key={list.listKey}
        data={list.items}
        keyExtractor={(c) => String(c.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ icon: "id-card-outline", title: search ? "No customers found" : "No customers yet" }}
        renderItem={({ item }) => (
          <KycRow item={item} onPress={() => navigation.navigate("KycCustomer", { customerId: item.id, customerName: item.fullName })} />
        )}
      />
    </StaffScreen>
  );
}

function KycRow({ item, onPress }: { item: KycListItem; onPress: () => void }) {
  const counts = [
    item.pendingDocsCount ? `${item.pendingDocsCount} to review` : null,
    item.rejectedDocsCount ? `${item.rejectedDocsCount} rejected` : null,
    `${item.verifiedDocsCount} verified`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card padding={0}>
      <ListRow
        avatar={{ name: item.fullName }}
        title={item.fullName}
        subtitle={[item.company, item.category].filter(Boolean).join(" · ")}
        right={<StatusPill status={item.overallStatus} />}
        onPress={onPress}
      />
      <View style={styles.progress}>
        <CompletenessBar percent={item.completenessPercentage} />
        <AppText variant="caption" color="textMuted">
          {counts}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
});
