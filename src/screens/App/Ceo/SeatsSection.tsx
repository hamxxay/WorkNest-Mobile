import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { BarChart, HBarList } from "../../../components/charts";
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  StatusPill,
  type StatCardProps,
  type TextColor,
} from "../../../components/ui";
import { count, pct, periodWords, roomsShownText, type CeoPeriod, type CeoScope } from "../../../services/ceo";
import {
  SEAT_RULE_NOTE,
  SEATS_PAGE,
  getCeoSeats,
  oneShiftText,
  seatDrillOf,
  seatDrillOverline,
  seatDrillRooms,
  seatDrillSubtitle,
  seatGroupItems,
  seatRoomView,
  seatShiftRows,
  seatTiles,
  seatTotalsText,
  seatTrendData,
  seatTrendText,
  type CeoSeatReport,
  type CeoSeatRoom,
  type SeatDrill,
  type SeatGroupKind,
  type SeatRoomView,
} from "../../../services/ceo/seats";
import { spacing, type Tone } from "../../../theme";
import { scaledMinWidth } from "../../../utils/responsive";
import { FigureTable, KpiGrid } from "../Staff/Dashboard/parts";
import { CeoErrorState, CeoSection, ChartCard, ChartGrid, InlineEmpty, SectionEmpty, StaleBanner, useCeoQuery } from "./parts";
import type { Drill } from "./sections";

// The Seats section of the CEO dashboard (GET api/ceo/seats), loaded on its own: when it fails only this section
// shows the error and the rest of the dashboard keeps working. Rooms count an office as occupied when any booking
// covers it, which hides half-filled offices; this section counts seats (a seat is sold when any shift on it is
// sold), compares seat occupancy with room occupancy, revenue per seat with the list price, and shows the rent the
// empty seats could earn. A location or space type row opens its rooms in a sheet, most rent not earned first.
// Read-only. Colours come from the light / dark theme tokens; no emojis.

/** Narrowest a figure of a room in the sheet gets before the figures wrap (font scale 1, dp). */
const FIGURE_MIN_WIDTH = 92;
/** Narrowest a room's title gets beside its pill before the pill goes under it (font scale 1, dp). */
const TITLE_MIN_WIDTH = 140;

/** Text colour of a figure in a tone. */
const TONE_TEXT: Partial<Record<Tone, TextColor>> = { warning: "warning", danger: "danger", success: "success" };

/** What the Empty seats and Rent not earned tiles open: every room in scope. */
const EVERY_ROOM: SeatDrill = { kind: "all", name: "Every room" };

/** Spoken after a tile or a row that opens the room sheet. */
const OPENS_ROOMS_HINT = "Lists the rooms, most rent not earned first";

/**
 * The whole section: heading and the counting rule, then skeletons while loading, its own error with "Try again",
 * the server's message when the report is not available yet (nothing else), an empty state, or the figures.
 * Figures kept after a failed refresh get a warning above them. `refreshKey` is when the dashboard last loaded: a
 * change from one time to another (pull to refresh, the 5-minute auto refresh) reloads this section quietly; a
 * change from null (a new period / location) is already a new load here.
 */
