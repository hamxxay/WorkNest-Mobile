import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, downloadStaffFile, staffGet, staffPost, type ActionResult, type DownloadedFile } from "./http";
import {
  bool,
  isApiDate,
  num,
  optNum,
  optStr,
  pick,
  str,
  toList,
  toPage,
  unwrapEnvelope,
  withQuery,
  type Page,
} from "./normalize";

// Quotations (CMS quotation.service.ts + manage.ts quotation form; API QuotationController).
// Roles: list / create / versions / send / email: admin, super admin, sales executive (StaffRoles). Detail and
// PDF: any signed-in staff member (customers only their own). Every route sits behind [ValidateLocationScope]:
// an admin / sales executive account with no location gets 403 on all of them.
//
// API facts the screens rely on:
//   - The list is { data, total, page, limit } (not wrapped); every version is its own row; no status filter.
//   - Create: capacity / monthlyBasePrice / maxDiscountPercent are recomputed by the server; the discount is
//     clamped to the offering type's cap; perSeatBasePrice may only raise the standard price; a location-bound
//     user may only quote spaces at their locations. A new quotation supersedes the active one for the same
//     customer + space (it gets a new quotation number).
//   - "New version" (POST {id}/versions) clones the row as a Draft and ignores any body. There is NO endpoint to
//     edit a quotation's values (PUT versions/{v} does not exist): editing = a new quotation with changed values.
//   - Send marks a version Sent; send-email ignores pdfBase64 and builds the PDF itself.
//   - POST {id}/convert always fails by design (a booking is created from the signed agreement).

export type QuotationActivity = {
  id: number;
  quotationId: number;
  version: number;
  activityType: string;
  message: string | null;
  customerNote: string | null;
  createdDate: string | null;
};

export type QuotationLine = { feeType: string; description: string; quantity: number; unitPrice: number; amount: number };

export type StaffQuotation = {
  id: number;
  guid: string | null;
  quotationNumber: string;
  version: number;
  /** Active, Inactive, Draft, Sent, Accepted, Declined, AgreementSent, Signed, Converted. */
  status: string;
  isActive: boolean;
  quotationDate: string | null;
  validUntil: string | null;
  customerId: number;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  spaceId: number;
  spaceName: string;
  spaceCode: string | null;
  /** PrivateOffice | SharedSpace | MeetingRoom ... */
  spaceType: string | null;
  spaceTypeName: string | null;
  locationName: string | null;
  cityName: string | null;
  offeringTypeId: number | null;
  offeringType: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  perSeatBasePrice: number;
  capacity: number;
  monthlyBasePrice: number;
  subtotalAmount: number;
  discountType: string | null;
  discountPercentage: number;
  discountValue: number;
  discountAmount: number;
  securityDeposit: number;
  supportChargeAmount: number;
  taxAmount: number;
  whtAmount: number;
  totalPayable: number;
  totalAmount: number;
  billingPeriodMonths: number;
  securityDepositMonths: number;
  billingPeriodLabel: string | null;
  monthlyRent: number;
  currentCycleAmount: number;
  totalContractAmount: number;
  remarks: string | null;
  /** True while the customer can accept / decline (status Sent). */
  canRespond: boolean;
  customerNote: string | null;
  responseDate: string | null;
  activities: QuotationActivity[];
  details: QuotationLine[];
};

const toActivity = (a: any): QuotationActivity => ({
  id: num(a, "id"),
  quotationId: num(a, "quotationId"),
  version: num(a, "version"),
  activityType: str(a, "activityType"),
  message: optStr(a, "message"),
  customerNote: optStr(a, "customerNote"),
  createdDate: optStr(a, "createdDate", "createdAt"),
});

