import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, Screen, SelectField, StatusPill, greeting } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { useReduceMotion } from "../../../hooks/useReduceMotion";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { PERIOD_OPTIONS, periodWords, rangeLabel, updatedAgo, type CeoPeriod, type DashRange } from "../../../services/ceo";
import {
  SM_ALL_MY_LOCATIONS,
  getSalesManagerComplaints,
  getSalesManagerDashboard,
  isCompleteSmBreakdown,
  isPeriodFreeList,
  salesManagerErrorView,
  smLocationText,
  smScopeNotes,
  type SmLocation,
  type SmRecordsQuery,
  type SmScope,
} from "../../../services/salesManager";
import { spacing } from "../../../theme";
import { CeoErrorState, CeoSection, StaleBanner, useCeoQuery } from "../Ceo/parts";
import { PeriodControl } from "../Ceo/PeriodControl";
import { useAutoRefresh } from "../Ceo/useAutoRefresh";
import { useRefreshColors } from "../Staff/shared/refresh";
import { ComplaintsBlock } from "./ComplaintsSection";
import {
  FunnelSection,
  InquiriesSection,
  RenewalsSection,
  TeamSection,
  type SmBreakdownTarget,
  type SmDrill,
  type SmFocusTarget,
} from "./sections";
import { MAX_CONTENT_WIDTH } from "../../../utils/responsive";

type Nav = NativeStackNavigationProp<SalesManagerStackParamList, "SalesManagerDashboard">;

/**
 * The Sales Manager dashboard (GET api/sales-manager/dashboard): Sales funnel, Team performance, Tour inquiries and
 * Renewals & desks for this month / quarter / year or a custom date range (against the same number of days just before
 * it), for all the manager's locations or one of them (tour inquiries too: those without a branch count under "All my
 * locations", as complaints do; a manager with one location has no picker, and the notes and drill screens say the
 * items without a branch are included instead).
 * Desks, never money ("91 desks booked"). Last comes Complaints, loaded on its own (GET api/sales-manager/complaints,
 * same period and location), so the rest keeps working when only that call fails. View only: tapping a chart element
 * or row drills down (a breakdown screen, then a records list; some open their records directly), with the same
 * period and range. Pull to refresh reloads both; they also reload quietly every 5 minutes while on screen.
 */
