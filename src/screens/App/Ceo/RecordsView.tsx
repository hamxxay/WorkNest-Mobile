import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppHeader,
  AppText,
  Card,
  EmptyState,
  ListSkeleton,
  ResponsiveGrid,
  Screen,
  StatusPill,
  useScreenColumnWidth,
} from "../../../components/ui";
import { ceoErrorView, showingText, type CeoRecordCard } from "../../../services/ceo";
import { spacing, useThemeColors } from "../../../theme";
import { scaledMinWidth } from "../../../utils/responsive";
import { useRefreshColors } from "../Staff/shared/refresh";
import { Breadcrumb, CeoErrorState, StaleBanner, useCeoQuery, type DescribeError } from "./parts";

// Drill level 3 of a read-only dashboard (CEO: GET api/ceo/records/*, Sales Manager: GET api/sales-manager/records/*):
// the records behind a figure as read-only cards, newest first (the API sends at most 200, "Showing x of total").
// No actions. The screens (CeoRecordsScreen, SalesManagerRecordsScreen) pass how to load the list as cards.

/** A records list ready to show: the server's title, its full count and one card per row. */
export type RecordCardList = { title: string; total: number; cards: CeoRecordCard[] };

/** Narrowest the title gets beside the status / amount before they go under it (font scale 1, dp). */
const TITLE_MIN_WIDTH = 140;
/** Narrowest a detail field gets before the details go in fewer columns (font scale 1, dp). */
const FIELD_MIN_WIDTH = 115;
/** Card padding + border on each side (dp): Card's default padding 16 and its 1dp border. */
const CARD_INSET = 17;

/**
 * One read-only record: title (an invoice's billing period and issue date under it), status, amount and its details. Not pressable (the viewer only views), except when
 * `onPress` is given (the staff dashboard drill-down opens the record's booking or invoice; a chevron shows it).
 * The status and amount sit beside the title while it keeps TITLE_MIN_WIDTH; otherwise (320dp phone, a long
 * amount, large text) they move to their own line, right-aligned, so an amount is never cut. The details are in
 * as many columns as fit (2 on a phone, 1 with large text, up to 3 on a tablet).
 */
export function RecordCard({ item, onPress, accessibilityHint }: { item: CeoRecordCard; onPress?: () => void; accessibilityHint?: string }) {
  const { fontScale } = useWindowDimensions();
  const columnWidth = useScreenColumnWidth();
  const colors = useThemeColors();
  const titleMin = { flexBasis: scaledMinWidth(TITLE_MIN_WIDTH, fontScale) };
  return (
    <Card accessible accessibilityLabel={item.accessibilityLabel} accessibilityHint={onPress ? accessibilityHint : undefined} onPress={onPress}>
      <View style={styles.head}>
        <View style={[styles.titleBlock, titleMin]}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          {item.headline ? (
            <>
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
                {item.headline.text}
              </AppText>
              {item.headline.note ? (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {item.headline.note}
                </AppText>
              ) : null}
            </>
          ) : null}
          {item.subtitle ? (
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {item.subtitle}
            </AppText>
          ) : null}
        </View>
        {item.status || item.amount ? (
          <View style={styles.side}>
            {item.status ? <StatusPill status={item.status} tone={item.statusTone} size="sm" /> : null}
            {item.amount ? (
              <AppText variant="bodyStrong" numberOfLines={2} style={styles.amount}>
                {item.amount}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} /> : null}
      </View>
      {item.fields.length ? (
        <ResponsiveGrid
          minItemWidth={FIELD_MIN_WIDTH}
          maxColumns={3}
          estimatedWidth={columnWidth - 2 * spacing.screen - 2 * CARD_INSET}
          style={styles.fields}
        >
          {item.fields.map((f) => (
            <View key={f.label} style={styles.field}>
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {f.label}
              </AppText>
              <AppText variant="bodySmall" numberOfLines={3}>
                {f.value}
              </AppText>
            </View>
          ))}
        </ResponsiveGrid>
      ) : null}
    </Card>
  );
}

export type RecordsViewProps = {
  /** Header title until the list has loaded (the server's title wins). */
  fallbackTitle: string;
  /** Header title that stays (the server's title is not shown), e.g. "Active bookings". */
  fixedTitle?: string;
  trail: readonly string[];
  scopeLabel?: string;
  /** Loads the list as cards; called again when it changes. Keep it stable (useCallback). */
  load: () => Promise<RecordCardList>;
  /** Error wording (default the CEO's). */
  describeError?: DescribeError;
};

export function RecordsView({ fallbackTitle, fixedTitle, trail, scopeLabel, load, describeError = ceoErrorView }: RecordsViewProps) {
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
      <AppHeader title={fixedTitle ?? q.data?.title ?? fallbackTitle} />
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
  // Title, then status + amount on the same line when they fit, else on the next one (flexWrap).
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: spacing.md, rowGap: spacing.xs },
  titleBlock: { flexGrow: 1, flexShrink: 1, gap: 2 },
  side: { alignItems: "flex-end", gap: spacing.xs, flexShrink: 1, marginLeft: "auto" },
  amount: { fontVariant: ["tabular-nums"], textAlign: "right" },
  chevron: { alignSelf: "center" },
  fields: { marginTop: spacing.md },
  field: { gap: 2 },
});
