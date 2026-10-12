import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, FilterChips, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listAgreements, type StaffAgreement } from "../../../../services/staff";
import { spacing, statusTone } from "../../../../theme";
import { formatDate } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "AgreementList">;
const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Sent", value: "AgreementSent" },
  { label: "Signed copy received", value: "SignedUploaded" },
  { label: "Signed", value: "Signed" },
  { label: "Email failed", value: "EmailFailed" },
];

/** Lease agreements (GET agreement?page=&limit=&search=&status=), filtered by status on the server. */
export default function AgreementListScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params?.status ?? "");
  const search = useDebounced(query.trim());
  const fetchPage = useCallback(
    (page: number) => listAgreements({ page, limit: PAGE_SIZE, search, status: status || undefined }),
    [search, status],
  );
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader title="Agreements" subtitle={list.total ? `${list.total} agreements` : undefined} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer, company, quotation or CNIC" />
      <FilterChips
        value={status}
        onChange={setStatus}
        options={STATUS_FILTERS}
        accessibilityLabel="Agreement status"
        style={styles.chipBar}
        contentContainerStyle={styles.chips}
      />
      <AsyncList
        data={list.items}
        keyExtractor={(a) => String(a.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ icon: "document-attach-outline", title: "No agreements", message: "Agreements are sent from accepted quotations." }}
        renderItem={({ item }) => <AgreementCard agreement={item} onPress={() => navigation.navigate("AgreementDetail", { agreement: item })} />}
      />
    </StaffScreen>
  );
}

function AgreementCard({ agreement: a, onPress }: { agreement: StaffAgreement; onPress: () => void }) {
  const tone = a.bookingId ? "success" : statusTone(a.status);
  return (
    <Card onPress={onPress} accessibilityLabel={`Agreement for ${a.customerName}, ${a.statusLabel}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {a.customerName || "Customer"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[a.quotationNumber, a.entityType].filter(Boolean).join(" · ")}
          </AppText>
        </View>
      </View>
      <View style={[styles.row, styles.gapTop]}>
        <StatusPill tone={tone} label={a.statusLabel} />
        <AppText variant="caption" color="textMuted" style={styles.flex} align="right">
          {a.signedDate ? `Signed ${formatDate(a.signedDate)}` : a.sentDate ? `Sent ${formatDate(a.sentDate)}` : ""}
        </AppText>
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
});