export default function SalesManagerDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const refreshColors = useRefreshColors();
  const reduceMotion = useReduceMotion();
  const { greetingName, roleDisplayLabel } = useAuth();
  const [period, setPeriod] = useState<CeoPeriod>("month");
  /** The custom range (kept while a calendar period is chosen, so Custom opens with it again). */
  const [range, setRange] = useState<DashRange | null>(null);
  /** The date range editor is open: the auto refresh waits. */
  const [editingRange, setEditingRange] = useState(false);
  const [locationId, setLocationId] = useState(0);
  /** The last location list the server sent (kept while a new answer loads). */
  const [knownLocations, setKnownLocations] = useState<SmLocation[]>([]);

  // A calendar period carries no range, so its requests stay exactly as before.
  const scope = useMemo<SmScope>(
    () => (period === "custom" && range ? { period, locationId: locationId || null, range } : { period, locationId: locationId || null }),
    [period, locationId, range],
  );
  const choosePeriod = useCallback((next: CeoPeriod, nextRange: DashRange | null) => {
    setRange(nextRange);
    setPeriod(next);
  }, []);

  const load = useCallback(
    () =>
      getSalesManagerDashboard(scope).then((d) => {
        if (d.locations.length) setKnownLocations(d.locations);
        return d;
      }),
    [scope],
  );
  const dashboard = useCeoQuery(load);
  const d = dashboard.data;
  const loadComplaints = useCallback(() => getSalesManagerComplaints(scope), [scope]);
  const complaints = useCeoQuery(loadComplaints);
  const { refresh: refreshDashboard } = dashboard;
  const { refresh: refreshComplaints } = complaints;
  const refreshAll = useCallback(() => {
    refreshDashboard();
    refreshComplaints();
  }, [refreshDashboard, refreshComplaints]);

  // Every 5 minutes while on screen and in the foreground, quietly: the figures stay until the new ones arrive.
  const { quietRefresh: quietDashboard } = dashboard;
  const { quietRefresh: quietComplaints } = complaints;
  const quietRefresh = useCallback(() => {
    quietDashboard();
    quietComplaints();
  }, [quietDashboard, quietComplaints]);
  const now = useAutoRefresh({
    run: quietRefresh,
    loadedAt: dashboard.loadedAt,
    paused: editingRange || dashboard.loading || dashboard.refreshing || complaints.refreshing,
  });

  // ─── Scroll targets for the KPI cards ──────────────────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const targets = useRef<Partial<Record<SmFocusTarget, View | null>>>({});
  const targetRefs = useRef<Partial<Record<SmFocusTarget, (node: View | null) => void>>>({});
  const target = useCallback((name: SmFocusTarget) => {
    targetRefs.current[name] ??= (node: View | null) => {
      targets.current[name] = node;
    };
    return targetRefs.current[name]!;
  }, []);
  const focus = useCallback(
    (name: SmFocusTarget) => {
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
  const periodText = d?.periodLabel || (scope.range ? rangeLabel(scope.range) : PERIOD_OPTIONS.find((p) => p.value === period)?.label);
  // "I-8", "All my locations"; tour inquiry and complaint lists add "(plus items without a branch)" when no single
  // location is chosen (the API includes those then).
  const locationTextFor = useCallback(
    (kind?: SmRecordsQuery["kind"] | "inquiries-type" | null, narrowedToBranch = false) =>
      smLocationText({ locations: knownLocations, locationId, kind, narrowedToBranch }),
    [knownLocations, locationId],
  );
  const scopeLabelFor = useCallback(
    (kind?: SmRecordsQuery["kind"] | "inquiries-type" | null, narrowedToBranch = false, withPeriod = true) =>
      [withPeriod ? periodText : null, locationTextFor(kind, narrowedToBranch)].filter(Boolean).join(" · "),
    [periodText, locationTextFor],
  );
  const scopeLabel = scopeLabelFor();

  const drill = useMemo<SmDrill>(
    () => ({
      scope,
      breakdown: (t: SmBreakdownTarget, trail: string[]) => {
        // A custom period: every drill-down asks for the same range.
        const query = { ...t, period, ...(scope.range ? { range: scope.range } : {}), locationId: scope.locationId ?? null };
        const label = scopeLabelFor(query.metric === "inquiries-type" ? "inquiries-type" : null);
        if (isCompleteSmBreakdown(query)) navigation.navigate("SalesManagerBreakdown", { query, trail, scopeLabel: label });
      },
      records: (query: SmRecordsQuery | null, trail: string[], title?: string) => {
        if (!query) return;
        // Complaints as they are now (open, in progress...), a branch's complaints and the leases ending soon are not
        // bound to the period: name only the location.
        const label = scopeLabelFor(query.kind, query.params.branch != null, !isPeriodFreeList(query));
        navigation.navigate("SalesManagerRecords", { query, trail, title, scopeLabel: label });
      },
      focus,
      target,
    }),
    [scope, period, navigation, scopeLabelFor, focus, target],
  );

  const words = periodWords(period);
  const loading = dashboard.loading;
  const failedWithoutData = !loading && !d && !!dashboard.error;
  const staleError = !!d && !!dashboard.error && !dashboard.refreshing;
  // One location: nothing to pick (the scope line names it).
  const showLocationPicker = knownLocations.length !== 1;
  const notes = smScopeNotes({ singleLocation: !showLocationPicker, inquiriesAllBranches: !!d?.inquiriesAllBranches });
  const openProfile = () => navigation.navigate("SalesManagerProfile", { locations: knownLocations.map((l) => l.name) });

  return (
    <Screen width="wide">
      <AppHeader
        variant="dashboard"
        overline={roleDisplayLabel}
        title={greetingName ? `${greeting()}, ${greetingName}` : "Sales dashboard"}
        subtitle={greetingName ? "Sales dashboard" : undefined}
        actions={[{ icon: "person-circle-outline", accessibilityLabel: "Profile", onPress: openProfile }]}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={dashboard.refreshing || complaints.refreshing} onRefresh={refreshAll} {...refreshColors} />}
      >
        <View ref={contentRef} collapsable={false} style={styles.stack}>
          <View style={styles.controls}>
            <View style={styles.badgeRow}>
              <StatusPill label="View only" tone="neutral" icon="eye-outline" />
            </View>
            <PeriodControl period={period} range={range} onChange={choosePeriod} onEditingChange={setEditingRange} />
            {showLocationPicker ? (
              <SelectField
                value={locationId}
                options={[{ label: SM_ALL_MY_LOCATIONS, value: 0 }, ...knownLocations.map((l) => ({ label: l.name, value: l.locationId }))]}
                onChange={setLocationId}
                loading={loading && !knownLocations.length}
                leftIcon="location-outline"
                accessibilityLabel="Location shown"
                sheetTitle="Show location"
              />
            ) : null}
            {d ? (
              <AppText variant="caption" color="textMuted">
                {[scopeLabel, updatedAgo(dashboard.loadedAt, now)].filter(Boolean).join(" · ")}
              </AppText>
            ) : null}
          </View>

          {staleError ? <StaleBanner error={dashboard.error} describe={salesManagerErrorView} /> : null}

          {failedWithoutData ? (
            <CeoErrorState error={dashboard.error} onRetry={dashboard.reload} describe={salesManagerErrorView} />
          ) : (
            <>
              <CeoSection
                title="Sales funnel"
                subtitle={`Inquiries, quotations, bookings and desks ${words}`}
                loading={loading}
                empty={!d?.funnel}
                emptyMessage="No sales figures were sent for this period."
              >
                {d?.funnel ? <FunnelSection funnel={d.funnel} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Team performance"
                subtitle="The sales executives at your locations"
                loading={loading}
                empty={!d?.team}
                emptyMessage="No team figures were sent for this period."
              >
                {d?.team ? <TeamSection team={d.team} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Tour inquiries"
                subtitle={[d?.inquiriesAllBranches ? "Tour inquiries at every branch" : "Tour inquiries at your locations", periodText]
                  .filter(Boolean)
                  .join(" · ")}
                note={notes.inquiries}
                loading={loading}
                empty={!d?.inquiries}
                emptyMessage="No tour inquiry figures were sent for this period."
              >
                {d?.inquiries ? <InquiriesSection inquiries={d.inquiries} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Renewals & desks"
                subtitle="Leases ending soon, desks booked and desks ending"
                loading={loading}
                empty={!d?.renewals}
                emptyMessage="No renewal or desk figures were sent for this period."
              >
                {d?.renewals ? <RenewalsSection renewals={d.renewals} drill={drill} /> : null}
              </CeoSection>
            </>
          )}

          {/* Own call: shown (with its own error state) whether or not the rest of the dashboard loaded. */}
          <ComplaintsBlock
            query={complaints}
            drill={drill}
            periodLabel={periodText}
            oneLocation={!!locationId || knownLocations.length === 1}
            scopeNote={notes.complaints}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  stack: { gap: spacing.xl },
  // The period / location pickers keep a form width on a wide dashboard instead of stretching across it.
  controls: { gap: spacing.md, width: "100%", maxWidth: MAX_CONTENT_WIDTH },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
});
