
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest, friendlyApiMessage } from "./apiClient";
import { getToken, getUser } from "../utils/authStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgreementStatus =
  | "Pending"
  | "AgreementSent"
  | "Sent"
  | "EmailFailed"
  | "SignedUploaded"
  | "Signed"
  | "Expired"
  | "Cancelled"
  | string;

export type AgreementRecord = {
  id?: number | string;
  quotationId?: number | string;
  quotationNumber?: string;
  bookingId?: number | string | null;
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

export type ESignAgreementPayload = {
  signerName: string;
  /** "data:image/png;base64,..." */
  signatureImage: string;
  consent: boolean;
};

export type ESignAgreementResult = {
  agreementId?: number;
  /** true → booking created; false → signed copy kept for staff to confirm */
  completed: boolean;
  bookingId?: number | null;
  status?: string;
  message: string;
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
    bookingId: raw?.bookingId ?? raw?.BookingId ?? null,
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
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: formData, credentials: "omit" });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection and try again.");
  }
  if (!res.ok) {
    // Never show the raw response (it can be an HTML error page): use the API's message or a plain one.
    const text = await res.text().catch(() => "");
    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch {}
    throw new Error(friendlyApiMessage(res.status, payload));
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


// ─── E-signature ──────────────────────────────────────────────────────────────

/** Statuses the API accepts for e-signing (see AgreementController.ESignMyAgreement). */
const SIGNABLE_STATUSES = ["agreementsent", "sent", "emailfailed"];

/** True when the customer can still sign this agreement in the app. */
export function isAgreementSignable(agreement: AgreementRecord): boolean {
  if (agreement.bookingId !== undefined && agreement.bookingId !== null && agreement.bookingId !== "") return false;
  const status = String(agreement.status ?? "").toLowerCase().replace(/\s/g, "");
  return SIGNABLE_STATUSES.includes(status);
}

/**
 * POST /api/Agreement/my/{id}/esign
 * Signs the agreement electronically. Resolves with the API message
 * (booking created, or "our team will confirm"); throws with the API message on refusal.
 */
export async function eSignMyAgreement(
  id: number | string,
  payload: ESignAgreementPayload,
): Promise<ESignAgreementResult> {
  const raw = await apiRequest<any>(API_ENDPOINTS.agreement.myESign(id), {
    method: "POST",
    requiresAuth: true,
    body: payload,
    unwrapData: false,
  });
  if (!raw || raw.isSuccessful === false) {
    throw new ApiError(
      (typeof raw?.message === "string" && raw.message) || "We could not complete your signature. Please try again.",
      200,
      raw,
    );
  }
  const data = raw.data ?? {};
  const completed = Boolean(data.completed ?? data.Completed);
  return {
    agreementId: data.agreementId ?? data.AgreementId,
    completed,
    bookingId: data.bookingId ?? data.BookingId ?? null,
    status: data.status ?? data.Status,
    message:
      (typeof raw.message === "string" && raw.message) ||
      (completed
        ? "Your agreement is signed and your booking has been created."
        : "Signed. Our team will confirm your booking shortly."),
  };
}

/**
 * GET /api/Agreement/my/{id}/pdf
 * Downloads the agreement PDF (authenticated) and returns it as a
 * "data:application/pdf;base64,..." URL that react-native-share can open.
 */
export async function downloadMyAgreementPdf(id: number | string): Promise<string> {
  const token = await getToken();
  const user = await getUser();
  const headers: Record<string, string> = { Accept: "application/pdf, application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (user?.email) {
    headers["X-User-Email"] = user.email;
    headers["x-user-email"] = user.email;
  }

  let res: Response;
  try {
    res = await fetch(getAgreementPdfUrl(id), { method: "GET", headers, credentials: "omit" });
  } catch {
    throw new Error("Could not download the agreement. Check your connection and try again.");
  }
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch {}
    throw new Error(
      res.status === 429 ? "Too many downloads. Please wait a minute and try again." : friendlyApiMessage(res.status, body),
    );
  }

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the agreement PDF."));
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!base64) throw new Error("The agreement PDF is empty.");
  // Normalise the MIME type (some servers send application/octet-stream).
  return `data:application/pdf;base64,${base64}`;
}
