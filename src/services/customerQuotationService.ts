import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import { openApiPdf } from "./pdfService";
import { normalizeBreakdownFields, type BreakdownField } from "./amountBreakdown";

// Quotations for customers (QuotationController): list my quotations, view one (and its versions), download
// its PDF, accept, or decline with a reason. Everything else (create, versions, send, share, convert,
// activities) is staff only and not offered in the customer app. After a customer accepts, the team sends the
// agreement (My Agreements); the booking and its challan follow from there.

export type QuotationItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
};

export type Quotation = {
  id: string;
  guid?: string;
  quotationNumber?: string;
  customerName?: string;
  customerEmail?: string;
  spaceName?: string;
  spaceCode?: string;
  locationName?: string;
  spaceTypeName?: string;
  startDateTime?: string;
  endDateTime?: string;
  quotationDate: string;
  validUntil: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  securityDeposit?: number;
  status: string;
  notes?: string;
  version?: number;
  isActive?: boolean;
  /**
   * The API's own answer to "can this customer accept or decline now?" (true only while the quotation is Sent).
   * Undefined when an older API did not send it.
   */
  canRespond?: boolean;
  /**
   * The API's amount breakdown (same as the quotation PDF): advance rent, security deposit, tax... adding up to
   * the total payable. Empty when the API sent none.
   */
  fields: BreakdownField[];
};

/** "QUO-12" or "12" → "12" (the API's numeric id). */
export function normalizeQuotationApiId(rawId: string | number | null | undefined): string {
  if (rawId == null) return "";

  const id = String(rawId).trim();
  if (!id) return "";
  if (/^\d+$/.test(id)) return id;

  const match = id.match(/(\d+)/);
  if (!match) return id;

  const numericId = Number(match[1]);
  return Number.isFinite(numericId) && numericId > 0 ? String(numericId) : id;
}

function totalFromItems(items: Array<{ total: number }>) {
  return items.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
}

export function normalizeQuotation(q: any): Quotation {
  const rawItems = Array.isArray(q?.details)
    ? q.details
    : Array.isArray(q?.Details)
      ? q.Details
      : Array.isArray(q?.items)
        ? q.items
        : Array.isArray(q?.Items)
          ? q.Items
          : [];

  const items: QuotationItem[] = rawItems.map((item: any, index: number) => ({
    id: Number(item?.id ?? item?.Id ?? item?.itemId ?? index + 1),
    name: String(item?.name ?? item?.Name ?? item?.description ?? item?.Description ?? `Item ${index + 1}`),
    quantity: Number(item?.quantity ?? item?.Quantity ?? item?.qty ?? 1),
    price: Number(item?.price ?? item?.Price ?? item?.unitPrice ?? item?.UnitPrice ?? item?.amount ?? item?.Amount ?? 0),
    total: Number(
      item?.total ??
        item?.Total ??
        item?.lineTotal ??
        item?.LineTotal ??
        item?.amount ??
        item?.Amount ??
        (Number(item?.price ?? item?.UnitPrice ?? 0) * Number(item?.quantity ?? item?.Quantity ?? 1))
    ),
  }));

  const subtotal = Number(q?.subtotalAmount ?? q?.SubtotalAmount ?? q?.subtotal ?? q?.Subtotal ?? totalFromItems(items));
  // The total payable (advance rent + deposit + tax) comes first; totalAmount is the same figure on current APIs.
  const total = Number(
    q?.totalPayable ?? q?.TotalPayable ?? q?.totalAmount ?? q?.TotalAmount ?? q?.total ?? q?.Total ?? totalFromItems(items) ?? 0,
  );

  return {
    id: String(q?.id ?? q?.Id ?? q?.quotationId ?? q?.QuotationId ?? q?.quotationNumber ?? q?.QuotationNumber ?? ""),
    guid: q?.guid ?? q?.Guid ?? q?.publicId ?? q?.PublicId ?? "",
    quotationNumber: String(q?.quotationNumber ?? q?.QuotationNumber ?? q?.quotationNo ?? q?.number ?? q?.id ?? q?.Id ?? ""),
    customerName: q?.customerName ?? q?.CustomerName ?? q?.customer?.name ?? "",
    customerEmail: q?.customerEmail ?? q?.CustomerEmail ?? q?.customer?.email ?? "",
    spaceName: q?.spaceName ?? q?.SpaceName ?? "",
    spaceCode: q?.spaceCode ?? q?.SpaceCode ?? "",
    locationName: q?.locationName ?? q?.LocationName ?? "",
    spaceTypeName: q?.spaceTypeName ?? q?.SpaceTypeName ?? "",
    startDateTime: q?.startDateTime ?? q?.StartDateTime ?? q?.startDate ?? "",
    endDateTime: q?.endDateTime ?? q?.EndDateTime ?? q?.endDate ?? "",
    quotationDate: q?.quotationDate ?? q?.QuotationDate ?? q?.date ?? q?.createdAt ?? q?.CreatedAt ?? "",
    validUntil: q?.validUntil ?? q?.ValidUntil ?? q?.validityDate ?? "",
    items,
    subtotal: subtotal || 0,
    tax: Number(q?.taxAmount ?? q?.TaxAmount ?? q?.tax ?? 0),
    total: total || 0,
    discountAmount: Number(q?.discountAmount ?? q?.DiscountAmount ?? 0),
    securityDeposit: Number(q?.securityDeposit ?? q?.SecurityDeposit ?? 0),
    status: String(q?.status ?? q?.Status ?? q?.quotationStatus ?? q?.state ?? "active").toLowerCase(),
    notes: q?.remarks ?? q?.Remarks ?? q?.notes ?? q?.Notes ?? undefined,
    version: Number(q?.version ?? q?.Version ?? 1),
    isActive: q?.isActive ?? q?.IsActive ?? true,
    canRespond: typeof (q?.canRespond ?? q?.CanRespond) === "boolean" ? (q?.canRespond ?? q?.CanRespond) : undefined,
    fields: normalizeBreakdownFields(q),
  };
}

