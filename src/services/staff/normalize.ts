// Pure helpers shared by the staff services: query strings, response envelopes, paging and field readers.
// No React Native imports, so they are unit-tested on their own (normalize.test.ts).
//
// The API answers in several shapes (all camelCase JSON):
//   - ApiResponse<T>:          { isSuccessful, message, data: T, errors }
//   - PaginatedResponse<T>:    { data: T[], total }
//   - KYC / some lists:        { items: T[], total, page, limit }
//   - ApiResponse of a page:   { isSuccessful, data: { items | data: T[], total } }
//   - plain arrays / objects   (dashboard, attendants, capacity requests)
// Staff services always call apiRequest with unwrapData: false and normalise here, so `total` is never lost
// (apiClient's default unwrapping would drop it).

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

/**
 * "?a=1&b=x" from the given params; skips null / undefined / "" / empty arrays and NaN; arrays are joined with
 * commas (the API's locationIds=1,2 format). Returns "" when nothing is set.
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    let text: string;
    if (Array.isArray(value)) {
      const items = value.map((v) => String(v).trim()).filter((v) => v.length > 0);
      if (items.length === 0) continue;
      text = items.join(",");
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      text = String(value);
    } else {
      text = String(value).trim();
      if (!text) continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Path + query, e.g. withQuery("/customer", { page: 1 }) -> "/customer?page=1". */
export function withQuery(path: string, params: Record<string, QueryValue>): string {
  return `${path}${buildQuery(params)}`;
}

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** True for an ApiResponse envelope ({ isSuccessful, data, message }). */
export function isEnvelope(value: unknown): value is { isSuccessful?: boolean; data?: unknown; message?: string } {
  return isObject(value) && ("isSuccessful" in value || "IsSuccessful" in value);
}

/** The payload inside an ApiResponse envelope; anything else is returned as is. */
export function unwrapEnvelope<T = unknown>(value: unknown): T {
  if (isEnvelope(value)) {
    const v = value as Record<string, any>;
    return (v.data ?? v.Data ?? null) as T;
  }
  return value as T;
}

export type Page<T> = {
  items: T[];
  /** Total rows on the server (all pages). */
  total: number;
  page: number;
  limit: number;
  /** True when more pages exist after this one. */
  hasMore: boolean;
};

const firstArray = (...candidates: unknown[]): unknown[] | null => {
  for (const c of candidates) if (Array.isArray(c)) return c;
  return null;
};

/**
 * Normalises any list response to a Page. `page` / `limit` are what was asked for (the server's own values win
 * when it sends them). When the server sends no total, `hasMore` is guessed from a full page.
 */
export function toPage<T>(
  raw: unknown,
  mapItem: (row: any) => T,
  requested: { page?: number; limit?: number } = {},
): Page<T> {
  const outer = isObject(raw) ? raw : {};
  const inner = unwrapEnvelope<unknown>(raw);
  const innerObj = isObject(inner) ? inner : {};

  const rows =
    firstArray(
      inner,
      innerObj.items,
      innerObj.Items,
      innerObj.data,
      innerObj.Data,
      innerObj.results,
      outer.items,
      outer.data,
    ) ?? [];

  const pickNumber = (...values: unknown[]): number | null => {
    for (const v of values) {
      const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
      if (v != null && Number.isFinite(n)) return n;
    }
    return null;
  };

  const page = pickNumber(innerObj.page, outer.page, requested.page) ?? 1;
  const limit = pickNumber(innerObj.limit, innerObj.pageSize, outer.limit, outer.pageSize, requested.limit) ?? rows.length;
  const serverTotal = pickNumber(
    innerObj.total,
    innerObj.Total,
    innerObj.totalCount,
    innerObj.totalRecords,
    outer.total,
    outer.Total,
    outer.totalCount,
    outer.totalRecords,
  );

  const items = rows.map(mapItem);
  const total = serverTotal ?? (page - 1) * limit + items.length;
  const hasMore = serverTotal != null ? page * limit < serverTotal : limit > 0 && items.length >= limit;
  return { items, total, page, limit, hasMore };
}

/** A plain list from any list-ish response (array, envelope, {items}, {data}). */
export function toList<T>(raw: unknown, mapItem: (row: any) => T): T[] {
  return toPage(raw, mapItem).items;
}

// ─── Field readers (camelCase first, PascalCase fallback) ────────────────────────────────────────────────

/** First non-null value among the given keys of a row (each key tried as given and Pascal-cased). */
export function pick(row: any, ...keys: string[]): any {
  if (!row || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (row[key] != null) return row[key];
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);
    if (row[pascal] != null) return row[pascal];
  }
  return undefined;
}

export function str(row: any, ...keys: string[]): string {
  const v = pick(row, ...keys);
  return v == null ? "" : String(v);
}

/** String or null when missing / blank. */
export function optStr(row: any, ...keys: string[]): string | null {
  const v = pick(row, ...keys);
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function num(row: any, ...keys: string[]): number {
  const n = Number(pick(row, ...keys));
  return Number.isFinite(n) ? n : 0;
}

/** Number or null when missing / not a number. */
export function optNum(row: any, ...keys: string[]): number | null {
  const v = pick(row, ...keys);
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function bool(row: any, ...keys: string[]): boolean {
  const v = pick(row, ...keys);
  if (typeof v === "string") return v.trim().toLowerCase() === "true" || v.trim() === "1";
  return v === true || v === 1;
}

/** Valid (positive) ids for the API's locationIds query parameter; buildQuery joins them with commas. */
export function idList(ids: readonly number[] | null | undefined): number[] {
  return (ids ?? []).filter((id) => Number.isFinite(id) && id > 0);
}

// ─── Dates ────────────────────────────────────────────────────────────────────────────────────────────────
// The API reads date-only fields as "yyyy-MM-dd" and date-times as "yyyy-MM-ddTHH:mm:ss" (no offset, Pakistan
// wall-clock time, as the CMS sends them). These format the device's local date parts, never UTC.

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "yyyy-MM-dd" from a Date's local date. */
export function toApiDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "yyyy-MM-ddTHH:mm:ss" from a Date's local date and time. */
export function toApiDateTime(date: Date): string {
  return `${toApiDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** True for a real calendar date written as yyyy-MM-dd. */
export function isApiDate(value: string | null | undefined): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Date (local midnight) from yyyy-MM-dd; null when invalid. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!isApiDate(value)) return null;
  const [y, m, d] = (value as string).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** yyyy-MM-dd plus whole months (CMS quotation end date: start + months, same day of month). */
export function addMonthsToApiDate(value: string, months: number): string | null {
  const d = parseApiDate(value);
  if (!d || !Number.isFinite(months)) return null;
  d.setMonth(d.getMonth() + months);
  return toApiDate(d);
}

/**
 * Some UTC columns come back without a "Z" (e.g. capacity requests' requestedAt). Adds it so `new Date()`
 * reads them as UTC; values that already carry an offset are returned as is.
 */
export function utcIso(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) return v;
  return /^\d{4}-\d{2}-\d{2}T/.test(v) ? `${v}Z` : v;
}

/** Calendar months from one date to another (day of month ignored), at least 1 (quotation / lease length). */
export function calendarMonthsBetween(start: Date, end: Date): number {
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}
