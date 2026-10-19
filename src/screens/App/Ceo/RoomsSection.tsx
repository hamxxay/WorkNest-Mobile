import { Fragment, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { BarChart } from "../../../components/charts";
import {
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  FilterChips,
  ResponsiveGrid,
  StatusPill,
  useScreenColumnWidth,
  type StatCardProps,
  type TextColor,
} from "../../../components/ui";
import {
  ALL_ROOMS,
  ROOM_PRICE_TOLERANCE_PCT,
  ROOM_NOW_FILTERS,
  ROOM_PRICING_LABELS,
  ROOM_PRICING_TONES,
  ROOM_SHIFT_FILTERS,
  count,
  filterRooms,
  money,
  pct,
  periodWords,
  roomCardView,
  roomFilterCounts,
  roomFilterLabel,
  roomNowLabel,
  roomPricingFilters,
  roomsShownText,
  signedMoneyCompact,
  type CeoRoomReport,
  type CeoRoomSalePricing,
  type CeoRooms,
  type RoomCardView,
  type RoomFilters,
  type RoomSaleView,
} from "../../../services/ceo";
import { spacing, type Tone } from "../../../theme";
import { scaledMinWidth } from "../../../utils/responsive";
import { FigureTable, KpiGrid } from "../Staff/Dashboard/parts";
import { CeoErrorState, CeoSection, ChartCard, SectionEmpty, StaleBanner, type CeoQuery } from "./parts";
import type { Drill } from "./sections";

// The Rooms section of the CEO dashboard (GET api/ceo/rooms), loaded on its own: when it fails only this section
// shows the error and the rest of the dashboard keeps working. Rooms sold monthly (private offices, shared spaces):
// how full they are now and in the period, and the price each booking was sold at against the expected price (the
// list price per seat, every shift). A booking on a room without a list price is shown as
// "No list price" and not compared. Read-only; the tiles and the chart only filter the room list below them. Colours
// come from the light / dark theme tokens; no emojis.

/** Rooms shown before "Show more" (the list sits in the dashboard's scroll view, not a virtualised list). */
export const ROOMS_PAGE = 10;

/** Narrowest a room card gets before cards go one per row (dp): one per row on phones and the Fold, two on a tablet. */
const ROOM_CARD_MIN_WIDTH = 360;
/** Narrowest a title gets beside its pill before the pill goes under it (font scale 1, dp). */
const TITLE_MIN_WIDTH = 140;
/** Narrowest a price figure gets before the figures go in fewer columns (font scale 1, dp). */
const FIGURE_MIN_WIDTH = 104;
/** Card padding + border on each side (dp). */
const CARD_INSET = 17;

const SHIFT_NOTE = "Every shift is compared with the room's list price per seat";

/** Text colour of a figure in a tone (the difference: red under, green over). */
const TONE_TEXT: Partial<Record<Tone, TextColor>> = { danger: "danger", success: "success" };

/**
 * The whole section: heading, then skeletons while loading, its own error with "Try again", the server's message
 * when the report is not available yet (nothing else), an empty state, or the figures. Figures kept after a failed
 * refresh get a warning above them.
 */
export function RoomsBlock({ query, drill }: { query: CeoQuery<CeoRooms>; drill: Drill }) {
  const words = periodWords(drill.period);
  const r = query.data;
  let body: ReactNode = null;
  if (r && !r.available) {
    body = <SectionEmpty title="Not available yet" message={r.message} />;
  } else if (r) {
    body = r.rooms.length ? (
      <RoomsContent report={r} drill={drill} />
    ) : (
      <SectionEmpty title="No rooms" message="No private offices or shared spaces are set up for this location." />
    );
  } else if (query.error) {
    body = (
      <Card>
        <CeoErrorState compact error={query.error} onRetry={query.reload} />
      </Card>
    );
  }
  return (
    <CeoSection
      title="Rooms"
      subtitle={`Occupancy and the price each room was sold at, ${words}`}
      note={r && !r.available ? undefined : SHIFT_NOTE}
      loading={query.loading}
      empty={false}
      emptyMessage=""
    >
      {r && query.error && !query.refreshing ? <StaleBanner error={query.error} what="The rooms below are" /> : null}
      {body}
    </CeoSection>
  );
}

/** KPI tiles, the pricing by shift chart and the filtered room list. */
export function RoomsContent({ report, drill }: { report: CeoRoomReport; drill: Drill }) {
  const words = periodWords(drill.period);
  const s = report.summary;
  const [filters, setFiltersState] = useState<RoomFilters>(ALL_ROOMS);
  const [shown, setShown] = useState(ROOMS_PAGE);
  const setFilters = (next: RoomFilters) => {
    setFiltersState(next);
    setShown(ROOMS_PAGE);
  };
  /** A tile or a chart column: the list with just that, scrolled into view. */
  const showInList = (next: Partial<RoomFilters>) => {
    setFilters({ ...ALL_ROOMS, ...next });
    drill.focus("roomList");
  };

  const counts = useMemo(() => roomFilterCounts(report.rooms, filters), [report.rooms, filters]);
  const pricingOptions = useMemo(() => roomPricingFilters(report.rooms, filters.pricing), [report.rooms, filters.pricing]);
  // Sales without a list price get their own part of the chart only when there are any.
  const parts: CeoRoomSalePricing[] = s.unpriced > 0 ? ["under", "at", "over", "unpriced"] : ["under", "at", "over"];
  const items = useMemo(() => filterRooms(report.rooms, filters), [report.rooms, filters]);
  const cards = useMemo(() => items.slice(0, shown).map((item, i) => roomCardView(item, drill.period, i)), [items, shown, drill.period]);
  const more = items.length - cards.length;

  const tiles: StatCardProps[] = [
    {
      label: "Occupied now",
      value: `${count(s.occupiedNow)} of ${count(s.rooms)}`,
      sub: `${pct(s.occupancyNowPct)} of rooms`,
      icon: "business-outline",
      tone: s.occupancyNowPct >= 70 ? "success" : s.occupancyNowPct >= 40 ? "primary" : "warning",
      onPress: () => showInList({ now: "occupied" }),
      accessibilityHint: "Shows the occupied rooms in the list below",
    },
    {
      label: "Vacant now",
      value: count(s.vacantNow),
      sub: s.vacantNow ? "rooms free to sell today" : "every room is in use",
      icon: "key-outline",
      tone: s.vacantNow ? "warning" : "success",
      onPress: () => showInList({ now: "vacant" }),
      accessibilityHint: "Shows the vacant rooms in the list below",
    },
    {
      label: `Occupancy ${words}`,
      value: pct(s.periodOccupancyPct),
      sub: "of days with a booking",
      icon: "calendar-outline",
      tone: "info",
    },
    {
      label: "Sold under price",
      value: count(s.under),
      sub: s.under ? `${money(-s.underMonthly)} a month below` : "none below the expected price",
      icon: "trending-down-outline",
      tone: s.under ? "danger" : "success",
      onPress: () => showInList({ pricing: "under" }),
      accessibilityHint: "Shows the bookings sold under the price in the list below",
    },
    {
      label: "At price",
      value: count(s.at),
      sub: `within ${pct(ROOM_PRICE_TOLERANCE_PCT)} of expected`,
      icon: "checkmark-circle-outline",
      tone: "neutral",
      onPress: () => showInList({ pricing: "at" }),
      accessibilityHint: "Shows the bookings sold at the price in the list below",
    },
    {
      label: "Sold over price",
      value: count(s.over),
      sub: s.over ? `${money(s.overMonthly)} a month above` : "none above the expected price",
      icon: "trending-up-outline",
      tone: s.over ? "success" : "neutral",
      onPress: () => showInList({ pricing: "over" }),
      accessibilityHint: "Shows the bookings sold over the price in the list below",
    },
    {
      label: "Sold a month",
      value: money(s.soldMonthly),
      sub: s.sales ? `${signedMoneyCompact(s.varianceMonthly)} vs ${money(s.listMonthly)} expected` : `no bookings ${words}`,
      icon: "cash-outline",
      tone: s.varianceMonthly < 0 ? "warning" : "success",
    },
  ];

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartCard title="Pricing by shift" caption={`Sales ${words} under, at or over the expected price. Tap a shift to list its rooms.`}>
        <BarChart
          stacked
          height={120}
          label={`Sales under, at and over the expected price by shift, ${words}`}
          series={parts.map((p) => ({ label: ROOM_PRICING_LABELS[p], tone: ROOM_PRICING_TONES[p] }))}
          data={s.byShift.map((x) => ({ label: x.shift, title: `${x.shift} bookings`, values: parts.map((p) => x[p]) }))}
          formatValue={count}
          emptyText={`No sales ${words}.`}
          itemAccessibilityHint="Shows this shift's rooms in the list below"
          onPressItem={(i) => {
            const shift = s.byShift[i]?.shift;
            if (shift) showInList({ shift });
          }}
        />
        {s.sales > 0 ? (
          <View style={styles.gapTop}>
            <FigureTable
              columns={[
                { label: "Shift", flex: 1.2 },
                ...parts.map((p) => ({ label: p === "unpriced" ? "No price" : ROOM_PRICING_LABELS[p], align: "right" as const })),
                { label: "Net a month", flex: 1.6, align: "right" },
              ]}
              rows={s.byShift.map((x) => ({
                key: x.shift,
                cells: [x.shift, ...parts.map((p) => count(x[p])), signedMoneyCompact(x.varianceMonthly)],
              }))}
            />
          </View>
        ) : null}
      </ChartCard>

      <View ref={drill.target("roomList")} collapsable={false} style={styles.list}>
        <View style={styles.listHead}>
          <AppText variant="subheading" accessibilityRole="header">
            Room list
          </AppText>
          <AppText variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            {roomsShownText(cards.length, items.length)}
          </AppText>
        </View>
        <FilterGroup
          label="Right now"
          value={filters.now}
          options={ROOM_NOW_FILTERS.map((v) => ({ label: roomNowLabel(v), value: v, count: counts.now[v] }))}
          onChange={(now) => setFilters({ ...filters, now })}
        />
        <FilterGroup
          label="Shift"
          value={filters.shift}
          options={ROOM_SHIFT_FILTERS.map((v) => ({ label: roomFilterLabel(v), value: v, count: counts.shift[v] }))}
          onChange={(shift) => setFilters({ ...filters, shift })}
        />
        <FilterGroup
          label="Pricing"
          value={filters.pricing}
          options={pricingOptions.map((v) => ({ label: roomFilterLabel(v), value: v, count: counts.pricing[v] }))}
          onChange={(pricing) => setFilters({ ...filters, pricing })}
        />
        {cards.length ? (
          <ResponsiveGrid minItemWidth={ROOM_CARD_MIN_WIDTH} maxColumns={2} balanced={false} fontWeight={0.25} gap={spacing.md}>
            {cards.map((card) => (
              <RoomCard key={card.key} view={card} />
            ))}
          </ResponsiveGrid>
        ) : (
          <Card>
            <EmptyState
              compact
              icon="funnel-outline"
              title="No rooms match"
              message="No room matches these filters."
              actionLabel="Show all rooms"
              onAction={() => setFilters(ALL_ROOMS)}
            />
          </Card>
        )}
        {more > 0 ? (
          <Button
            variant="outline"
            fullWidth
            leftIcon="chevron-down"
            title={`Show ${count(Math.min(more, ROOMS_PAGE))} more`}
            accessibilityHint={`${count(more)} more rooms match`}
            onPress={() => setShown((n) => n + ROOMS_PAGE)}
          />
        ) : null}
      </View>
    </>
  );
}

