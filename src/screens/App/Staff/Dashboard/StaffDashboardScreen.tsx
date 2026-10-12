import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, SegmentedControl, SelectField, greeting } from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import { roleLabel } from "../../../../context/roles";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  getAccessOverview,
  getDashboardForecast,
  getDashboardOverview,
  getRoleDashboard,
  type DashboardForecast,
  type DashboardOverview,
  type DashboardPeriod,
  type RoleDashboard,
} from "../../../../services/staff";
import { spacing, useThemeColors } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { isAdminRole, useStaffSession } from "../shared/StaffSession";
import { Section } from "./parts";
import {
  DoorAccessSection,
  ForecastSection,
  LocationsSection,
  OverviewSection,
  SalesSection,
  StaffSection,
  SystemSection,
  TeamSection,
} from "./sections";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

type Slot<T> = { data: T | null; loading: boolean; error: string | null };
const initial = <T,>(): Slot<T> => ({ data: null, loading: true, error: null });

const PERIODS: { label: string; value: DashboardPeriod }[] = [
  { label: "Month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
];

/**
 * Staff dashboard, per role like the CMS dashboard:
 *   sales executive: sales section of GET dashboard/role (pipeline, inquiries & follow-ups, renewals,
 *                    collections) + forecast + door access card
 *   admin:           GET dashboard/overview + forecast + team & service (dashboard/role) + door access card
 *   super admin:     the admin dashboard + location comparison, staff overview and system health
 * Period (month / quarter / year) and location scope (one location or all the user may see) apply to every
 * section; the API limits admins and sales executives to their own locations.
 */
export default function StaffDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { role, profile, locations, locationsLoading, badgeTotal, refreshBadges } = useStaffSession();
  const isAdmin = isAdminRole(role);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [locationId, setLocationId] = useState(0);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [roleDash, setRoleDash] = useState<Slot<RoleDashboard>>(initial);
  const [overview, setOverview] = useState<Slot<DashboardOverview>>(initial);
  const [forecast, setForecast] = useState<Slot<DashboardForecast>>(initial);
  const [door, setDoor] = useState<Slot<Record<string, any>>>(initial);

  const locationIds = useMemo(() => (locationId ? [locationId] : []), [locationId]);

  // Per section: answers of an older period / location choice are ignored.
  const generations = useRef<Record<string, number>>({});
  const loadSlot = useCallback(
    <T,>(name: string, set: (s: Slot<T> | ((p: Slot<T>) => Slot<T>)) => void, fetch: () => Promise<T>) => {
      const gen = (generations.current[name] = (generations.current[name] ?? 0) + 1);
      const current = () => generations.current[name] === gen;
      set((prev) => ({ ...prev, loading: !prev.data, error: null }));
      return fetch()
        .then((data) => current() && set({ data, loading: false, error: null }))
        .catch(
          (err) =>
            current() && set((prev) => ({ data: prev.data, loading: false, error: errorMessage(err, "Could not load this section.") })),
        );
    },
    [],
  );

  const loadRole = useCallback(() => loadSlot("role", setRoleDash, () => getRoleDashboard({ period, locationIds })), [loadSlot, period, locationIds]);
  const loadOverview = useCallback(
    () => (isAdmin ? loadSlot("overview", setOverview, () => getDashboardOverview({ period, locationIds })) : Promise.resolve()),
    [loadSlot, isAdmin, period, locationIds],
  );
  const loadForecast = useCallback(() => loadSlot("forecast", setForecast, () => getDashboardForecast({ locationIds, months: 3 })), [loadSlot, locationIds]);
  const loadDoor = useCallback(() => loadSlot("door", setDoor, getAccessOverview), [loadSlot]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadRole(), loadOverview(), loadForecast(), loadDoor()]).finally(() => alive && setRefreshing(false));
    return () => {
      alive = false;
    };
  }, [loadRole, loadOverview, loadForecast, loadDoor, tick]);

  const refresh = () => {
    setRefreshing(true);
    refreshBadges();
    setTick((n) => n + 1);
  };

  const periodWord = `this ${period}`;
  const firstName = (profile?.name || (typeof user?.name === "string" ? user.name : "") || "").split(" ")[0];
  const showLocationPicker = role === "super_admin" || locations.length > 1;
  const allLabel = role === "super_admin" ? "All locations" : "All my locations";
  const r = roleDash.data;

  return (
    <StaffScreen>
      <AppHeader
        variant="dashboard"
        overline={roleLabel(role)}
        title={firstName ? `${greeting()}, ${firstName}` : "Dashboard"}
        actions={[
          {
            icon: "notifications-outline",
            accessibilityLabel: badgeTotal ? `Notifications, ${badgeTotal} waiting` : "Notifications",
            badge: badgeTotal,
            onPress: () => navigation.navigate("StaffNotifications"),
          },
          { icon: "person-circle-outline", accessibilityLabel: "Profile", onPress: () => navigation.navigate("StaffProfile") },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.controls}>
          <SegmentedControl accessibilityLabel="Period" options={PERIODS} value={period} onChange={setPeriod} />
          {showLocationPicker ? (
            <SelectField
              value={locationId}
              options={[{ label: allLabel, value: 0 }, ...locations.map((l) => ({ label: l.name, value: l.id }))]}
              onChange={setLocationId}
              loading={locationsLoading}
              leftIcon="location-outline"
              accessibilityLabel="Locations shown"
              sheetTitle="Show locations"
            />
          ) : null}
        </View>

        {role === "sales_executive" ? (
          <Section title="My sales" subtitle={`Quotations, inquiries and collections ${periodWord}`} loading={roleDash.loading} error={roleDash.error} onRetry={loadRole}>
            {r?.sales ? <SalesSection sales={r.sales} periodWord={periodWord} /> : null}
          </Section>
        ) : (
          <Section title="Overview" subtitle={`Occupancy, bookings and money ${periodWord}`} loading={overview.loading} error={overview.error} onRetry={loadOverview}>
            {overview.data ? <OverviewSection data={overview.data} periodWord={periodWord} /> : null}
          </Section>
        )}

        <Section title="Next 3 months" subtitle="Expected rent and occupancy from current leases" loading={forecast.loading} error={forecast.error} onRetry={loadForecast} skeleton="card">
          {forecast.data ? <ForecastSection forecast={forecast.data} /> : null}
        </Section>

        {isAdmin ? (
          <Section title="Team & service" loading={roleDash.loading} error={roleDash.error} onRetry={loadRole}>
            {r?.team ? <TeamSection team={r.team} /> : null}
          </Section>
        ) : null}

        <Section title="Door access" subtitle="Machines and bookings locked for unpaid challans" loading={door.loading} error={door.error} onRetry={loadDoor}>
          {door.data ? <DoorAccessSection overview={door.data} /> : null}
        </Section>

        {role === "super_admin" ? (
          <>
            <Section title="Locations" subtitle={`Compared ${periodWord}`} loading={roleDash.loading} error={roleDash.error} onRetry={loadRole} skeleton="card">
              {r?.locations ? <LocationsSection locations={r.locations} periodWord={periodWord} /> : null}
            </Section>
            <Section title="Staff" subtitle={`Quotations and conversions ${periodWord}`} loading={roleDash.loading} error={roleDash.error} onRetry={loadRole} skeleton="card">
              {r?.staff ? <StaffSection staff={r.staff} /> : null}
            </Section>
            <Section title="System health" loading={roleDash.loading} error={roleDash.error} onRetry={loadRole} skeleton="card">
              {r?.system ? <SystemSection system={r.system} /> : null}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: spacing.xxxl },
  controls: { gap: spacing.md },
});