function listFrom(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  const p = (payload ?? {}) as Record<string, unknown>;
  if (Array.isArray(p.items)) return p.items as any[];
  if (Array.isArray(p.data)) return p.data as any[];
  if (Array.isArray(p.versions)) return p.versions as any[];
  return [];
}

/** A draft is still being prepared by the sales team: never shown to the customer. */
export function isDraftQuotation(quotation: Pick<Quotation, "status">): boolean {
  return (quotation.status ?? "").toLowerCase() === "draft";
}

/**
 * GET /quotation/my — the signed-in customer's quotations (drafts left out, like the API does now). Throws a
 * readable ApiError on failure.
 */
export async function getMyQuotations(): Promise<Quotation[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.quotation.my, { requiresAuth: true });
  return listFrom(payload)
    .map(normalizeQuotation)
    .filter((q) => !isDraftQuotation(q));
}

/** GET /quotation/{id} — staff: any; customer: their own (404 otherwise). */
export async function getQuotationById(id: string): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const payload = await apiRequest<unknown>(API_ENDPOINTS.quotation.byId(apiId), { requiresAuth: true });
  return normalizeQuotation(payload);
}

/** GET /quotation/{id}/versions — staff, or the customer the quotation was issued to. */
export async function getQuotationVersions(id: string): Promise<Quotation[]> {
  const apiId = normalizeQuotationApiId(id);
  const payload = await apiRequest<unknown>(API_ENDPOINTS.quotation.versions(apiId), { requiresAuth: true });
  return listFrom(payload).map(normalizeQuotation);
}

/** POST /quotation/{id}[/versions/{v}]/accept — the customer accepts their quotation (note optional). */
export async function acceptQuotation(id: string, note?: string, version?: number): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const path =
    version == null
      ? API_ENDPOINTS.quotation.accept(apiId)
      : API_ENDPOINTS.quotation.versionAccept(apiId, version);
  const payload = await apiRequest<any>(path, {
    method: "POST",
    requiresAuth: true,
    body: { note: note?.trim() || undefined },
  });
  if (payload && typeof payload === "object" && (payload.id ?? payload.Id ?? payload.quotationId)) {
    return normalizeQuotation(payload);
  }
  return getQuotationById(id);
}

/** POST /quotation/{id}[/versions/{v}]/decline — the API requires a reason. */
export async function declineQuotation(id: string, note: string, version?: number): Promise<Quotation> {
  const reason = (note ?? "").trim();
  if (!reason) throw new ApiError("Please tell us why you are declining this quotation.", 400);
  const apiId = normalizeQuotationApiId(id);
  const path =
    version == null
      ? API_ENDPOINTS.quotation.decline(apiId)
      : API_ENDPOINTS.quotation.versionDecline(apiId, version);
  const payload = await apiRequest<any>(path, {
    method: "POST",
    requiresAuth: true,
    body: { note: reason },
  });
  if (payload && typeof payload === "object" && (payload.id ?? payload.Id ?? payload.quotationId)) {
    return normalizeQuotation(payload);
  }
  return getQuotationById(id);
}

/** GET /quotation/{id}/pdf with the sign-in token, opened in the share / viewer sheet. */
export async function openQuotationPdf(id: string, quotationNumber?: string): Promise<void> {
  const apiId = normalizeQuotationApiId(id);
  await openApiPdf(API_ENDPOINTS.quotation.pdf(apiId), {
    fileName: `Quotation-${quotationNumber || apiId}`,
    title: `WorkNest Quotation ${quotationNumber || `#${apiId}`}`,
  });
}

/**
 * Whether the customer can accept or decline: the API's `canRespond` when it sent one, otherwise only a Sent
 * quotation that is still active (the API's own rule).
 */
export function canRespondToQuotation(
  quotation: Pick<Quotation, "status" | "isActive"> & { canRespond?: boolean },
): boolean {
  if (typeof quotation.canRespond === "boolean") return quotation.canRespond;
  if (quotation.isActive === false) return false;
  return (quotation.status ?? "").toLowerCase() === "sent";
}

// ─── Staff view of the shared Quotation screen ───────────────────────────────

export type QuotationActivity = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  version?: number;
};

function normalizeActivity(activity: any): QuotationActivity {
  return {
    id: String(activity?.id ?? activity?.guid ?? activity?.activityId ?? ""),
    action: String(activity?.action ?? activity?.actionType ?? activity?.type ?? "Updated"),
    description: String(activity?.description ?? activity?.message ?? activity?.remarks ?? "Quotation updated"),
    createdAt: String(activity?.createdAt ?? activity?.activityDate ?? activity?.date ?? ""),
    version: activity?.version == null ? undefined : Number(activity.version),
  };
}

/**
 * Staff only: GET /quotation/activities?quotationId= (the Quotation screen is shared with the sales stack).
 * Customers never call it.
 */
export async function getQuotationActivities(quotationId?: string | number): Promise<QuotationActivity[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.quotation.activities(quotationId), { requiresAuth: true });
  const p = payload as { activities?: unknown[] } | unknown[];
  const rows = Array.isArray(p) ? p : Array.isArray(p?.activities) ? p.activities : listFrom(payload);
  return rows.map(normalizeActivity);
}
