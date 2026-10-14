import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, AppText, Banner, Card, EmptyState, ListSkeleton, Screen, StatusPill } from "../../../components/ui";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import { ceoErrorView, getCeoRecords, recordCards, showingText, type CeoRecordCard } from "../../../services/ceo";
import { spacing } from "../../../theme";
import { useRefreshColors } from "../Staff/shared/refresh";
import { Breadcrumb, CeoErrorState, useCeoQuery } from "./parts";

type Route = RouteProp<CeoStackParamList, "CeoRecords">;

/** One read-only record: title, status, amount and its details. Not pressable (the CEO only views). */
function RecordCard({ item }: { item: CeoRecordCard }) {
  return (
    <Card accessible accessibilityLabel={item.accessibilityLabel}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          {item.subtitle ? (
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {item.subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.side}>
          {item.status ? <StatusPill status={item.status} size="sm" /> : null}
          {item.amount ? (
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.amount}>
              {item.amount}
            </AppText>
          ) : null}
        </View>
      </View>
      {item.fields.length ? (
        <View style={styles.fields}>
          {item.fields.map((f) => (
            <View key={f.label} style={styles.field}>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {f.label}
              </AppText>
              <AppText variant="bodySmall" numberOfLines={3}>
                {f.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Drill level 3 (GET api/ceo/records/*): the invoices, spaces, bookings, tour inquiries or quotations behind a
 * figure, newest first (the API sends at most 200, "Showing x of total"). Read-only cards, no actions.
 */
export default function CeoRecordsScreen() {
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel, title } = params;
  const refreshColors = useRefreshColors();
  const load = useCallback(() => getCeoRecords(query), [query]);
  const q = useCeoQuery(load);
  const cards = useMemo(() => (q.data ? recordCards(q.data) : []), [q.data]);
  const showing = q.data ? showingText(cards.length, q.data.total) : "";

  const header = (
    <View style={styles.header}>
      <Breadcrumb trail={trail} scopeLabel={scopeLabel} />
      {showing ? (
        <AppText variant="captionStrong" color="textSecondary" accessibilityLiveRegion="polite">
          {showing}
        </AppText>
      ) : null}
      {q.data && q.error && !q.refreshing ? (
        <Banner tone="warning" title={ceoErrorView(q.error).title} message={`${ceoErrorView(q.error).message} The list below is from the last update.`} />
      ) : null}
    </View>
  );

  const empty = q.loading ? (
    <ListSkeleton rows={5} avatar={false} />
  ) : q.error && !q.data ? (
    <CeoErrorState error={q.error} onRetry={q.reload} />
  ) : (
    <Card>
      <EmptyState compact illustration="inbox" title="Nothing to show" message="There are no records for this choice." />
    </Card>
  );

  return (
    <Screen>
      <AppHeader title={q.data?.title ?? title ?? "Records"} />
      <FlatList
        data={cards}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <RecordCard item={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} {...refreshColors} />}
        initialNumToRender={8}
        windowSize={7}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl, flexGrow: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  separator: { height: spacing.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  side: { alignItems: "flex-end", gap: spacing.xs, maxWidth: "45%" },
  amount: { fontVariant: ["tabular-nums"] },
  fields: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md, rowGap: spacing.sm, columnGap: spacing.lg },
  field: { minWidth: "40%", flexGrow: 1, flexBasis: "40%", gap: 2 },
});
