import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  Card,
  Screen,
  SectionHeader,
  SegmentedControl,
  SelectField,
  greeting,
} from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { useReduceMotion } from "../../../hooks/useReduceMotion";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import {
  ceoErrorView,
  getCeoDashboard,
  getCeoForecast,
  isCompleteBreakdown,
  newBookingsRecords,
  overdueInvoicesRecords,
  PERIOD_OPTIONS,
  periodWords,
  recordsForCustomer,
  recordsForFunnelStage,
  type CeoLocation,
  type CeoPeriod,
  type CeoRecordsQuery,
  type CeoScope,
} from "../../../services/ceo";
import { spacing } from "../../../theme";
import { formatTime } from "../../../utils/format";
import { useRefreshColors } from "../Staff/shared/refresh";
import { CeoErrorState, CeoSection, ChartSkeleton, useCeoQuery } from "./parts";
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

type Nav = NativeStackNavigationProp<CeoStackParamList, "CeoDashboard">;

/**
 * The CEO dashboard (GET api/ceo/dashboard + GET api/dashboard/forecast): Money, Occupancy, Sales and Team for
 * this month / quarter / year against the previous period, for all locations or one, plus the 3-month outlook.
 * Read-only. Tapping a chart element or row drills down: a breakdown screen (by location / space type / month),
 * then a records list; some elements open their records directly. Pull to refresh reloads everything.
 */
export default function CeoDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const refreshColors = useRefreshColors();
  const reduceMotion = useReduceMotion();
  const { user } = useAuth();
  const [period, setPeriod] = useState<CeoPeriod>("month");
  const [locationId, setLocationId] = useState(0);
  /** The last location list the server sent (kept while a new answer loads). */
  const [knownLocations, setKnownLocations] = useState<CeoLocation[]>([]);

  const scope = useMemo<CeoScope>(() => ({ period, locationId: locationId || null }), [period, locationId]);

  const loadDashboard = useCallback(
    () =>
      getCeoDashboard(scope).then((d) => {
        if (d.locations.length) setKnownLocations(d.locations);
        return d;
      }),
    [scope],
  );
  const loadForecast = useCallback(() => getCeoForecast(scope.locationId), [scope.locationId]);
  const dashboard = useCeoQuery(loadDashboard);
  const forecast = useCeoQuery(loadForecast);
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
  const scopeLabel = [d?.periodLabel || PERIOD_OPTIONS.find((p) => p.value === period)?.label, locationId ? locationName ?? "One location" : "All locations"]
    .filter(Boolean)
    .join(" · ");

  const drill = useMemo<Drill>(
    () => ({
      period,
      breakdown: (t: BreakdownTarget, trail: string[]) => {
        const query = {
          ...t,
          period,
          // occupancy-location carries the tapped location; everything else the dashboard's filter.
          locationId: t.metric === "occupancy-location" ? t.locationId ?? null : scope.locationId ?? null,
        };
        if (isCompleteBreakdown(query)) navigation.navigate("CeoBreakdown", { query, trail, scopeLabel });
      },
      records: (query: CeoRecordsQuery | null, trail: string[], title?: string) => {
        if (query) navigation.navigate("CeoRecords", { query, trail, title, scopeLabel });
      },
      focus,
      target,
      overdueRecords: () => overdueInvoicesRecords(scope),
      newBookingsRecords: () => newBookingsRecords(scope),
      funnelRecords: (stage: string) => recordsForFunnelStage(stage, scope),
      customerRecords: (customerId: number | null) => recordsForCustomer(customerId, scope),
    }),
    [period, scope, navigation, scopeLabel, focus, target],
  );

  const refresh = () => {
    dashboard.refresh();
    forecast.refresh();
  };

  const firstName = (typeof user?.name === "string" ? user.name : "").trim().split(" ")[0];
  const words = periodWords(period);
  const loading = dashboard.loading;
  const failedWithoutData = !loading && !d && !!dashboard.error;
  const staleError = !!d && !!dashboard.error && !dashboard.refreshing;

  return (
    <Screen>
      <AppHeader
        variant="dashboard"
        overline="CEO"
        title={firstName ? `${greeting()}, ${firstName}` : "CEO dashboard"}
        actions={[{ icon: "person-circle-outline", accessibilityLabel: "Profile", onPress: () => navigation.navigate("CeoProfile") }]}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={dashboard.refreshing || forecast.refreshing} onRefresh={refresh} {...refreshColors} />}
      >
        <View ref={contentRef} collapsable={false} style={styles.stack}>
          <View style={styles.controls}>
            <SegmentedControl accessibilityLabel="Period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <SelectField
              value={locationId}
              options={[{ label: "All locations", value: 0 }, ...knownLocations.map((l) => ({ label: l.name, value: l.locationId }))]}
              onChange={setLocationId}
              loading={loading && !knownLocations.length}
              leftIcon="location-outline"
              accessibilityLabel="Location shown"
              sheetTitle="Show location"
            />
            {d ? (
              <AppText variant="caption" color="textMuted">
                {[scopeLabel, d.generatedAt ? `updated ${formatTime(d.generatedAt)}` : null].filter(Boolean).join(" · ")}
              </AppText>
            ) : null}
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

              <CeoSection
                title="Occupancy"
                subtitle="Spaces in use, new bookings and leases ending"
                loading={loading}
                empty={!d?.occupancy}
                emptyMessage="No occupancy figures were sent for this period."
              >
                {d?.occupancy ? <OccupancySection occupancy={d.occupancy} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Sales"
                subtitle={`Inquiries, quotations and bookings ${words}`}
                loading={loading}
                empty={!d?.sales}
                emptyMessage="No sales figures were sent for this period."
              >
                {d?.sales ? <SalesSection sales={d.sales} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Team"
                subtitle="Admins and sales executives per location"
                loading={loading}
                empty={!d?.team}
                emptyMessage="No team figures were sent for this period."
              >
                {d?.team ? <TeamSection team={d.team} drill={drill} /> : null}
              </CeoSection>
            </>
          )}

          <View style={styles.section}>
            <SectionHeader title="Outlook" subtitle="The next 3 months, from current leases" />
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
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  stack: { gap: spacing.xl },
  controls: { gap: spacing.md },
  section: { gap: spacing.sm },
});