/** A labelled row of filter chips (wraps on a small phone or with large text, so every option stays in view). */
function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { label: string; value: T; count: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <AppText variant="captionStrong" color="textSecondary">
        {label}
      </AppText>
      <FilterChips scrollable={false} accessibilityLabel={label} options={options} value={value} onChange={onChange} />
    </View>
  );
}

/**
 * A room: name, code / location / type / seats, whether it is in use now, its list price and occupancy in the
 * period, then one block per sale (or "No booking" for a vacant room). Not pressable.
 */
export function RoomCard({ view }: { view: RoomCardView }) {
  const { fontScale } = useWindowDimensions();
  const columnWidth = useScreenColumnWidth();
  const titleMin: ViewStyle = { flexBasis: scaledMinWidth(TITLE_MIN_WIDTH, fontScale) };
  const figuresWidth = columnWidth - 2 * spacing.screen - 2 * CARD_INSET;
  return (
    <Card style={styles.card}>
      <View accessible accessibilityLabel={view.accessibilityLabel} style={styles.block}>
        <View style={styles.head}>
          <View style={[styles.titleBlock, titleMin]}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {view.title}
            </AppText>
            {view.subtitle ? (
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {view.subtitle}
              </AppText>
            ) : null}
          </View>
          <StatusPill label={view.now.label} tone={view.now.tone} style={styles.pill} />
        </View>
        <AppText variant="caption" color="textSecondary">
          {view.facts}
        </AppText>
      </View>
      {view.vacant ? (
        <>
          <Divider spacing={spacing.md} />
          <View style={styles.head} accessible accessibilityLabel={`Vacant: ${view.vacantText}`}>
            <AppText variant="bodySmall" color="textMuted" style={[styles.titleBlock, titleMin]}>
              {view.vacantText}
            </AppText>
            <StatusPill label="Vacant" tone="neutral" style={styles.pill} />
          </View>
        </>
      ) : (
        view.sales.map((sale) => (
          <Fragment key={sale.key}>
            <Divider spacing={spacing.md} />
            <SaleBlock sale={sale} titleMin={titleMin} figuresWidth={figuresWidth} />
          </Fragment>
        ))
      )}
    </Card>
  );
}

