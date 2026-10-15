import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { AppHeader, AppText, Card, EmptyState, ListSkeleton, Screen, StatusPill } from "../../../components/ui";
import { ceoErrorView, showingText, type CeoRecordCard } from "../../../services/ceo";
import { spacing } from "../../../theme";
import { useRefreshColors } from "../Staff/shared/refresh";
import { Breadcrumb, CeoErrorState, StaleBanner, useCeoQuery, type DescribeError } from "./parts";

// Drill level 3 of a read-only dashboard (CEO: GET api/ceo/records/*, Sales Manager: GET api/sales-manager/records/*):
// the records behind a figure as read-only cards, newest first (the API sends at most 200, "Showing x of total").
// No actions. The screens (CeoRecordsScreen, SalesManagerRecordsScreen) pass how to load the list as cards.

/** A records list ready to show: the server's title, its full count and one card per row. */
export type RecordCardList = { title: string; total: number; cards: CeoRecordCard[] };

/** One read-only record: title, status, amount and its details. Not pressable (the viewer only views). */
export function RecordCard({ item }: { item: CeoRecordCard }) {
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
          {item.status ? <StatusPill status={item.status} tone={item.statusTone} size="sm" /> : null}
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

export type RecordsViewProps = {
  /** Header title until the list has loaded (the server's title wins). */
  fallbackTitle: string;
  trail: readonly string[];
  scopeLabel?: string;
  /** Loads the list as cards; called again when it changes. Keep it stable (useCallback). */
  load: () => Promise<RecordCardList>;
  /** Error wording (default the CEO's). */
  describeError?: DescribeError;
};

export function RecordsView({ fallbackTitle, trail, scopeLabel, load, describeError = ceoErrorView }: RecordsViewProps) {
  const refreshColors = useRefreshColors();
  const q = useCeoQuery(load);
  const cards = q.data?.cards ?? [];
  const showing = q.data ? showingText(cards.length, q.data.total) : "";

  const header = (
    <View style={styles.header}>
      <Breadcrumb trail={trail} scopeLabel={scopeLabel} />
      {showing ? (
        <AppText variant="captionStrong" color="textSecondary" accessibilityLiveRegion="polite">
          {showing}
        </AppText>
      ) : null}
      {q.data && q.error && !q.refreshing ? <StaleBanner error={q.error} describe={describeError} what="The list below is" /> : null}
    </View>
  );

  const empty = q.loading ? (
    <ListSkeleton rows={5} avatar={false} />
  ) : q.error && !q.data ? (
    <CeoErrorState error={q.error} onRetry={q.reload} describe={describeError} />
  ) : (
    <Card>
      <EmptyState compact illustration="inbox" title="Nothing to show" message="There are no records for this choice." />
    </Card>
  );

  return (
    <Screen>
      <AppHeader title={q.data?.title ?? fallbackTitle} />
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
