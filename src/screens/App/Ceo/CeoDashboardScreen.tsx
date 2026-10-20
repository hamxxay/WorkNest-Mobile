import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Banner, Card, Screen, SectionHeader, SelectField, greeting } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { useReduceMotion } from "../../../hooks/useReduceMotion";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import {
  ceoErrorView,
  getCeoDashboard,
  getCeoForecast,
  getCeoRooms,
  inquiriesCountAllLocations,
  isCompleteBreakdown,
  leasesExpiringRecords,
  newBookingsRecords,
  overdueInvoicesRecords,
  PERIOD_OPTIONS,
  periodWords,
  rangeLabel,
  recordsForCustomer,
  recordsForFunnelStage,
  updatedAgo,
  type CeoDrillTarget,
  type CeoLocation,
  type CeoPeriod,
  type CeoRecordsQuery,
  type CeoScope,
  type DashRange,
} from "../../../services/ceo";
import { spacing } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { useRefreshColors } from "../Staff/shared/refresh";
import { CeoErrorState, CeoSection, ChartSkeleton, ScopeLine, useCeoQuery } from "./parts";
import { PeriodControl } from "./PeriodControl";
import { RoomsBlock } from "./RoomsSection";
import { DiscountsBlock } from "./DiscountsSection";
import { SeatsBlock } from "./SeatsSection";
import { useAutoRefresh } from "./useAutoRefresh";
import {
  MoneySection,
  OccupancySection,
  OutlookSection,
  SalesSection,
  TeamSection,
  type BreakdownTarget,
  type Drill,
  type FocusTarget,
} from "./sections";
import { MAX_CONTENT_WIDTH } from "../../../utils/responsive";

/** Shown on the Sales section while one location is chosen and the server still counts every location's inquiries. */
const INQUIRIES_ALL_LOCATIONS_NOTE = "Tour inquiries count every location until database update QA_07 is run";

type Nav = NativeStackNavigationProp<CeoStackParamList, "CeoDashboard">;

/**
 * The CEO dashboard (GET api/ceo/dashboard + GET api/dashboard/forecast + GET api/ceo/rooms): Money, Occupancy, Sales
 * and Team for this month / quarter / year or a custom date range (against the same number of days just before it),
 * for all locations or one, the 3-month outlook and the Rooms report (occupancy and the price each room was sold at
 * against its list / shift price).
 * Read-only. Tapping a KPI card, a chart element or a row drills down: a breakdown screen (by location / space type /
 * month) or a list built from the dashboard (the period's months, aging buckets, locations), then a records list;
 * some open their records directly; every drill-down uses the dashboard's period and range. Pull to refresh reloads
 * everything; it also reloads quietly every 5 minutes while on screen (./useAutoRefresh.ts).
 */