export function SeatsBlock({ scope, drill, refreshKey }: { scope: CeoScope; drill: Drill; refreshKey: number | null }) {
  const load = useCallback(() => getCeoSeats(scope), [scope]);
  const query = useCeoQuery(load);
  const { quietRefresh } = query;
  const lastKey = useRef(refreshKey);
  useEffect(() => {
    const previous = lastKey.current;
    lastKey.current = refreshKey;
    if (previous != null && refreshKey != null && previous !== refreshKey) quietRefresh();
  }, [refreshKey, quietRefresh]);

  const words = periodWords(drill.period);
  const r = query.data;
  let body: ReactNode = null;
  if (r && !r.available) {
    body = <SectionEmpty title="Not available yet" message={r.message} />;
  } else if (r) {
    body =
      r.rooms.length || r.summary.seats > 0 ? (
        <SeatsContent report={r} period={drill.period} />
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
      title="Seats"
      subtitle={`Seat occupancy now and ${words}, revenue per seat and rent not earned`}
      note={r && !r.available ? undefined : SEAT_RULE_NOTE}
      loading={query.loading}
      empty={false}
      emptyMessage=""
    >
      {r?.available && query.error && !query.refreshing ? <StaleBanner error={query.error} what="The seat figures below are" /> : null}
      {body}
    </CeoSection>
  );
}

/** KPI tiles, the 12-month chart, seats by shift, by location / space type and the room sheet. */
export function SeatsContent({ report, period }: { report: CeoSeatReport; period: CeoPeriod }) {
  const s = report.summary;
  // The sheet's rooms stay while it slides away after closing.
  const [sheet, setSheet] = useState<SeatDrill | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (next: SeatDrill) => {
    setSheet(next);
    setSheetOpen(true);
  };

  const tiles: StatCardProps[] = seatTiles(s, period).map((t) => ({
    label: t.label,
    value: t.value,
    sub: t.sub,
    tone: t.tone,
    icon: t.icon,
    // Revenue per seat opens the rooms too: the sheet shows each room's sold a month and per seat (CP_02).
    ...((t.key === "empty" || t.key === "rent" || t.key === "revenue") && report.rooms.length
      ? { onPress: () => openSheet(EVERY_ROOM), accessibilityHint: OPENS_ROOMS_HINT }
      : {}),
  }));
  const trendText = seatTrendText(report.months);
  const locations = useMemo(() => seatGroupItems(report.byLocation, "location"), [report.byLocation]);
  const types = useMemo(() => seatGroupItems(report.bySpaceType, "spaceType"), [report.bySpaceType]);

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard
          title="Seats vs rooms, 12 months"
          caption="Seat and room occupancy at each month end (this month: now), of the rooms that existed then. Rooms look fuller than seats when offices are part let."
        >
          {report.months.length ? (
            <>
              <BarChart
                label="Seat occupancy and room occupancy by month"
                series={[{ label: "Seats" }, { label: "Rooms" }]}
                data={seatTrendData(report.months)}
                formatValue={pct}
                formatTick={(v) => `${Math.round(v)}%`}
                emptyText="No seats or rooms sold in these months."
              />
              {trendText ? (
                <AppText variant="caption" color="textSecondary" style={styles.gapTop}>
                  {trendText}
                </AppText>
              ) : null}
            </>
          ) : (
            <InlineEmpty text="No seat history yet." />
          )}
        </ChartCard>
        <ChartCard title="Seats sold now by shift" caption="Morning and Evening bookings share the same desks.">
          <FigureTable
            columns={[
              { label: "Shift", flex: 1.2 },
              { label: "Seats", align: "right" },
              { label: "Bookings", align: "right" },
            ]}
            rows={seatShiftRows(report.byShift)}
          />
          <AppText variant="caption" color="textSecondary" style={styles.gapTop}>
            {oneShiftText(s.oneShiftSeats)}
          </AppText>
        </ChartCard>
        <GroupCard kind="location" title="By location" items={locations} onOpen={openSheet} />
        <GroupCard kind="spaceType" title="By space type" items={types} onOpen={openSheet} />
      </ChartGrid>
      <SeatRoomsSheet drill={sheet} visible={sheetOpen} rooms={report.rooms} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const GROUP_TEXTS: Record<SeatGroupKind, { caption: string; label: string; hint: string; empty: string }> = {
  location: {
    caption: "Seats sold now. Tap a location to see its rooms.",
    label: "Seat occupancy by location",
    hint: "Lists this location's rooms, most rent not earned first",
    empty: "No locations with rooms.",
  },
  spaceType: {
    caption: "Seats sold now. Tap a space type to see its rooms.",
    label: "Seat occupancy by space type",
    hint: "Lists the rooms of this space type, most rent not earned first",
    empty: "No space types with rooms.",
  },
};

/** By location / by space type: one pressable row each (seat occupancy bar, sold of seats, rooms, rent not earned). */
function GroupCard({
  kind,
  title,
  items,
  onOpen,
}: {
  kind: SeatGroupKind;
  title: string;
  items: ReturnType<typeof seatGroupItems>;
  onOpen: (drill: SeatDrill) => void;
}) {
  const texts = GROUP_TEXTS[kind];
  return (
    <ChartCard title={title} caption={texts.caption}>
      {items.length ? (
        <HBarList
          label={texts.label}
          max={100}
          items={items.map((x) => x.item)}
          itemAccessibilityHint={texts.hint}
          onPressItem={(_item, i) => {
            const row = items[i];
            if (row) onOpen(seatDrillOf(row.group, kind));
          }}
        />
      ) : (
        <InlineEmpty text={texts.empty} />
      )}
    </ChartCard>
  );
}

const drillKey = (d: SeatDrill) =>
  d.kind === "location" ? `location-${d.locationId ?? "none"}` : d.kind === "spaceType" ? `type-${d.spaceTypeId ?? "none"}-${d.name}` : "all";

/** The drill-down: one location's / space type's rooms (or every room), most rent not earned first. */
export function SeatRoomsSheet({
  drill,
  visible,
  rooms,
  onClose,
}: {
  drill: SeatDrill | null;
  visible: boolean;
  rooms: readonly CeoSeatRoom[];
  onClose: () => void;
}) {
  const listed = useMemo(() => (drill ? seatDrillRooms(rooms, drill) : []), [rooms, drill]);
  return (
    <BottomSheet
      visible={visible && !!drill}
      onClose={onClose}
      overline={drill ? seatDrillOverline(drill) : undefined}
      title={drill?.name}
      subtitle={drill ? seatDrillSubtitle(listed) : undefined}
    >
      {/* Keyed by the group: "Show more" starts again for another location / space type. */}
      {drill ? <SeatRoomList key={drillKey(drill)} kind={drill.kind} rooms={listed} /> : null}
    </BottomSheet>
  );
}

function SeatRoomList({ kind, rooms }: { kind: SeatDrill["kind"]; rooms: readonly CeoSeatRoom[] }) {
  const [shown, setShown] = useState(SEATS_PAGE);
  const views = useMemo(() => rooms.slice(0, shown).map((room, i) => seatRoomView(room, kind, i)), [rooms, shown, kind]);
  const more = rooms.length - views.length;
  if (!rooms.length) {
    return <EmptyState compact icon="business-outline" title="No rooms" message="No rooms of this group are in the report." />;
  }
  return (
    <>
      <View style={styles.listHead}>
        <AppText variant="captionStrong" color="textSecondary">
          {seatTotalsText(rooms)}
        </AppText>
        <AppText variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          {roomsShownText(views.length, rooms.length)}
        </AppText>
      </View>
      {views.map((view, i) => (
        <Fragment key={view.key}>
          {i > 0 ? <Divider /> : null}
          <SeatRoomRow view={view} />
        </Fragment>
      ))}
      {more > 0 ? (
        <Button
          variant="outline"
          fullWidth
          leftIcon="chevron-down"
          title={`Show ${count(Math.min(more, SEATS_PAGE))} more`}
          accessibilityHint={`${count(more)} more rooms`}
          onPress={() => setShown((n) => n + SEATS_PAGE)}
        />
      ) : null}
    </>
  );
}

/** A room in the sheet: name, code / location / type, Full / Partly filled / Vacant now, its seat figures and shifts. */
export function SeatRoomRow({ view }: { view: SeatRoomView }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View accessible accessibilityLabel={view.accessibilityLabel} style={styles.room}>
      <View style={styles.head}>
        <View style={[styles.titleBlock, { flexBasis: scaledMinWidth(TITLE_MIN_WIDTH, fontScale) }]}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {view.title}
          </AppText>
          {view.subtitle ? (
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {view.subtitle}
            </AppText>
          ) : null}
        </View>
        <StatusPill label={view.status.label} tone={view.status.tone} style={styles.pill} />
      </View>
      <View style={styles.figures}>
        {view.figures.map((f) => (
          <View key={f.label} style={[styles.figure, { flexBasis: scaledMinWidth(FIGURE_MIN_WIDTH, fontScale) }]}>
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {f.label}
            </AppText>
            <AppText variant={f.tone ? "label" : "bodySmall"} color={(f.tone && TONE_TEXT[f.tone]) || "text"} style={styles.tabular}>
              {f.value}
            </AppText>
          </View>
        ))}
      </View>
      {view.shifts ? (
        <AppText variant="caption" color="textSecondary">
          {view.shifts}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: spacing.md },
  listHead: { gap: 2 },
  room: { gap: spacing.sm },
  // Title, then the pill on the same line when it fits, else on the next one (flexWrap), on the right.
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: spacing.md, rowGap: spacing.xs },
  titleBlock: { flexGrow: 1, flexShrink: 1, gap: 2 },
  pill: { marginLeft: "auto" },
  figures: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.sm },
  figure: { flexGrow: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
