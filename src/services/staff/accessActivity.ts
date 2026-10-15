import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, num, optNum, optStr, pick, str, toApiDate, toList, unwrapEnvelope, withQuery } from "./normalize";

// Door access activity (CMS pages/admin/access/*: Access Dashboard, Access Activity Log, Access Analytics —
// `adminOnly`, so admin and super admin only in the app; API HikAccessController, location-scoped for admins).
// Times of door events are the door machine's local time without an offset ("yyyy-MM-ddTHH:mm:ss").

export type AccessPeriod = "today" | "yesterday" | "7d" | "30d";

/** from (inclusive) / to (exclusive, the API's rule) of the activity log's period presets, as yyyy-MM-dd. */
export function accessPeriodRange(period: AccessPeriod, today: Date = new Date()): { from: string; to: string } {
  const day = (offset: number) => toApiDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  switch (period) {
    case "today":
      return { from: day(0), to: day(1) };
    case "yesterday":
      return { from: day(-1), to: day(0) };
    case "7d":
      return { from: day(-6), to: day(1) };
    case "30d":
      return { from: day(-29), to: day(1) };
  }
}

export type AccessMethod = "fingerprint" | "face" | "card" | "door" | "remote" | "other";

export type AccessEvent = {
  id: number;
  deviceId: number | null;
  device: string | null;
  employeeNo: string | null;
  name: string | null;
  cardNo: string | null;
  label: string;
  isDenied: boolean;
  method: AccessMethod | string;
  /** Machine local time, no offset. */
  time: string | null;
};

const toEvent = (e: any): AccessEvent => ({
  id: num(e, "id"),
  deviceId: optNum(e, "deviceId"),
  device: optStr(e, "device"),
  employeeNo: optStr(e, "employeeNo"),
  name: optStr(e, "name"),
  cardNo: optStr(e, "cardNo"),
  label: str(e, "label"),
  isDenied: bool(e, "isDenied"),
  method: str(e, "method") || "other",
  time: optStr(e, "time"),
});

/** The most door events the API returns for one request (the newest ones). */
export const ACCESS_EVENTS_LIMIT = 2000;

/**
 * The note under the door events when the list hit the server's limit (older events are not shown), or null.
 * `count`: events received (before the screen's own filters).
 */
export function accessEventsCapNote(count: number, limit: number = ACCESS_EVENTS_LIMIT): string | null {
  if (count < limit) return null;
  return `Showing the latest ${limit.toLocaleString("en-US")} door events. Choose a shorter period or one door to see older ones.`;
}

/**
 * GET hik/access/events?from=&to=&deviceId=&employeeNo=&name=&limit= — door events, newest first.
 * from / to: yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss; `to` is exclusive (the CMS log sends to = last day + 1).
 * employeeNo / name are exact matches (name only when there is no employeeNo). limit 1-2000.
 */
export async function getAccessEvents(query: {
  from: string;
  to: string;
  deviceId?: number | null;
  employeeNo?: string;
  name?: string;
  limit?: number;
}): Promise<AccessEvent[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.access.events, {
      from: query.from,
      to: query.to,
      deviceId: query.deviceId ?? undefined,
      employeeNo: query.employeeNo?.trim(),
      name: query.employeeNo?.trim() ? undefined : query.name?.trim(),
      limit: Math.min(Math.max(query.limit ?? 500, 1), ACCESS_EVENTS_LIMIT),
    }),
  );
  return toList(raw, toEvent);
}

export type AccessSyncActivity = {
  id: number;
  /** e.g. "AUDIT: ...", "queued: ...", "applied-queued: ...", "dropped-queued: ..." */
  action: string | null;
  ok: boolean;
  detail: string | null;
  time: string | null;
  employeeName: string | null;
  deviceName: string | null;
};

/** GET hik/access/activity?limit= — system log of machine sync operations (the log's "system" view). */
export async function getAccessSyncActivity(limit = 500): Promise<AccessSyncActivity[]> {
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.access.activity, { limit: Math.min(Math.max(limit, 1), 1000) }));
  return toList(raw, (a) => ({
    id: num(a, "id"),
    action: optStr(a, "action"),
    ok: bool(a, "ok"),
    detail: optStr(a, "detail"),
    time: optStr(a, "time"),
    employeeName: optStr(a, "employeeName"),
    deviceName: optStr(a, "deviceName"),
  }));
}

export type AccessDevice = {
  id: number;
  name: string;
  code: string | null;
  locationId: number | null;
  locationName: string | null;
  online: boolean;
  lastSeen: string | null;
};

/** GET devices — door machines (location-scoped; unassigned machines included). For the log's device filter. */
export async function getAccessDevices(): Promise<AccessDevice[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.access.devices), (d) => ({
    id: num(d, "id"),
    name: str(d, "name"),
    code: optStr(d, "code"),
    locationId: optNum(d, "locationId"),
    locationName: optStr(d, "locationName", "location"),
    online: Number(pick(d, "online")) === 1 || bool(d, "online"),
    lastSeen: optStr(d, "last_seen", "lastSeen"),
  }));
}

/**
 * GET hik/access/dashboard?expiringDays= — stats, machines, today's hourly scans, recent events, members
 * expiring soon. Passed through (stage 2 types what the screen shows); recentEvents / lastEvent normalised.
 */
export async function getAccessDashboard(expiringDays = 7): Promise<Record<string, any>> {
  const d = unwrapEnvelope<any>(
    await staffGet(withQuery(STAFF_ENDPOINTS.access.dashboard, { expiringDays: Math.min(Math.max(expiringDays, 1), 60) })),
  ) ?? {};
  const recent = pick(d, "recentEvents");
  const last = pick(d, "lastEvent");
  return { ...d, recentEvents: Array.isArray(recent) ? recent.map(toEvent) : [], lastEvent: last ? toEvent(last) : null };
}

/** GET hik/access/analytics?from=&to= (yyyy-MM-dd, inclusive) — totals, hourly / daily counts, doors, methods. */
export async function getAccessAnalytics(from: string, to: string): Promise<Record<string, any>> {
  return unwrapEnvelope<Record<string, any>>(await staffGet(withQuery(STAFF_ENDPOINTS.access.analytics, { from, to }))) ?? {};
}

/** GET hik/access/analytics/user?employeeNo=&name=&from=&to= — one person's door use. */
export async function getPersonAccessAnalytics(query: {
  employeeNo?: string;
  name?: string;
  from: string;
  to: string;
}): Promise<Record<string, any>> {
  if (!query.employeeNo?.trim() && !query.name?.trim()) throw new Error("Choose the person.");
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.access.userAnalytics, {
      employeeNo: query.employeeNo?.trim(),
      name: query.employeeNo?.trim() ? undefined : query.name?.trim(),
      from: query.from,
      to: query.to,
    }),
  );
  const d = unwrapEnvelope<any>(raw) ?? {};
  const recent = pick(d, "recentEvents");
  return { ...d, recentEvents: Array.isArray(recent) ? recent.map(toEvent) : [] };
}
