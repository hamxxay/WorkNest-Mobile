import { getDashboardForecast, type DashboardForecast } from "../staff/dashboard";
import { staffGet } from "../staff/http";
import { withQuery } from "../staff/normalize";
import { breakdownParams, positiveId } from "./drill";
import { toCeoError } from "./errors";
import { normalizeCeoBreakdown, normalizeCeoDashboard, normalizeCeoRecords } from "./normalize";
import { periodQuery } from "./period";
import { normalizeCeoRooms } from "./rooms";
import type {
  CeoBreakdown,
  CeoBreakdownQuery,
  CeoDashboard,
  CeoPeriod,
  CeoRecordKind,
  CeoRecords,
  CeoRecordsQuery,
  CeoRooms,
  CeoScope,
  DashRange,
} from "./types";

// CEO dashboard calls. Same transport as the staff apps (services/staff/http: Bearer JWT, one silent token renewal
// on 401, readable ApiError messages); the CEO API is read-only, so every call is a GET. A 503 means the server
// still needs the CEO database update and is turned into that message (./errors.ts).

/** API paths (relative to API_BASE_URL, which already ends in /api). */
export const CEO_ENDPOINTS = {
  dashboard: "/ceo/dashboard",
  breakdown: "/ceo/breakdown",
  records: (kind: CeoRecordKind) => `/ceo/records/${kind}`,
  rooms: "/ceo/rooms",
} as const;

const RECORD_KINDS: readonly CeoRecordKind[] = ["invoices", "spaces", "bookings", "inquiries", "quotations", "leases"];

async function ceoGet(path: string): Promise<unknown> {
  try {
    return await staffGet(path);
  } catch (error) {
    throw toCeoError(error);
  }
}

/**
 * GET api/ceo/dashboard?period=&locationId= — money, occupancy, sales and team for the period. CEO / super admin.
 * A custom period adds &from=&to= (yyyy-MM-dd); before the server's database update CS_01 that answers 503.
 */
export async function getCeoDashboard(scope: CeoScope): Promise<CeoDashboard> {
  const raw = await ceoGet(withQuery(CEO_ENDPOINTS.dashboard, { ...periodQuery(scope.period, scope.range), locationId: positiveId(scope.locationId) }));
  return normalizeCeoDashboard(raw, scope.period);
}

/** GET api/ceo/breakdown?metric=&<key>=&period=&locationId= (custom: &periodFrom=&periodTo=) — drill level 2. CEO / super admin. */
export async function getCeoBreakdown(query: CeoBreakdownQuery): Promise<CeoBreakdown> {
  const raw = await ceoGet(withQuery(CEO_ENDPOINTS.breakdown, breakdownParams(query)));
  return normalizeCeoBreakdown(raw, query.metric);
}

/**
 * GET api/ceo/records/{kind}?... — drill level 3: read-only list, newest first (leases: soonest first), at most 200
 * rows. CEO / super admin. records/leases needs the server's database update QA_07 (503 before it).
 */
export async function getCeoRecords(query: CeoRecordsQuery): Promise<CeoRecords> {
  if (!RECORD_KINDS.includes(query.kind)) throw new Error("Unknown list.");
  const raw = await ceoGet(withQuery(CEO_ENDPOINTS.records(query.kind), query.params));
  return normalizeCeoRecords(query.kind, raw);
}

/**
 * GET api/ceo/rooms?period=&locationId= (custom: &from=&to=) — the room report: rooms sold monthly (private offices,
 * shared spaces), how full they are and the price each booking was sold at against the list / shift price. CEO /
 * super admin. Before the server's database update CEO_02 it answers `available: false` with a message (shown
 * instead of the report).
 */
export async function getCeoRooms(period: CeoPeriod, locationId?: number | null, range?: DashRange | null): Promise<CeoRooms> {
  const raw = await ceoGet(withQuery(CEO_ENDPOINTS.rooms, { ...periodQuery(period, range), locationId: positiveId(locationId) }));
  return normalizeCeoRooms(raw, period);
}

/**
 * GET api/dashboard/forecast?months=3&locationIds= — the 3-month outlook (expected rent and occupancy from current
 * leases); the CEO is allowed too. Shown from its `totals`.
 */
export async function getCeoForecast(locationId?: number | null): Promise<DashboardForecast> {
  const id = positiveId(locationId);
  try {
    return await getDashboardForecast({ months: 3, locationIds: id ? [id] : [] });
  } catch (error) {
    throw toCeoError(error);
  }
}