/** One booking: tenant, shift / seats / dates, the Under / At / Over pill and the per-seat prices. */
function SaleBlock({ sale, titleMin, figuresWidth }: { sale: RoomSaleView; titleMin: ViewStyle; figuresWidth: number }) {
  return (
    <View accessible accessibilityLabel={sale.accessibilityLabel} style={styles.block}>
      <View style={styles.head}>
        <View style={[styles.titleBlock, titleMin]}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {sale.tenant}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {sale.detail}
          </AppText>
        </View>
        <StatusPill label={sale.pricingLabel} tone={sale.tone} style={styles.pill} />
      </View>
      <ResponsiveGrid minItemWidth={FIGURE_MIN_WIDTH} maxColumns={4} estimatedWidth={figuresWidth} gap={spacing.sm}>
        {sale.figures.map((f) => (
          <View key={f.label} style={styles.figure}>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {f.label}
            </AppText>
            <AppText
              variant={f.tone ? "label" : "bodySmall"}
              color={(f.tone && TONE_TEXT[f.tone]) || "text"}
              numberOfLines={2}
              style={styles.tabular}
            >
              {f.value}
            </AppText>
          </View>
        ))}
      </ResponsiveGrid>
      {sale.note ? (
        <AppText variant="caption" color="textMuted">
          {sale.note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: spacing.md },
  list: { gap: spacing.md },
  listHead: { gap: 2 },
  filterGroup: { gap: spacing.xs },
  card: { flexGrow: 1 },
  block: { gap: spacing.sm },
  // Title, then the pill on the same line when it fits, else on the next one (flexWrap), on the right.
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: spacing.md, rowGap: spacing.xs },
  titleBlock: { flexGrow: 1, flexShrink: 1, gap: 2 },
  pill: { marginLeft: "auto" },
  figure: { gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
