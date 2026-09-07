// Replace Promise bodies with real apiRequest() calls when backend is ready.
import {
  MOCK_QUOTATIONS,
  MOCK_CHALLANS,
  type Quotation,
  type Challan,
  type ChallanRequest,
  type ModifiedOrder,
  type QuotationItem,
} from "../data/mockQuotationData";
import { apiRequest, ApiError } from "./apiClient";
import { API_ENDPOINTS } from "../config/api";
import { getUser } from "../utils/authStorage";

const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms));

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

async function withMockFallback<T>(
  label: string,
  request: () => Promise<T>,
  fallback: T,
  shouldFallback: (error: unknown) => boolean = (error) => {
    const status = error instanceof ApiError ? error.status : undefined;
    return status === 401 || status === 404;
  }
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (shouldFallback(error)) {
      console.warn(`[mockQuotationService] ${label} fallback triggered`, error);
      return fallback;
    }
    throw error;
  }
}

export async function getQuotationById(id: string): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const raw = await apiRequest<any>(API_ENDPOINTS.quotation.byId(apiId), { requiresAuth: true });
  const data = raw?.data ?? raw;
  return normalizeQuotation(data);
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

  const items = rawItems.map((item: any, index: number) => ({
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

  const subtotal = Number(q?.subtotalAmount ?? q?.SubtotalAmount ?? q?.subtotal ?? q?.Subtotal ?? items.reduce((sum: number, item: any) => sum + Number(item.total ?? 0), 0));
  const total = Number(q?.totalAmount ?? q?.TotalAmount ?? q?.total ?? q?.Total ?? totalFromItems(items) ?? 0);

  return {
    id: String(q?.id ?? q?.Id ?? q?.quotationId ?? q?.QuotationId ?? q?.quotationNumber ?? q?.QuotationNumber ?? ""),
    guid: q?.guid ?? q?.Guid ?? "",
    quotationNumber: String(q?.quotationNumber ?? q?.QuotationNumber ?? q?.quotationNo ?? q?.number ?? q?.id ?? q?.Id ?? ""),
    customerName: q?.customerName ?? q?.CustomerName ?? q?.customer?.name ?? "",
    customerEmail: q?.customerEmail ?? q?.CustomerEmail ?? q?.customer?.email ?? "",
    spaceName: q?.spaceName ?? q?.SpaceName ?? "",
    spaceCode: q?.spaceCode ?? q?.SpaceCode ?? "",
    locationName: q?.locationName ?? q?.LocationName ?? "",
    spaceTypeName: q?.spaceTypeName ?? q?.SpaceTypeName ?? "",
    startDateTime: q?.startDateTime ?? q?.StartDateTime ?? q?.startDate ?? "",
    endDateTime: q?.endDateTime ?? q?.EndDateTime ?? q?.endDate ?? "",
    quotationDate: q?.quotationDate ?? q?.QuotationDate ?? q?.date ?? "",
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
  };
}

function totalFromItems(items: Array<{ total: number }>) {
  return items.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
}

export type QuotationActivity = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  version?: number;
};

export type SendQuotationPayload = {
  recipientEmail: string;
  subject?: string;
  message?: string;
};

function normalizeActivity(activity: any): QuotationActivity {
  return {
    id: String(activity.id ?? activity.guid ?? activity.activityId ?? ""),
    action: String(activity.action ?? activity.actionType ?? activity.type ?? "Updated"),
    description: String(activity.description ?? activity.message ?? activity.remarks ?? "Quotation updated"),
    createdAt: String(activity.createdAt ?? activity.activityDate ?? activity.date ?? ""),
    version: activity.version == null ? undefined : Number(activity.version),
  };
}

export async function acceptQuotation(id: string, note?: string, version?: number): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const path = version == null
    ? API_ENDPOINTS.quotation.accept(apiId)
    : API_ENDPOINTS.quotation.versionAccept(apiId, version);
  const raw = await apiRequest<any>(path, { method: "POST", body: { note }, requiresAuth: true });
  return normalizeQuotation(raw);
}

export async function declineQuotation(id: string, note: string, version?: number): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const path = version == null
    ? API_ENDPOINTS.quotation.decline(apiId)
    : API_ENDPOINTS.quotation.versionDecline(apiId, version);
  const raw = await apiRequest<any>(path, { method: "POST", body: { note }, requiresAuth: true });
  return normalizeQuotation(raw);
}

export async function createQuotationVersion(
  id: string,
  payload: { details: QuotationItem[]; subtotalAmount: number; tax?: number; totalAmount: number }
): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const raw = await apiRequest<any>(API_ENDPOINTS.quotation.versionCreate(apiId), {
    method: "POST",
    body: payload,
    requiresAuth: true,
  });
  return normalizeQuotation(raw);
}

