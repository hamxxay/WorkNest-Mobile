
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { getToken, getUser } from "../utils/authStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgreementStatus =
  | "Pending"
  | "Sent"
  | "SignedUploaded"
  | "Signed"
  | "Expired"
  | "Cancelled"
  | string;

export type AgreementRecord = {
  id?: number | string;
  quotationId?: number | string;
  quotationNumber?: string;
  customerId?: number | string;
  customerName?: string;
  customerEmail?: string;
  spaceName?: string;
  locationName?: string;
  status?: AgreementStatus;
  sentAt?: string;
  signedAt?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  feeAmount?: number;
  securityDeposit?: number;
  pdfUrl?: string;
  signedPdfUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SendAgreementPayload = {
  quotationId: number;
  entityType?: string;
  fullName?: string;
  cnic?: string;
  phoneNumber?: string;
  address?: string;
  companyName?: string;
  ntn?: string;
  secpRegistrationNo?: string;
  refundDays?: number;
  feeAmount?: number;
  securityDeposit?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  operatingHours?: string;
  billingFrequency?: string;
  overrideEmail?: string;
  centerName?: string;
  vendorLegalName?: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorNtn?: string;
};

export type MarkAgreementSignedPayload = {
  agreementId: number;
  quotationId?: number;
  note?: string;
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

export function normalizeAgreement(raw: any): AgreementRecord {
  return {
    id: raw?.id ?? raw?.Id ?? raw?.agreementId ?? raw?.AgreementId,
    quotationId: raw?.quotationId ?? raw?.QuotationId,
    quotationNumber:
      raw?.quotationNumber ?? raw?.QuotationNumber ?? String(raw?.quotationId ?? ""),
    customerId: raw?.customerId ?? raw?.CustomerId,
    customerName: raw?.customerName ?? raw?.CustomerName ?? "",
    customerEmail: raw?.customerEmail ?? raw?.CustomerEmail ?? "",
    spaceName: raw?.spaceName ?? raw?.SpaceName ?? "",
    locationName: raw?.locationName ?? raw?.LocationName ?? "",
    status: raw?.status ?? raw?.Status ?? "Pending",
    sentAt: raw?.sentAt ?? raw?.SentAt ?? "",
    signedAt: raw?.signedAt ?? raw?.SignedAt ?? "",
    contractStartDate: raw?.contractStartDate ?? raw?.ContractStartDate ?? "",
    contractEndDate: raw?.contractEndDate ?? raw?.ContractEndDate ?? "",
    feeAmount: Number(raw?.feeAmount ?? raw?.FeeAmount ?? 0),
    securityDeposit: Number(raw?.securityDeposit ?? raw?.SecurityDeposit ?? 0),
    pdfUrl: raw?.pdfUrl ?? raw?.PdfUrl ?? "",
    signedPdfUrl: raw?.signedPdfUrl ?? raw?.SignedPdfUrl ?? "",
    createdAt: raw?.createdAt ?? raw?.CreatedAt ?? "",
    updatedAt: raw?.updatedAt ?? raw?.UpdatedAt ?? "",
    ...raw,
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * GET /api/Agreement/my
 * Fetch the logged-in customer's agreements (uses x-user-email header).
 */
export async function getMyAgreements(): Promise<AgreementRecord[]> {
  const raw = await apiRequest<any>(API_ENDPOINTS.agreement.my, {
    method: "GET",
    requiresAuth: true,
  });
  const items: any[] = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? [];
  return items.map(normalizeAgreement);
}

/**
 * GET /api/Agreement (admin / paginated)
 */
export async function getAgreements(
  page = 1,
  limit = 10,
  search?: string,
  status?: string,
): Promise<{ data: AgreementRecord[]; total: number; page: number; limit: number }> {
  const path = API_ENDPOINTS.agreement.list(page, limit, search, status);
  const raw = await apiRequest<any>(path, { method: "GET", requiresAuth: true });
  const items: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : raw?.items ?? [];
  const total = Number(raw?.total ?? items.length);
  return {
    data: items.map(normalizeAgreement),
    total,
    page: Number(raw?.page ?? page),
    limit: Number(raw?.limit ?? limit),
  };
}

/**
 * POST /api/Agreement/send
 * Generate and send an agreement to the customer (Sales / Admin).
 */
export async function sendAgreement(
  payload: SendAgreementPayload,
): Promise<AgreementRecord> {
  const raw = await apiRequest<any>(API_ENDPOINTS.agreement.send, {
    method: "POST",
    requiresAuth: true,
    body: payload,
  });
  return normalizeAgreement(raw);
}

/**
 * POST /api/Agreement/my/{id}/upload-signed  (multipart/form-data)
 * Customer uploads their signed PDF. Status becomes SignedUploaded.
 * Booking is created when admin confirms.
 */
export async function uploadSignedAgreement(
  id: number | string,
  fileUri: string,
  fileName = "signed_agreement.pdf",
  mimeType = "application/pdf",
): Promise<void> {
  const token = await getToken();
  const user = await getUser();

  const formData = new FormData();
  formData.append("file", { uri: fileUri, name: fileName, type: mimeType } as any);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "multipart/form-data",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (user?.email) {
    headers["X-User-Email"] = user.email;
    headers["x-user-email"] = user.email;
  }

  const url = `${API_BASE_URL}${API_ENDPOINTS.agreement.myUploadSigned(id)}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
    credentials: "omit",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Upload failed");
    throw new Error(text || `Upload failed (${res.status})`);
  }
}

/**
 * POST /api/Agreement/{id}/mark-signed  (admin)
 */
export async function markAgreementSigned(
  id: number | string,
  payload: MarkAgreementSignedPayload,
): Promise<void> {
  await apiRequest<unknown>(API_ENDPOINTS.agreement.markSigned(id), {
    method: "POST",
    requiresAuth: true,
    body: payload,
  });
}

/** URL helper — agreement PDF for customer view */
export function getAgreementPdfUrl(id: number | string): string {
  return `${API_BASE_URL}${API_ENDPOINTS.agreement.myPdf(id)}`;
}

/** URL helper — customer's uploaded signed PDF */
export function getSignedPdfUrl(id: number | string): string {
  return `${API_BASE_URL}${API_ENDPOINTS.agreement.mySignedPdf(id)}`;
}

