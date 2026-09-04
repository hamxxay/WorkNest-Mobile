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
  const fallback = Object.values(MOCK_QUOTATIONS).find(
    (q) => q.id === id || normalizeQuotationApiId(q.id) === apiId
  ) ?? Object.values(MOCK_QUOTATIONS)[0];

  return withMockFallback(
    `getQuotationById(${id})`,
    async () => {
      const raw = await apiRequest<any>(API_ENDPOINTS.quotation.byId(apiId), { requiresAuth: true });
      return normalizeQuotation(raw);
    },
    fallback,
  );
}

export function normalizeQuotation(q: any): Quotation {
  const rawItems = Array.isArray(q?.details)
    ? q.details
    : Array.isArray(q?.items)
      ? q.items
      : [];

  const items = rawItems.map((item: any, index: number) => ({
    id: Number(item?.id ?? item?.itemId ?? index + 1),
    name: String(item?.name ?? item?.itemName ?? `Item ${index + 1}`),
    quantity: Number(item?.quantity ?? item?.qty ?? 1),
    price: Number(item?.price ?? item?.unitPrice ?? item?.amount ?? 0),
    total: Number(
      item?.total ??
        item?.lineTotal ??
        item?.amount ??
        (Number(item?.price ?? 0) * Number(item?.quantity ?? 1))
    ),
  }));

  const subtotal = Number(q?.subtotalAmount ?? q?.subtotal ?? items.reduce((sum: number, item: any) => sum + Number(item.total ?? 0), 0));
  const total = Number(q?.totalAmount ?? q?.total ?? totalFromItems(items) ?? 0);

  return {
    id: String(q?.quotationId ?? q?.id ?? q?.quotationNumber ?? q?.quotationNo ?? ""),
    guid: q?.guid ?? "",
    quotationNumber: String(q?.quotationNumber ?? q?.quotationNo ?? q?.quotationCode ?? q?.number ?? q?.quotationId ?? q?.id ?? ""),
    customerName: q?.customerName ?? q?.customer?.name ?? "",
    customerEmail: q?.customerEmail ?? q?.customer?.email ?? "",
    spaceName: q?.spaceName ?? "",
    spaceCode: q?.spaceCode ?? "",
    locationName: q?.locationName ?? "",
    spaceTypeName: q?.spaceTypeName ?? "",
    startDateTime: q?.startDateTime ?? q?.startDate ?? "",
    endDateTime: q?.endDateTime ?? q?.endDate ?? "",
    quotationDate: q?.quotationDate ?? q?.date ?? "",
    validUntil: q?.validUntil ?? q?.validityDate ?? q?.expiryDate ?? "",
    items,
    subtotal: subtotal || 0,
    tax: Number(q?.tax ?? 0),
    total: total || 0,
    discountAmount: Number(q?.discountAmount ?? 0),
    securityDeposit: Number(q?.securityDeposit ?? 0),
    status: String(q?.status ?? q?.quotationStatus ?? q?.state ?? "active").toLowerCase(),
    notes: q?.remarks ?? q?.notes ?? undefined,
    version: Number(q?.version ?? 1),
    isActive: q?.isActive ?? true,
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

export async function acceptQuotation(id: string, version?: number): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const path = version == null
    ? API_ENDPOINTS.quotation.accept(apiId)
    : API_ENDPOINTS.quotation.versionAccept(apiId, version);
  const raw = await apiRequest<any>(path, { method: "POST", requiresAuth: true });
  return normalizeQuotation(raw);
}

export async function declineQuotation(id: string, version?: number): Promise<Quotation> {
  const apiId = normalizeQuotationApiId(id);
  const path = version == null
    ? API_ENDPOINTS.quotation.decline(apiId)
    : API_ENDPOINTS.quotation.versionDecline(apiId, version);
  const raw = await apiRequest<any>(path, { method: "POST", requiresAuth: true });
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

export async function getAllQuotations(): Promise<Quotation[]> {
  const user = await getUser();
  const customerId = user?.customerCode ?? user?.customerId ;
  if (!customerId) return Object.values(MOCK_QUOTATIONS);
  const raw = await apiRequest<any[]>(API_ENDPOINTS.quotation.byCustomer(String(customerId)), { requiresAuth: true });
  return (Array.isArray(raw) ? raw : []).map(normalizeQuotation);
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
