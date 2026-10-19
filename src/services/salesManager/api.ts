import { positiveId } from "../ceo/drill";
import { periodQuery } from "../ceo/period";
import { staffGet } from "../staff/http";
import { withQuery } from "../staff/normalize";
import { smBreakdownParams } from "./drill";
import { toSalesManagerComplaintsError, toSalesManagerError } from "./errors";
import {
  normalizeSalesManagerBreakdown,
  normalizeSalesManagerComplaints,
  normalizeSalesManagerDashboard,
  normalizeSalesManagerRecords,
} from "./normalize";
import type {
  SmBreakdown,
  SmBreakdownQuery,
  SmComplaints,
  SmDashboard,
  SmRecordKind,
  SmRecords,
  SmRecordsQuery,
  SmScope,
} from "./types";

// Sales Manager dashboard calls. Same transport as the staff and CEO apps (services/staff/http: Bearer JWT, one
// silent token renewal on 401, readable ApiError messages); the API is read-only, so every call is a GET. A 503
// means the server still needs a database update (SM_01, SM_02 for desks, SM_03 for complaints) and is turned into
// that message (./errors.ts). The complaints section has its own call, so the dashboard keeps working without it.

/** API paths (relative to API_BASE_URL, which already ends in /api). */
export const SALES_MANAGER_ENDPOINTS = {
  dashboard: "/sales-manager/dashboard",
  complaints: "/sales-manager/complaints",
  breakdown: "/sales-manager/breakdown",
  records: (kind: SmRecordKind) => `/sales-manager/records/${kind}`,
} as const;

const RECORD_KINDS: readonly SmRecordKind[] = ["quotations", "bookings", "inquiries", "leases", "complaints"];

async function smGet(path: string, toError: (error: unknown) => unknown = toSalesManagerError): Promise<unknown> {
  try {
    return await staffGet(path);
  } catch (error) {
    throw toError(error);
  }
}

/**
 * GET api/sales-manager/dashboard?period=&locationId= (custom: &from=&to=) — funnel, team, inquiries, renewals.
 * Sales Manager / super admin. A custom period answers 503 until the server's database update CS_01 has run.
 */
export async function getSalesManagerDashboard(scope: SmScope): Promise<SmDashboard> {
  const raw = await smGet(
    withQuery(SALES_MANAGER_ENDPOINTS.dashboard, { ...periodQuery(scope.period, scope.range), locationId: positiveId(scope.locationId) }),
  );
  return normalizeSalesManagerDashboard(raw, scope.period);
}

/**
 * GET api/sales-manager/complaints?period=&locationId= (custom: &from=&to=) — the complaints section (current status
 * counts, the period's new / resolved / reopened, by category, by month, oldest open). A 503 names SM_03 (a custom
 * period before CS_01: CS_01).
 */
export async function getSalesManagerComplaints(scope: SmScope): Promise<SmComplaints> {
  const raw = await smGet(
    withQuery(SALES_MANAGER_ENDPOINTS.complaints, { ...periodQuery(scope.period, scope.range), locationId: positiveId(scope.locationId) }),
    toSalesManagerComplaintsError,
  );
  return normalizeSalesManagerComplaints(raw, scope.period);
}

/** GET api/sales-manager/breakdown?metric=&<key>=&period=&locationId= (custom: &periodFrom=&periodTo=) — drill level 2. */
export async function getSalesManagerBreakdown(query: SmBreakdownQuery): Promise<SmBreakdown> {
  const raw = await smGet(withQuery(SALES_MANAGER_ENDPOINTS.breakdown, smBreakdownParams(query)));
  return normalizeSalesManagerBreakdown(raw, query.metric);
}

/** GET api/sales-manager/records/{kind}?... — drill level 3: read-only list, newest first, at most 200 rows. */
export async function getSalesManagerRecords(query: SmRecordsQuery): Promise<SmRecords> {
  if (!RECORD_KINDS.includes(query.kind)) throw new Error("Unknown list.");
  const raw = await smGet(
    withQuery(SALES_MANAGER_ENDPOINTS.records(query.kind), query.params),
    query.kind === "complaints" ? toSalesManagerComplaintsError : toSalesManagerError,
  );
  return normalizeSalesManagerRecords(query.kind, raw);
}
