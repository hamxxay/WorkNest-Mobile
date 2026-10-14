import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, Screen, SegmentedControl, SelectField, StatusPill, greeting } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { useReduceMotion } from "../../../hooks/useReduceMotion";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { PERIOD_OPTIONS, periodWords, type CeoPeriod } from "../../../services/ceo";
import {
  getSalesManagerDashboard,
  isCompleteSmBreakdown,
  salesManagerErrorView,
  type SmLocation,
  type SmRecordsQuery,
  type SmScope,
} from "../../../services/salesManager";
import { spacing, useThemeColors } from "../../../theme";
import { formatTime } from "../../../utils/format";
import { CeoErrorState, CeoSection, StaleBanner, useCeoQuery } from "../Ceo/parts";
import { useRefreshColors } from "../Staff/shared/refresh";
import {
  FunnelSection,
  InquiriesSection,
  RenewalsSection,
  TeamSection,
  type SmBreakdownTarget,
  type SmDrill,
  type SmFocusTarget,
} from "./sections";

type Nav = NativeStackNavigationProp<SalesManagerStackParamList, "SalesManagerDashboard">;

const ALL_MY_LOCATIONS = "All my locations";

/**
 * The Sales Manager dashboard (GET api/sales-manager/dashboard): Sales funnel, Team performance, Tour inquiries and
 * Renewals & revenue for this month / quarter / year against the previous period, for all the manager's locations
 * or one of them (tour inquiries always cover every branch). View only: tapping a chart element or row drills down
 * (a breakdown screen, then a records list; some open their records directly). Pull to refresh reloads it.
 */
export default function SalesManagerDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const refreshColors = useRefreshColors();
  const reduceMotion = useReduceMotion();
  const colors = useThemeColors();
  const { greetingName, roleDisplayLabel } = useAuth();
  const [period, setPeriod] = useState<CeoPeriod>("month");
  const [locationId, setLocationId] = useState(0);
  /** The last location list the server sent (kept while a new answer loads). */
  const [knownLocations, setKnownLocations] = useState<SmLocation[]>([]);

  const scope = useMemo<SmScope>(() => ({ period, locationId: locationId || null }), [period, locationId]);

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
  const locationName = knownLocations.find((l) => l.locationId === locationId)?.name;
  const periodText = d?.periodLabel || PERIOD_OPTIONS.find((p) => p.value === period)?.label;
  const scopeLabel = [periodText, locationId ? locationName ?? "One location" : ALL_MY_LOCATIONS].filter(Boolean).join(" · ");

  const drill = useMemo<SmDrill>(
    () => ({
      scope,
      breakdown: (t: SmBreakdownTarget, trail: string[]) => {
        const query = { ...t, period, locationId: scope.locationId ?? null };
        // Inquiries cover every branch: say so instead of naming the location filter.
        const label = t.metric === "inquiries-type" ? [periodText, "All branches"].filter(Boolean).join(" · ") : scopeLabel;
        if (isCompleteSmBreakdown(query)) navigation.navigate("SalesManagerBreakdown", { query, trail, scopeLabel: label });
      },
      records: (query: SmRecordsQuery | null, trail: string[], title?: string) => {
        if (!query) return;
        const label = query.kind === "inquiries" ? [periodText, "All branches"].filter(Boolean).join(" · ") : scopeLabel;
        navigation.navigate("SalesManagerRecords", { query, trail, title, scopeLabel: label });
      },
      focus,
      target,
    }),
    [scope, period, navigation, scopeLabel, periodText, focus, target],
  );

  const words = periodWords(period);
  const loading = dashboard.loading;
  const failedWithoutData = !loading && !d && !!dashboard.error;
  const staleError = !!d && !!dashboard.error && !dashboard.refreshing;
  // One location: nothing to pick (the scope line names it).
  const showLocationPicker = knownLocations.length !== 1;
  const openProfile = () => navigation.navigate("SalesManagerProfile", { locations: knownLocations.map((l) => l.name) });

  return (
    <Screen>
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
        refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} {...refreshColors} />}
      >
        <View ref={contentRef} collapsable={false} style={styles.stack}>
          <View style={styles.controls}>
            <View style={styles.badgeRow}>
              <StatusPill label="View only" tone="neutral" icon="eye-outline" />
              <View style={styles.note} accessible accessibilityLabel="Note: tour inquiries include all branches.">
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <AppText variant="caption" color="textMuted" style={styles.flexShrink}>
                  Tour inquiries include all branches
                </AppText>
              </View>
            </View>
            <SegmentedControl accessibilityLabel="Period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            {showLocationPicker ? (
              <SelectField
                value={locationId}
                options={[{ label: ALL_MY_LOCATIONS, value: 0 }, ...knownLocations.map((l) => ({ label: l.name, value: l.locationId }))]}
                onChange={setLocationId}
                loading={loading && !knownLocations.length}
                leftIcon="location-outline"
                accessibilityLabel="Location shown"
                sheetTitle="Show location"
              />
            ) : null}
            {d ? (
              <AppText variant="caption" color="textMuted">
                {[showLocationPicker ? scopeLabel : [periodText, knownLocations[0]?.name].filter(Boolean).join(" · "), d.generatedAt ? `updated ${formatTime(d.generatedAt)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
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
                subtitle={`Inquiries, quotations and bookings ${words}`}
                loading={loading}
                empty={!d?.funnel}
                emptyMessage="No sales figures were sent for this period."
              >
                {d?.funnel ? <FunnelSection funnel={d.funnel} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Team performance"
                subtitle="Sales executives and admins at your locations"
                loading={loading}
                empty={!d?.team}
                emptyMessage="No team figures were sent for this period."
              >
                {d?.team ? <TeamSection team={d.team} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Tour inquiries"
                subtitle={`Every branch, ${words}`}
                loading={loading}
                empty={!d?.inquiries}
                emptyMessage="No tour inquiry figures were sent for this period."
              >
                {d?.inquiries ? <InquiriesSection inquiries={d.inquiries} drill={drill} /> : null}
              </CeoSection>

              <CeoSection
                title="Renewals & revenue"
                subtitle="Leases ending soon and revenue from new bookings"
                loading={loading}
                empty={!d?.renewals}
                emptyMessage="No renewal or revenue figures were sent for this period."
              >
                {d?.renewals ? <RenewalsSection renewals={d.renewals} drill={drill} /> : null}
              </CeoSection>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  stack: { gap: spacing.xl },
  controls: { gap: spacing.md },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  note: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  flexShrink: { flexShrink: 1 },
});