export function normalizeQuotation(raw: any): StaffQuotation {
  const totalPayable = num(raw, "totalPayable", "totalAmount");
  return {
    id: num(raw, "id", "quotationId"),
    guid: optStr(raw, "guid", "idGuid"),
    quotationNumber: str(raw, "quotationNumber") || String(num(raw, "id")),
    version: num(raw, "versionNumber", "version") || 1,
    status: str(raw, "status") || "Draft",
    isActive: raw?.isActive == null && raw?.IsActive == null ? true : bool(raw, "isActive"),
    quotationDate: optStr(raw, "quotationDate", "createdAt"),
    validUntil: optStr(raw, "validUntil"),
    customerId: num(raw, "customerId"),
    customerName: str(raw, "customerName"),
    customerCompany: optStr(raw, "customerCompany"),
    customerEmail: optStr(raw, "customerEmail"),
    customerAddress: optStr(raw, "customerAddress"),
    spaceId: num(raw, "spaceId"),
    spaceName: str(raw, "spaceName"),
    spaceCode: optStr(raw, "spaceCode"),
    spaceType: optStr(raw, "spaceType"),
    spaceTypeName: optStr(raw, "spaceTypeName"),
    locationName: optStr(raw, "locationName"),
    cityName: optStr(raw, "cityName"),
    offeringTypeId: optNum(raw, "offeringTypeId"),
    offeringType: optStr(raw, "offeringTypeDescription", "offeringType"),
    startDateTime: optStr(raw, "startDateTime"),
    endDateTime: optStr(raw, "endDateTime"),
    perSeatBasePrice: num(raw, "perSeatBasePrice"),
    capacity: num(raw, "capacity"),
    monthlyBasePrice: num(raw, "monthlyBasePrice"),
    subtotalAmount: num(raw, "subtotalAmount"),
    discountType: optStr(raw, "discountType"),
    discountPercentage: num(raw, "discountPercentage"),
    discountValue: num(raw, "discountValue"),
    discountAmount: num(raw, "discountAmount"),
    securityDeposit: num(raw, "securityDeposit"),
    supportChargeAmount: num(raw, "supportChargeAmount"),
    taxAmount: num(raw, "taxAmount"),
    whtAmount: num(raw, "whtAmount"),
    totalPayable,
    totalAmount: num(raw, "totalAmount") || totalPayable,
    billingPeriodMonths: num(raw, "billingPeriodMonths"),
    securityDepositMonths: num(raw, "securityDepositMonths"),
    billingPeriodLabel: optStr(raw, "billingPeriodLabel"),
    monthlyRent: num(raw, "monthlyRent"),
    currentCycleAmount: num(raw, "currentCycleAmount"),
    totalContractAmount: num(raw, "totalContractAmount"),
    remarks: optStr(raw, "remarks"),
    canRespond: bool(raw, "canRespond"),
    customerNote: optStr(raw, "customerNote"),
    responseDate: optStr(raw, "responseDate"),
    activities: Array.isArray(pick(raw, "activities")) ? pick(raw, "activities").map(toActivity) : [],
    details: Array.isArray(pick(raw, "details"))
      ? pick(raw, "details").map((d: any) => ({
          feeType: str(d, "feeType"),
          description: str(d, "description"),
          quantity: num(d, "quantity"),
          unitPrice: num(d, "unitPrice"),
          amount: num(d, "amount"),
        }))
      : [],
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * GET quotation?page=&limit=&search=&locationId= — search matches quotation number and customer name / company.
 * Admins / sales executives only get their own locations. Rows are full quotations (heavy): keep `limit` modest.
 */
export async function listQuotations(
  query: { page?: number; limit?: number; search?: string; locationId?: number | null } = {},
): Promise<Page<StaffQuotation>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.quotations.list, {
      page,
      limit,
      search: query.search?.trim(),
      locationId: query.locationId && query.locationId > 0 ? query.locationId : undefined,
    }),
  );
  return toPage(raw, normalizeQuotation, { page, limit });
}

/** GET quotation/{id} */
export async function getQuotation(id: number | string): Promise<StaffQuotation> {
  return normalizeQuotation(unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.quotations.byId(id))));
}

/** GET quotation/{id}/versions — every version of the quotation number, oldest first. */
export async function getQuotationVersions(id: number | string): Promise<StaffQuotation[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.quotations.versions(id)), normalizeQuotation);
}

/** GET quotation/{id}/versions/{versionNumber} */
export async function getQuotationVersion(id: number | string, versionNumber: number): Promise<StaffQuotation> {
  return normalizeQuotation(unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.quotations.version(id, versionNumber))));
}