export async function getQuotationVersions(id: string): Promise<Quotation[]> {
  const apiId = normalizeQuotationApiId(id);
  return withMockFallback(
    `getQuotationVersions(${id})`,
    async () => {
      const raw = await apiRequest<any>(API_ENDPOINTS.quotation.versions(apiId), { requiresAuth: true });
      const versions = Array.isArray(raw) ? raw : raw?.items ?? raw?.versions ?? [];
      return versions.map(normalizeQuotation);
    },
    []
  );
}

export async function getQuotationActivities(): Promise<QuotationActivity[]> {
  return withMockFallback(
    "getQuotationActivities()",
    async () => {
      const raw = await apiRequest<any>(API_ENDPOINTS.quotation.activities, { requiresAuth: true });
      const activities = Array.isArray(raw) ? raw : raw?.items ?? raw?.activities ?? [];
      return activities.map(normalizeActivity);
    },
    []
  );
}

export async function sendQuotation(id: string, payload: SendQuotationPayload): Promise<void> {
  await apiRequest<unknown>(API_ENDPOINTS.quotation.send(id), {
    method: "POST",
    body: payload,
    requiresAuth: true,
  });
}

export async function getAllQuotations(status?: string, page: number = 1, limit: number = 10): Promise<Quotation[]> {
  const user = await getUser();
  console.log(" -=-=-=-getAllQuotations called for user:", user);

  // 1. Try /api/quotation/my (resolves customer from session email/token)
  try {
    const rawMy = await apiRequest<any>("/quotation/my", { requiresAuth: true });
    const itemsMy = Array.isArray(rawMy) ? rawMy : rawMy?.data ?? rawMy?.items ?? [];
    if (Array.isArray(itemsMy) && itemsMy.length > 0) {
      return itemsMy.map(normalizeQuotation);
    }
  } catch (e) {
    console.warn("[mockQuotationService] /quotation/my endpoint error:", e);
  }

  // 2. Try primary list endpoint /api/quotations
  try {
    let url = API_ENDPOINTS.quotation.list;
    const queryParams: string[] = [`page=${page}`, `limit=${limit}`];
    if (status && status !== 'all') queryParams.push(`status=${encodeURIComponent(status)}`);
    url += `?${queryParams.join('&')}`;

    const raw = await apiRequest<any>(url, { requiresAuth: true });
    const items = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? [];
    if (Array.isArray(items) && items.length > 0) {
      return items.map(normalizeQuotation);
    }
  } catch (error) {
    console.warn("[mockQuotationService] getAllQuotations primary list endpoint error:", error);
  }

  // 3. Fallback to /api/quotation/by-customer/{id} with numeric IDs only
  const candidateIds = Array.from(new Set([user?.customerId, user?.customerCode, user?.id].filter(Boolean)))
    .map(String)
    .filter(id => /^\d+$/.test(id));

  for (const cid of candidateIds) {
    try {
      const rawByCust = await apiRequest<any>(API_ENDPOINTS.quotation.byCustomer(cid), { requiresAuth: true });
      const itemsByCust = Array.isArray(rawByCust) ? rawByCust : (rawByCust as any)?.data ?? [];
      if (Array.isArray(itemsByCust) && itemsByCust.length > 0) {
        return itemsByCust.map(normalizeQuotation);
      }
    } catch (e) {
      console.warn(`[mockQuotationService] byCustomer(${cid}) failed:`, e);
    }
  }

  return [];
}

export async function submitChallanRequest(
  quotationId: string,
  form: ChallanRequest
): Promise<{ success: boolean; message: string }> {
  await delay(1000);
  console.log("[mockQuotationService] challan request submitted", { quotationId, form });
  return { success: true, message: "Challan request submitted successfully." };
}

export async function submitModifiedOrder(
  quotationId: string,
  items: QuotationItem[]
): Promise<{ success: boolean; modifiedOrder: ModifiedOrder }> {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  await createQuotationVersion(quotationId, {
    details: items,
    subtotalAmount: subtotal,
    tax: 0,
    totalAmount: subtotal,
  });
  const modifiedOrder: ModifiedOrder = { quotationId, items, subtotal, tax: 0, total: subtotal };
  return { success: true, modifiedOrder };
}

export async function getChallan(quotationId: string): Promise<Challan> {
  await delay();
  const c = MOCK_CHALLANS[quotationId];
  if (!c) throw new Error(`Challan for quotation "${quotationId}" not found.`);
  return c;
}
