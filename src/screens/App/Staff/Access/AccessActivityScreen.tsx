import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppHeader,
  AppText,
  AsyncList,
  Card,
  FilterChips,
  SegmentedControl,
  SelectField,
  StatusPill,
} from "../../../../components/ui";
import {
  ACCESS_EVENTS_LIMIT,
  accessEventsCapNote,
  accessPeriodRange,
  getAccessDevices,
  getAccessEvents,
  getAccessSyncActivity,
  type AccessDevice,
  type AccessEvent,
  type AccessPeriod,
  type AccessSyncActivity,
} from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { formatDate, formatDateTime, formatTime } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Period = AccessPeriod;
type Result = "all" | "granted" | "denied";

const METHOD_ICONS: Record<string, string> = {
  fingerprint: "finger-print-outline",
  face: "scan-outline",
  card: "card-outline",
  door: "enter-outline",
  remote: "phone-portrait-outline",
};

/**
 * Access activity log (admin / super admin, like the CMS): door events from the machines
 * (GET hik/access/events?from=&to=&deviceId=&limit=, location-scoped by the API) with period, door, result and
 * name filters, and the machine sync log (GET hik/access/activity).
 */
export default function AccessActivityScreen() {
  const [view, setView] = useState<"events" | "system">("events");
  return (
    <StaffScreen>
      <AppHeader title="Access activity log" />
      <View style={styles.segment}>
        <SegmentedControl
          accessibilityLabel="Log"
          options={[
            { label: "Door events", value: "events" },
            { label: "System log", value: "system" },
          ]}
          value={view}
          onChange={(v) => setView(v as "events" | "system")}
        />
      </View>
      {view === "events" ? <DoorEvents /> : <SystemLog />}
    </StaffScreen>
  );
}

function DoorEvents() {
  const [period, setPeriod] = useState<Period>("today");
  const [deviceId, setDeviceId] = useState<number>(0);
  const [result, setResult] = useState<Result>("all");
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim().toLowerCase(), 200);
  const [devices, setDevices] = useState<AccessDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  useEffect(() => {
    getAccessDevices()
      .then(setDevices)
      .catch(() => setDevices([]))
      .finally(() => setDevicesLoading(false));
  }, []);

  const fetchPage = useCallback(async () => {
    const range = accessPeriodRange(period);
    const items = await getAccessEvents({ ...range, deviceId: deviceId || null, limit: ACCESS_EVENTS_LIMIT });
    return { items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }, [period, deviceId]);
  const list = usePagedList(fetchPage, { reloadOnFocus: false });

  const rows = useMemo(
    () =>
      list.items.filter(
        (e) =>
          (result === "all" || (result === "denied") === e.isDenied) &&
          (!search || (e.name ?? "").toLowerCase().includes(search) || (e.employeeNo ?? "").toLowerCase().includes(search) || (e.cardNo ?? "").includes(search)),
      ),
    [list.items, result, search],
  );
  const denied = list.items.filter((e) => e.isDenied).length;
  // The API returns at most the newest 2000 events: say so instead of silently leaving older ones out.
  const capNote = list.loading ? null : accessEventsCapNote(list.items.length);

  return (
    <>
      <View style={styles.filters}>
        <FilterChips
          value={period}
          onChange={setPeriod}
          options={[
            { label: "Today", value: "today" },
            { label: "Yesterday", value: "yesterday" },
            { label: "7 days", value: "7d" },
            { label: "30 days", value: "30d" },
          ]}
          accessibilityLabel="Period"
          style={styles.chipBar}
        />
        <SelectField
          label="Door"
          value={deviceId}
          options={[{ label: "All doors", value: 0 }, ...devices.map((d) => ({ label: d.name, value: d.id, description: [d.locationName, d.online ? "Online" : "Offline"].filter(Boolean).join(" · ") }))]}
          onChange={setDeviceId}
          loading={devicesLoading}
          leftIcon="hardware-chip-outline"
        />
        <FilterChips
          value={result}
          onChange={setResult}
          options={[
            { label: "All", value: "all", count: list.items.length },
            { label: "Granted", value: "granted", count: list.items.length - denied },
            { label: "Denied", value: "denied", count: denied },
          ]}
          accessibilityLabel="Result"
          style={styles.chipBar}
        />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, employee no. or card" />
      {capNote ? (
        <View style={styles.capNote}>
          <AppText variant="caption" color="textMuted" accessibilityRole="text">
            {capNote}
          </AppText>
        </View>
      ) : null}
      <AsyncList
        data={rows}
        keyExtractor={(e) => String(e.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        gap={8}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        empty={{ illustration: "door", title: "No door events", message: "Nothing matches this period and filter." }}
        renderItem={({ item }) => <EventRow event={item} />}
      />
    </>
  );
}

function EventRow({ event: e }: { event: AccessEvent }) {
  const { colors } = useTheme();
  return (
    <Card padding={12}>
      <View style={styles.row}>
        <Ionicons name={METHOD_ICONS[e.method] ?? "ellipse-outline"} size={22} color={e.isDenied ? colors.danger : colors.primary} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {e.name || (e.employeeNo ? `Employee ${e.employeeNo}` : "Unknown person")}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[e.device, e.label].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        <View style={styles.right}>
          <StatusPill tone={e.isDenied ? "danger" : "success"} label={e.isDenied ? "Denied" : "Granted"} />
          <AppText variant="caption" color="textMuted">
            {formatDate(e.time, { year: false })} {formatTime(e.time)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

function SystemLog() {
  const fetchPage = useCallback(async () => {
    const items = await getAccessSyncActivity(500);
    return { items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }, []);
  const list = usePagedList<AccessSyncActivity>(fetchPage, { reloadOnFocus: false });
  return (
    <AsyncList
      data={list.items}
      keyExtractor={(a) => String(a.id)}
      loading={list.loading}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      error={list.error}
      gap={8}
      empty={{ illustration: "chart", title: "No sync activity" }}
      renderItem={({ item: a }) => (
        <Card padding={12}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {(a.action ?? "Sync").replace(/^(AUDIT|queued|applied-queued|dropped-queued):\s*/i, "")}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {[a.employeeName, a.deviceName, a.detail].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <View style={styles.right}>
              <StatusPill tone={a.ok ? "success" : "danger"} label={a.ok ? "OK" : "Failed"} />
              <AppText variant="caption" color="textMuted">
                {formatDateTime(a.time)}
              </AppText>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  segment: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  filters: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.sm },
  capNote: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xs },
  chipBar: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  right: { alignItems: "flex-end", gap: 4 },
});