export default function CeoDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const refreshColors = useRefreshColors();
  const reduceMotion = useReduceMotion();
  const { greetingName: firstName, roleDisplayLabel } = useAuth();
  const [period, setPeriod] = useState<CeoPeriod>("month");
  /** The custom range (kept while a calendar period is chosen, so Custom opens with it again). */
  const [range, setRange] = useState<DashRange | null>(null);
  /** The date range editor is open: the auto refresh waits. */
  const [editingRange, setEditingRange] = useState(false);
  const [locationId, setLocationId] = useState(0);
  /** The last location list the server sent (kept while a new answer loads). */
  const [knownLocations, setKnownLocations] = useState<CeoLocation[]>([]);

  // A calendar period carries no range, so its requests stay exactly as before.
  const scope = useMemo<CeoScope>(
    () => (period === "custom" && range ? { period, locationId: locationId || null, range } : { period, locationId: locationId || null }),
    [period, locationId, range],
  );
  const choosePeriod = useCallback((next: CeoPeriod, nextRange: DashRange | null) => {
    setRange(nextRange);
    setPeriod(next);
  }, []);

  const loadDashboard = useCallback(
    () =>
      getCeoDashboard(scope).then((d) => {
        if (d.locations.length) setKnownLocations(d.locations);
        return d;
      }),
    [scope],
  );
  const loadForecast = useCallback(() => getCeoForecast(scope.locationId), [scope.locationId]);
  const loadRooms = useCallback(() => getCeoRooms(scope.period, scope.locationId, scope.range), [scope]);
  const dashboard = useCeoQuery(loadDashboard);
  const forecast = useCeoQuery(loadForecast);
  const rooms = useCeoQuery(loadRooms);
  const d = dashboard.data;

  // ─── Scroll targets for the KPI cards ("Outstanding" -> aging chart, "Occupancy" -> by location) ─────────
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const targets = useRef<Partial<Record<FocusTarget, View | null>>>({});
  const targetRefs = useRef<Partial<Record<FocusTarget, (node: View | null) => void>>>({});
  const target = useCallback((name: FocusTarget) => {
    targetRefs.current[name] ??= (node: View | null) => {
      targets.current[name] = node;
    };
    return targetRefs.current[name]!;
  }, []);
  const focus = useCallback(
    (name: FocusTarget) => {
      const node = targets.current[name];
      const content = contentRef.current;
      if (!node || !content) return;
      // y is relative to the content column, which sits below the scroll view's top padding (spacing.screen).
      node.measureLayout(content, (_x, y) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y + spacing.screen - spacing.md), animated: !reduceMotion }),
      );
    },
    [reduceMotion],
  );

  // ─── Drill-down ──────────────────────────────────────────────────────────────────────────────────────────
  const locationName = knownLocations.find((l) => l.locationId === locationId)?.name;
  const locationLabel = locationId ? locationName ?? "One location" : "All locations";
  const periodText = d?.periodLabel || (scope.range ? rangeLabel(scope.range) : PERIOD_OPTIONS.find((p) => p.value === period)?.label);
  const scopeLabel = [periodText, locationLabel].filter(Boolean).join(" · ");

  const drill = useMemo<Drill>(
    () => ({
      period,
      range: scope.range ?? null,
      locationId: scope.locationId ?? null,
      breakdown: (t: BreakdownTarget, trail: string[]) => {
        const query = {
          ...t,
          period,
          // A custom period: every drill-down asks for the same range.
          ...(scope.range ? { range: scope.range } : {}),
          // occupancy-location carries the tapped location; everything else the dashboard's filter.
          locationId: t.metric === "occupancy-location" ? t.locationId ?? null : scope.locationId ?? null,
        };
        if (isCompleteBreakdown(query)) navigation.navigate("CeoBreakdown", { query, trail, scopeLabel });
      },
      records: (query: CeoRecordsQuery | null, trail: string[], title?: string) => {
        // Leases ending in the next 90 days are not bound to the period: name only the location.
        if (query) navigation.navigate("CeoRecords", { query, trail, title, scopeLabel: query.kind === "leases" ? locationLabel : scopeLabel });
      },
      open: (t: CeoDrillTarget, trail: string[]) => {
        if (t.kind === "list") navigation.navigate("CeoList", { list: t.list, trail, scopeLabel });
        else if (t.kind === "breakdown") {
          if (isCompleteBreakdown(t.query)) navigation.navigate("CeoBreakdown", { query: t.query, recordsParams: t.recordsParams, trail, scopeLabel });
        } else {
          const timeless = t.timeless || t.query.kind === "leases";
          navigation.navigate("CeoRecords", { query: t.query, title: t.title, keepTitle: t.keepTitle, trail, scopeLabel: timeless ? locationLabel : scopeLabel });
        }
      },
      focus,
      target,
      overdueRecords: () => overdueInvoicesRecords(scope),
      newBookingsRecords: () => newBookingsRecords(scope),
      funnelRecords: (stage: string) => recordsForFunnelStage(stage, scope),
      customerRecords: (customerId: number | null) => recordsForCustomer(customerId, scope),
      leasesRecords: () => leasesExpiringRecords(scope),
    }),
    [period, scope, navigation, scopeLabel, locationLabel, focus, target],
  );

  const refresh = () => {
    dashboard.refresh();
    forecast.refresh();
    rooms.refresh();
  };

  // Every 5 minutes while on screen and in the foreground, quietly: the figures stay until the new ones arrive.
  const { quietRefresh: quietDashboard } = dashboard;
  const { quietRefresh: quietForecast } = forecast;
  const { quietRefresh: quietRooms } = rooms;
  const quietRefresh = useCallback(() => {
    quietDashboard();
    quietForecast();
    quietRooms();
  }, [quietDashboard, quietForecast, quietRooms]);
  const now = useAutoRefresh({
    run: quietRefresh,
    loadedAt: dashboard.loadedAt,
    paused: editingRange || dashboard.loading || dashboard.refreshing || forecast.refreshing || rooms.refreshing,
  });

  const words = periodWords(period);
  const loading = dashboard.loading;
  const failedWithoutData = !loading && !d && !!dashboard.error;
  const staleError = !!d && !!dashboard.error && !dashboard.refreshing;

  return (
    <Screen width="wide">
      <AppHeader
        variant="dashboard"
        overline={roleDisplayLabel}
        title={firstName ? `${greeting()}, ${firstName}` : "CEO dashboard"}
        subtitle={formatDate(now, { weekday: true, year: false })}
        actions={[{ icon: "person-circle-outline", accessibilityLabel: "Profile", onPress: () => navigation.navigate("CeoProfile") }]}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={dashboard.refreshing || forecast.refreshing || rooms.refreshing} onRefresh={refresh} {...refreshColors} />}
      >
        <View ref={contentRef} collapsable={false} style={styles.stack}>
          <View style={styles.controls}>
            <PeriodControl period={period} range={range} onChange={choosePeriod} onEditingChange={setEditingRange} />
            <SelectField
              value={locationId}
              options={[{ label: "All locations", value: 0 }, ...knownLocations.map((l) => ({ label: l.name, value: l.locationId }))]}
              onChange={setLocationId}
              loading={loading && !knownLocations.length}
              leftIcon="location-outline"
              accessibilityLabel="Location shown"
              sheetTitle="Show location"
            />
            {/* The location is in the picker above: the line names the period and when the figures arrived. */}
            <ScopeLine text={d ? periodText : undefined} updated={d ? updatedAgo(dashboard.loadedAt, now) : ""} loading={loading} stale={staleError} />
          </View>

          {staleError ? (
            <Banner tone="warning" title={ceoErrorView(dashboard.error).title} message={`${ceoErrorView(dashboard.error).message} The figures below are from the last update.`} />
          ) : null}

          {failedWithoutData ? (
            <CeoErrorState error={dashboard.error} onRetry={dashboard.reload} />
          ) : (
            <>
              <CeoSection
                title="Money"
                subtitle={`Invoiced and collected ${words}, receivables and top customers`}
                loading={loading}
                empty={!d?.money}
                emptyMessage="No invoice figures were sent for this period."
              >
                {d?.money ? <MoneySection money={d.money} drill={drill} /> : null}
              </CeoSection>

              <DiscountsBlock scope={scope} reloadKey={dashboard.loadedAt} />

              <CeoSection
                title="Occupancy"
                subtitle={`Spaces in use now, new bookings ${words} and leases ending`}
                loading={loading}
                empty={!d?.occupancy}
                emptyMessage="No occupancy figures were sent for this period."
              >
                {d?.occupancy ? <OccupancySection occupancy={d.occupancy} drill={drill} /> : null}
              </CeoSection>
              <SeatsBlock scope={scope} drill={drill} refreshKey={dashboard.loadedAt} />

              <CeoSection
                title="Sales"
                subtitle={`Inquiries, quotations and bookings ${words}`}
                note={d?.sales && inquiriesCountAllLocations(d.sales, scope.locationId) ? INQUIRIES_ALL_LOCATIONS_NOTE : undefined}
                loading={loading}
                empty={!d?.sales}
                emptyMessage="No sales figures were sent for this period."
              >
                {d?.sales ? <SalesSection sales={d.sales} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Team"
                subtitle={`Sales executives and their revenue ${words}`}
                loading={loading}
                empty={!d?.team}
                emptyMessage="No team figures were sent for this period."
              >
                {d?.team ? <TeamSection team={d.team} drill={drill} /> : null}
              </CeoSection>
            </>
          )}

          <View style={styles.section}>
            <SectionHeader variant="section" title="Outlook" subtitle="The next 3 months, from current leases" />
            {forecast.loading ? (
              <ChartSkeleton height={130} />
            ) : forecast.data ? (
              <OutlookSection forecast={forecast.data} />
            ) : forecast.error ? (
              <Card>
                <CeoErrorState compact error={forecast.error} onRetry={forecast.reload} />
              </Card>
            ) : null}
          </View>

          {/* Last: it ends in the room list. Loaded on its own (GET api/ceo/rooms): an error stays in this section. */}
          <RoomsBlock query={rooms} drill={drill} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  // Sections breathe apart (32); inside a section the heading, tiles and cards sit 12 apart.
  stack: { gap: spacing.xxl },
  // The period / location pickers keep a form width on a wide dashboard instead of stretching across it.
  controls: { gap: spacing.md, width: "100%", maxWidth: MAX_CONTENT_WIDTH },
  section: { gap: spacing.md },
});
