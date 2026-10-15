import { positiveId } from "../ceo/drill";
import { staffGet } from "../staff/http";
import { withQuery } from "../staff/normalize";
import { smBreakdownParams } from "./drill";
import { toSalesManagerError } from "./errors";
import { normalizeSalesManagerBreakdown, normalizeSalesManagerDashboard, normalizeSalesManagerRecords } from "./normalize";
import type { SmBreakdown, SmBreakdownQuery, SmDashboard, SmRecordKind, SmRecords, SmRecordsQuery, SmScope } from "./types";

// Sales Manager dashboard calls. Same transport as the staff and CEO apps (services/staff/http: Bearer JWT, one
// silent token renewal on 401, readable ApiError messages); the API is read-only, so every call is a GET. A 503
// means the server still needs a database update (SM_01, or SM_02 for desks) and is turned into that message
// (./errors.ts).

/** API paths (relative to API_BASE_URL, which already ends in /api). */
export const SALES_MANAGER_ENDPOINTS = {
  dashboard: "/sales-manager/dashboard",
  breakdown: "/sales-manager/breakdown",
  records: (kind: SmRecordKind) => `/sales-manager/records/${kind}`,
} as const;

const RECORD_KINDS: readonly SmRecordKind[] = ["quotations", "bookings", "inquiries", "leases"];

async function smGet(path: string): Promise<unknown> {
  try {
    return await staffGet(path);
  } catch (error) {
    throw toSalesManagerError(error);
  }
}

/** GET api/sales-manager/dashboard?period=&locationId= — funnel, team, inquiries, renewals. Sales Manager / super admin. */
export async function getSalesManagerDashboard(scope: SmScope): Promise<SmDashboard> {
  const raw = await smGet(withQuery(SALES_MANAGER_ENDPOINTS.dashboard, { period: scope.period, locationId: positiveId(scope.locationId) }));
  return normalizeSalesManagerDashboard(raw, scope.period);
}

/** GET api/sales-manager/breakdown?metric=&<key>=&period=&locationId= — drill level 2. */
export async function getSalesManagerBreakdown(query: SmBreakdownQuery): Promise<SmBreakdown> {
  const raw = await smGet(withQuery(SALES_MANAGER_ENDPOINTS.breakdown, smBreakdownParams(query)));
  return normalizeSalesManagerBreakdown(raw, query.metric);
}

/** GET api/sales-manager/records/{kind}?... — drill level 3: read-only list, newest first, at most 200 rows. */
export async function getSalesManagerRecords(query: SmRecordsQuery): Promise<SmRecords> {
  if (!RECORD_KINDS.includes(query.kind)) throw new Error("Unknown list.");
  const raw = await smGet(withQuery(SALES_MANAGER_ENDPOINTS.records(query.kind), query.params));
  return normalizeSalesManagerRecords(query.kind, raw);
}