/** GET quotation/activities?quotationId=&limit= — Sent, VersionCreated, Accepted, Declined, Agreement... */
export async function getQuotationActivities(
  options: { quotationId?: number; limit?: number } = {},
): Promise<QuotationActivity[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.quotations.activities, { quotationId: options.quotationId, limit: options.limit ?? 20 }),
  );
  return toList(raw, toActivity);
}

export type QuotationResponseRow = {
  id: number;
  quotationId: number;
  version: number;
  /** Accepted | Declined */
  responseType: string;
  note: string | null;
  respondedDate: string | null;
  quotationNumber: string;
  quotationStatus: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  spaceName: string | null;
};

/** GET quotation/responses?page=&limit=&search= — customers' accept / decline responses (not location-scoped). */
export async function listQuotationResponses(
  query: { page?: number; limit?: number; search?: string } = {},
): Promise<Page<QuotationResponseRow>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.quotations.responses, { page, limit, search: query.search?.trim() }));
  return toPage(
    raw,
    (r) => ({
      id: num(r, "id"),
      quotationId: num(r, "quotationId"),
      version: num(r, "version"),
      responseType: str(r, "responseType"),
      note: optStr(r, "note"),
      respondedDate: optStr(r, "respondedDate"),
      quotationNumber: str(r, "quotationNumber"),
      quotationStatus: str(r, "quotationStatus"),
      customerName: str(r, "customerName"),
      customerEmail: optStr(r, "customerEmail"),
      customerPhone: optStr(r, "customerPhone"),
      spaceName: optStr(r, "spaceName"),
    }),
    { page, limit },
  );
}

// ─── Offering types ───────────────────────────────────────────────────────────────────────────────────────

export type OfferingType = { id: number; description: string; discountCap: number; isActive: boolean; locationId: number | null };

/** Offering types for a location: those without a location, plus the location's own (CMS filteredQuotationOfferingTypes). */
export function offeringTypesForLocation(types: OfferingType[], locationId: number | null | undefined): OfferingType[] {
  return types.filter((o) => o.locationId == null || (locationId != null && o.locationId === locationId));
}

/**
 * GET quotation/offering-types?activeOnly=true — the API ignores a locationId parameter, so filter with
 * offeringTypesForLocation. discountCap is the maximum discount (percent) the server allows.
 */
export async function getOfferingTypes(): Promise<OfferingType[]> {
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.quotations.offeringTypes, { activeOnly: true }));
  return toList(raw, (o) => ({
    id: num(o, "id"),
    description: str(o, "description"),
    discountCap: num(o, "discountCap"),
    isActive: o?.status == null && o?.Status == null ? true : bool(o, "status"),
    locationId: optNum(o, "locationId"),
  })).filter((o) => o.id > 0);
}

// ─── Create ───────────────────────────────────────────────────────────────────────────────────────────────

export type QuotationDiscountType = "Percentage" | "Amount";

export type QuotationInput = {
  customerId: number;
  spaceId: number;
  floorId?: number | null;
  offeringTypeId: number;
  /** The offering type's description, e.g. "24/7". */
  offeringType: string;
  /** "yyyy-MM-ddTHH:mm:ss" (offices / shared: T00:00:00; meeting rooms: the slot hours). */
  startDateTime: string;
  endDateTime: string;
  /** yyyy-MM-dd (CMS default: today + 7 days). */
  validUntil: string;
  /** Monthly price per seat; may only be raised above the space's standard price. */
  perSeatBasePrice?: number | null;
  discountType: QuotationDiscountType;
  /** Percent (0-100) for Percentage, rupees for Amount. */
  discountValue: number;
  securityDepositOverride?: number | null;
  /** CMS defaults: 3 for offices / shared spaces, 1 for meeting rooms. */
  billingPeriodMonths?: number | null;
  /** CMS default: 2 for private offices, 0 otherwise. */
  securityDepositMonths?: number | null;
  remarks?: string;
};

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** First problem with the input (readable), or null when it can be sent. */
export function validateQuotationInput(input: QuotationInput): string | null {
  if (!(input.customerId > 0)) return "Choose the customer.";
  if (!(input.spaceId > 0)) return "Choose the space.";
  if (!(input.offeringTypeId > 0)) return "Choose the offering type.";
  if (!DATE_TIME_RE.test(input.startDateTime ?? "")) return "Choose the start date.";
  if (!DATE_TIME_RE.test(input.endDateTime ?? "")) return "Choose the end date.";
  if (input.endDateTime <= input.startDateTime) return "The end date must be after the start date.";
  if (!isApiDate(input.validUntil)) return "Choose the date the quotation is valid until.";
  const discount = Number(input.discountValue);
  if (!Number.isFinite(discount) || discount < 0) return "The discount can't be negative.";
  if (input.discountType === "Percentage" && discount > 100) return "The discount can't be more than 100%.";
  if (input.perSeatBasePrice != null && (!Number.isFinite(input.perSeatBasePrice) || input.perSeatBasePrice < 0)) {
    return "Enter a valid base price.";
  }
  return null;
}

