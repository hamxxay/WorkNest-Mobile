import { formatDate, formatDateRange } from "../../utils/format";
import { toBranchId } from "./branches";
import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { isApiDate, unwrapEnvelope, type QueryValue } from "./normalize";

// Filters of the staff lists Bookings, Quotations, Invoices, Payments and Customers (API script LST_01_list_filters;
// CMS utils/list-filters.ts and the manage page). Location, Status and a From / To date range are applied on the
// server together with the search, so they stay right with paging. The API only uses its new procedures when one of
// them is set: an unfiltered list is requested exactly as before.
//
// API facts the screens rely on:
//   - Query: ?locationId= (a WN_Locations id; location-bound staff only get their own), ?status= (the `value` of a
//     choice from GET {list}/statuses), ?from= / ?to= (yyyy-MM-dd, business dates, both days included).
//   - Which date each list filters on: bookings start date, quotations created (quotation date), invoices issue
//     date, payments payment date (paid on, else created on), customers created date.
//   - GET {booking|quotation|invoice|payment|customer}/statuses -> ApiResponse of [{ value, label }], read from the
//     database (bookings: WN_BookingStatuses ids; quotations / invoices: status text; payments: StatusId;
//     customers: "1" active / "0" inactive).
//   - A wrong value is answered 400 with a message; until the database script has run a filtered list is answered
//     503 "Database update needed: run the script LST_01_list_filters_TEST ..." (the screens show it with Retry).

/** The lists that have the Location / Status / date filters. */
export type FilteredList = "bookings" | "quotations" | "invoices" | "payments" | "customers";

/** What the date range filters on, as the CMS column header calls it. */
export const LIST_DATE_LABEL: Record<FilteredList, string> = {
  bookings: "Start date",
  quotations: "Created",
  invoices: "Issued",
  payments: "Payment date",
  customers: "Created",
};

/** The filters of one list. null = not set. */
export type ListFilters = {
  /** WN_Locations id; null = every location the user may see. */
  locationId: number | null;
  /** The `value` of a choice from GET {list}/statuses; null = every status. */
  status: string | null;
  /** yyyy-MM-dd, both days included. */
  from: string | null;
  to: string | null;
};

export const NO_LIST_FILTERS: ListFilters = { locationId: null, status: null, from: null, to: null };

/** One choice of a list's Status filter: `value` is sent back as ?status=, `label` is shown. */
export type ListStatusOption = { value: string; label: string };

/**
 * The query parameters of the filters that are set (and only those): an unset filter adds nothing, so the API
 * answers the list exactly as before. Dates that are not a whole yyyy-MM-dd are left out.
 */
export function listFilterQuery(filters: Partial<ListFilters> | null | undefined): Record<string, QueryValue> {
  const f = filters ?? {};
  const status = typeof f.status === "string" ? f.status.trim() : "";
  return {
    locationId: toBranchId(f.locationId) ?? undefined,
    status: status || undefined,
    from: f.from && isApiDate(f.from) ? f.from : undefined,
    to: f.to && isApiDate(f.to) ? f.to : undefined,
  };
}

/** How many filters are on (the date range counts once): the small count on the Filters button. */
export function activeFilterCount(filters: Partial<ListFilters> | null | undefined): number {
  const q = listFilterQuery(filters);
  return (q.locationId != null ? 1 : 0) + (q.status != null ? 1 : 0) + (q.from != null || q.to != null ? 1 : 0);
}

export function hasActiveFilters(filters: Partial<ListFilters> | null | undefined): boolean {
  return activeFilterCount(filters) > 0;
}

/** A new From date; the To date moves up to it when it was before (the CMS rule). null clears it. */
export function withFromDate(filters: ListFilters, from: string | null): ListFilters {
  const next = from && isApiDate(from) ? from : null;
  const to = next && filters.to && filters.to < next ? next : filters.to;
  return { ...filters, from: next, to };
}

/** A new To date; the From date moves back to it when it was after (the CMS rule). null clears it. */
export function withToDate(filters: ListFilters, to: string | null): ListFilters {
  const next = to && isApiDate(to) ? to : null;
  const from = next && filters.from && filters.from > next ? next : filters.from;
  return { ...filters, from, to: next };
}

/**
 * The filters a screen sends: a location that is no longer offered (the choices changed, or the user sees one
 * location only) and a status that is not one of the loaded choices are dropped. `statusOptions` null = the
 * choices are not known (yet): the status is kept.
 */
export function effectiveListFilters(
  filters: ListFilters,
  locationIds: readonly number[],
  statusOptions: readonly ListStatusOption[] | null,
): ListFilters {
  const locationId = filters.locationId != null && locationIds.includes(filters.locationId) ? filters.locationId : null;
  const status =
    filters.status != null && (statusOptions == null || statusOptions.some((o) => o.value === filters.status)) ? filters.status : null;
  return { ...filters, locationId, status };
}

/** "InProgress" -> "In Progress" (CMS statusDisplay). */
export function statusDisplay(label: string | null | undefined): string {
  return String(label ?? "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** The Status choices of a GET {list}/statuses answer: trimmed, blanks and repeated values dropped. */
export function normalizeStatusOptions(raw: unknown): ListStatusOption[] {
  const data = unwrapEnvelope<unknown>(raw);
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: ListStatusOption[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const value = String(r.value ?? r.Value ?? "").trim();
    const label = String(r.label ?? r.Label ?? "").trim();
    if (!value || !label || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label });
  }
  return out;
}

/** GET {list}/statuses: the Status filter choices, read from the database (staff roles). */
export async function getListStatusOptions(list: FilteredList): Promise<ListStatusOption[]> {
  return normalizeStatusOptions(await staffGet(STAFF_ENDPOINTS.listStatuses[list]));
}

export type ActiveFilterChip = { key: "location" | "status" | "dates"; label: string };

/**
 * One removable chip per filter that is on (shown under the search box): the location's name, the status label and
 * the date range ("Issued 1 – 5 Oct 2026", "Created from 1 Oct 2026", "Start date until 5 Oct 2026").
 */
export function activeFilterChips(
  filters: ListFilters,
  context: { locations: readonly { id: number; name: string }[]; statusOptions: readonly ListStatusOption[]; dateLabel: string },
): ActiveFilterChip[] {
  const q = listFilterQuery(filters);
  const chips: ActiveFilterChip[] = [];
  if (typeof q.locationId === "number") {
    const id = q.locationId;
    chips.push({ key: "location", label: context.locations.find((l) => l.id === id)?.name || `Location ${id}` });
  }
  if (typeof q.status === "string") {
    const value = q.status;
    chips.push({ key: "status", label: statusDisplay(context.statusOptions.find((o) => o.value === value)?.label ?? value) });
  }
  const from = typeof q.from === "string" ? q.from : null;
  const to = typeof q.to === "string" ? q.to : null;
  if (from && to) chips.push({ key: "dates", label: `${context.dateLabel} ${formatDateRange(from, to)}` });
  else if (from) chips.push({ key: "dates", label: `${context.dateLabel} from ${formatDate(from)}` });
  else if (to) chips.push({ key: "dates", label: `${context.dateLabel} until ${formatDate(to)}` });
  return chips;
}

/** The filters without the one a chip stands for (its x was pressed). */
export function withoutFilter(filters: ListFilters, key: ActiveFilterChip["key"]): ListFilters {
  if (key === "location") return { ...filters, locationId: null };
  if (key === "status") return { ...filters, status: null };
  return { ...filters, from: null, to: null };
}
