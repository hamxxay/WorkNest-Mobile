import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiDownload, apiRequest, apiUpload } from "./apiClient";
import { sharePdf } from "./pdfService";

// Customer agreements, like the website's My Agreements + e-sign panel:
//   GET  /Agreement/my                     my agreements
//   GET  /Agreement/my/{id}/pdf            the agreement (with the sign-in token)
//   GET  /Agreement/my/{id}/signed-pdf     the signed copy
//   POST /Agreement/my/{id}/esign          sign electronically: drawn or typed signature as a PNG
//   POST /Agreement/my/{id}/upload-signed  upload a signed PDF + the date it was signed (staff verify it)
// The staff functions further down (list, send, mark signed) are used by the sales / admin screens.

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
    sentAt: raw?.sentAt ?? raw?.SentAt ?? raw?.sentDate ?? raw?.SentDate ?? "",
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

// ─── E-signature ──────────────────────────────────────────────────────────────

/** Statuses the API accepts for e-signing (see AgreementController.ESignMyAgreement). */
const SIGNABLE_STATUSES = ["agreementsent", "sent", "emailfailed"];

function hasBooking(agreement: AgreementRecord): boolean {
  return agreement.bookingId !== undefined && agreement.bookingId !== null && agreement.bookingId !== "";
}

function statusKey(agreement: AgreementRecord): string {
  return String(agreement.status ?? "").toLowerCase().replace(/\s/g, "");
}

/**
 * A newer agreement was sent for the same quotation: only the latest one can be signed (the API refuses older
 * ones). Same rule as the website.
 */
export function isAgreementSuperseded(agreement: AgreementRecord, all: AgreementRecord[]): boolean {
  const quotationId = Number(agreement.quotationId);
  const id = Number(agreement.id);
  if (!Number.isFinite(quotationId) || !Number.isFinite(id)) return false;
  return all.some((other) => Number(other.quotationId) === quotationId && Number(other.id) > id);
}

/**
 * True when the customer can still sign this agreement in the app (pass the whole list to also rule out
 * superseded agreements).
 */
export function isAgreementSignable(agreement: AgreementRecord, all?: AgreementRecord[]): boolean {
  if (hasBooking(agreement)) return false;
  if (all && isAgreementSuperseded(agreement, all)) return false;
  return SIGNABLE_STATUSES.includes(statusKey(agreement));
}

/** Where an agreement stands for the customer (website My Agreements). */
export type AgreementStage = "sign" | "review" | "booked" | "other";

export function agreementStage(agreement: AgreementRecord): AgreementStage {
  if (hasBooking(agreement)) return "booked";
  const status = statusKey(agreement);
  if (status === "signeduploaded" || agreement.hasSignedCopy === true || agreement.HasSignedCopy === true) return "review";
  if (SIGNABLE_STATUSES.includes(status)) return "sign";
  return "other";
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
 * Downloads the agreement PDF (with the sign-in token) and returns it as a
 * "data:application/pdf;base64,..." URL that react-native-share can open.
 */
export async function downloadMyAgreementPdf(id: number | string): Promise<string> {
  const file = await apiDownload(API_ENDPOINTS.agreement.myPdf(id));
  // Normalise the MIME type (some servers send application/octet-stream).
  return `data:application/pdf;base64,${file.base64}`;
}

/** The agreement PDF in the share / viewer sheet (read it before signing, print it to sign by hand). */
export async function openMyAgreementPdf(id: number | string): Promise<void> {
  const file = await apiDownload(API_ENDPOINTS.agreement.myPdf(id));
  await sharePdf(file, `WorkNest-Agreement-${id}`, `WorkNest Agreement #${id}`);
}

/** GET /api/Agreement/my/{id}/signed-pdf — the signed copy (uploaded or e-signed), in the share sheet. */
export async function openMySignedAgreementPdf(id: number | string): Promise<void> {
  const file = await apiDownload(API_ENDPOINTS.agreement.mySignedPdf(id));
  await sharePdf(file, `WorkNest-Agreement-${id}-signed`, `Signed agreement #${id}`);
}

// ─── Signed copy upload ───────────────────────────────────────────────────────

/** Largest signed PDF the API accepts (AgreementController: 10 MB). */
export const MAX_SIGNED_PDF_BYTES = 10 * 1024 * 1024;

export type SignedPdfFile = {
  /** content:// or file:// URI from a document picker. */
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
};

function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Today as yyyy-MM-dd (the default "date I signed"). */
export function todayIsoDate(): string {
  return localIsoDate(new Date());
}

/**
 * Checks a signed copy before upload, with the API's rules: a PDF, at most 10 MB, a signed date that is not in
 * the future and not before the agreement was sent. Returns the message to show, or null when it is fine.
 */
export function signedUploadError(file: SignedPdfFile | null, signedDate: string, sentAt?: string | null): string | null {
  if (!file?.uri) return "Choose the signed agreement (PDF).";
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (!(type === "application/pdf" || name.endsWith(".pdf"))) return "Please choose a PDF file.";
  if (file.size != null && file.size > MAX_SIGNED_PDF_BYTES) return "The file is larger than 10 MB.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedDate)) return "Enter the date you signed the agreement.";
  if (signedDate > todayIsoDate()) return "The signed date cannot be in the future.";
  const sent = (sentAt ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sent) && signedDate < sent) {
    return "The signed date cannot be before the agreement was sent.";
  }
  return null;
}

/**
 * POST /api/Agreement/my/{id}/upload-signed (multipart: file + signedDate).
 * The customer printed, signed and scanned the agreement; it is held as SignedUploaded until staff verify it
 * and create the booking. Resolves with the API's message; throws a readable ApiError otherwise.
 */
export async function uploadSignedAgreement(
  id: number | string,
  file: SignedPdfFile,
  signedDate: string,
  sentAt?: string | null,
): Promise<string> {
  const problem = signedUploadError(file, signedDate, sentAt);
  if (problem) throw new ApiError(problem, 400);

  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name || `signed-agreement-${id}.pdf`,
    type: "application/pdf",
  } as unknown as Blob);
  form.append("signedDate", signedDate);

  const payload = await apiUpload<{ message?: string }>(API_ENDPOINTS.agreement.myUploadSigned(id), form, {
    unwrapData: false,
  });
  return (
    (typeof payload?.message === "string" && payload.message.trim()) ||
    "Your signed agreement was received. We will verify it and confirm your booking."
  );
}