/** QuotationRequest body (camelCase), with the discount fields the way the CMS sends them. */
export function buildQuotationPayload(input: QuotationInput) {
  const discount = Number(input.discountValue) || 0;
  const optional = (value: number | null | undefined) => (value != null && Number.isFinite(value) ? value : null);
  return {
    customerId: input.customerId,
    spaceId: input.spaceId,
    floorId: input.floorId && input.floorId > 0 ? input.floorId : null,
    offeringTypeId: input.offeringTypeId,
    offeringType: input.offeringType,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    validUntil: input.validUntil,
    perSeatBasePrice: optional(input.perSeatBasePrice),
    discountType: input.discountType,
    discountPercentage: input.discountType === "Percentage" ? discount : 0,
    discountValue: discount,
    securityDepositOverride: optional(input.securityDepositOverride),
    billingPeriodMonths: optional(input.billingPeriodMonths),
    securityDepositMonths: optional(input.securityDepositMonths),
    remarks: input.remarks?.trim() || null,
  };
}

/** POST quotation. Returns the created quotation (server-calculated amounts). */
export async function createQuotation(input: QuotationInput): Promise<ActionResult<StaffQuotation>> {
  const invalid = validateQuotationInput(input);
  if (invalid) throw new Error(invalid);
  const raw = await staffPost(STAFF_ENDPOINTS.quotations.create, buildQuotationPayload(input));
  const result = actionResult<any>(raw, "Quotation created.");
  return { message: result.message, data: normalizeQuotation(result.data) };
}

/** POST quotation/{id}/versions — a Draft copy of row {id} as the next version (values can't be changed). */
export async function createQuotationVersion(id: number | string): Promise<ActionResult<StaffQuotation>> {
  const raw = await staffPost(STAFF_ENDPOINTS.quotations.createVersion(id));
  const result = actionResult<any>(raw, "New quotation version created.");
  return { message: result.message, data: normalizeQuotation(result.data) };
}

/** POST quotation/{id}/versions/{versionNumber}/send — marks that version Sent (the customer can respond). */
export async function sendQuotation(id: number | string, versionNumber: number): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.quotations.sendVersion(id, versionNumber));
  return actionResult(raw, "Quotation sent.");
}

/**
 * POST quotation/{id}/send-email { email } — the server builds the PDF of row {id} and emails it; without an
 * email it goes to the customer's own address.
 */
export async function emailQuotation(id: number | string, email?: string | null): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.quotations.sendEmail(id), { email: email?.trim() || null });
  return actionResult(raw, "Quotation emailed.");
}

/** GET quotation/{id}/versions/{v}/pdf (or /pdf without a version), downloaded with the login token. */
export async function downloadQuotationPdf(
  id: number | string,
  options: { versionNumber?: number; quotationNumber?: string } = {},
): Promise<DownloadedFile> {
  const path = options.versionNumber
    ? STAFF_ENDPOINTS.quotations.versionPdf(id, options.versionNumber)
    : STAFF_ENDPOINTS.quotations.pdf(id);
  const name = `Quotation-${options.quotationNumber || id}${options.versionNumber ? `-v${options.versionNumber}` : ""}.pdf`;
  return downloadStaffFile(path, { fileName: name, mimeType: "application/pdf" });
}
