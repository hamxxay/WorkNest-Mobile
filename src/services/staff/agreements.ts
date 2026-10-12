import { STAFF_ENDPOINTS } from "./endpoints";
import {
  actionResult,
  downloadStaffFile,
  staffGet,
  staffPost,
  staffUpload,
  type ActionResult,
  type DownloadedFile,
  type UploadFile,
} from "./http";
import { isApiDate, num, optNum, optStr, str, toPage, unwrapEnvelope, withQuery, type Page } from "./normalize";
import { cnicError } from "../../utils/cnic";
import { phoneError } from "../../utils/phone";

// Lease agreements (CMS agreement.service.ts + manage.ts agreements; API AgreementController, reachable as
// api/agreement/... and api/agreements/...). Roles: admin, super admin, sales executive (not receptionist).
// The list is NOT location-filtered by the API.
//
// Flow: send (from an accepted quotation) -> customer e-signs or uploads the signed copy (SignedUploaded), or
// staff upload it -> staff "sign" (scan + signed date) or "mark signed" -> the API creates the booking
// (bookingId set). The list has no customerEmail / spaceName / hasSignedPdf: use signedPdfUploadedAt.

export type AgreementStatus = "AgreementSent" | "EmailFailed" | "SignedUploaded" | "Signed" | "Sent" | "Converted" | string;

export type StaffAgreement = {
  id: number;
  quotationId: number | null;
  quotationNumber: string | null;
  /** Set once the booking was created from the signed agreement. */
  bookingId: number | null;
  customerId: number | null;
  entityType: string | null;
  status: AgreementStatus;
  /** CMS wording, e.g. "Signed copy received - verify". */
  statusLabel: string;
  sentDate: string | null;
  signedDate: string | null;
  createdOn: string | null;
  refundDays: number | null;
  feeAmount: number;
  securityDeposit: number;
  operatingHours: string | null;
  customerName: string;
  customerCnic: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  companyName: string | null;
  ntn: string | null;
  secpRegistrationNo: string | null;
  templateName: string | null;
  signedPdfUploadedAt: string | null;
  hasSignedPdf: boolean;
  reminderCount: number;
  lastReminderAt: string | null;
  eSignedBy: string | null;
  eSignedAt: string | null;
};

/** Status text the CMS shows (manage.ts agreements). */
export function agreementStatusLabel(status: string | null | undefined, bookingId: number | null, eSignedAt?: string | null): string {
  let label: string;
  if (bookingId) label = "Signed - booking created";
  else {
    switch ((status ?? "").toLowerCase()) {
      case "agreementsent":
      case "sent":
        label = "Sent";
        break;
      case "signeduploaded":
        label = "Signed copy received - verify";
        break;
      case "emailfailed":
        label = "Email failed - resend";
        break;
      case "signed":
      case "converted":
        label = "Signed";
        break;
      default:
        label = status || "Sent";
    }
  }
  return eSignedAt ? `${label} (e-signed)` : label;
}

export function normalizeAgreement(raw: any): StaffAgreement {
  const bookingId = optNum(raw, "bookingId");
  const status = str(raw, "status");
  const eSignedAt = optStr(raw, "eSignedAt", "esignedAt");
  const signedPdfUploadedAt = optStr(raw, "signedPdfUploadedAt");
  return {
    id: num(raw, "id", "agreementId"),
    quotationId: optNum(raw, "quotationId"),
    quotationNumber: optStr(raw, "quotationNumber"),
    bookingId: bookingId && bookingId > 0 ? bookingId : null,
    customerId: optNum(raw, "customerId"),
    entityType: optStr(raw, "entityType"),
    status,
    statusLabel: agreementStatusLabel(status, bookingId && bookingId > 0 ? bookingId : null, eSignedAt),
    sentDate: optStr(raw, "sentDate"),
    signedDate: optStr(raw, "signedDate"),
    createdOn: optStr(raw, "createdOn"),
    refundDays: optNum(raw, "refundDays"),
    feeAmount: num(raw, "feeAmount"),
    securityDeposit: num(raw, "securityDeposit"),
    operatingHours: optStr(raw, "operatingHours"),
    customerName: str(raw, "customerName", "companyName"),
    customerCnic: optStr(raw, "customerCnic"),
    customerPhone: optStr(raw, "customerPhone"),
    customerAddress: optStr(raw, "customerAddress"),
    companyName: optStr(raw, "companyName"),
    ntn: optStr(raw, "ntn"),
    secpRegistrationNo: optStr(raw, "secpRegistrationNo"),
    templateName: optStr(raw, "templateName"),
    signedPdfUploadedAt,
    hasSignedPdf: !!signedPdfUploadedAt || !!optStr(raw, "signedPdfPath"),
    reminderCount: num(raw, "reminderCount"),
    lastReminderAt: optStr(raw, "lastReminderAt"),
    eSignedBy: optStr(raw, "eSignedBy", "esignedBy"),
    eSignedAt,
  };
}

/** GET agreement?page=&limit=&search=&status= — search: customer, company, quotation number, CNIC; status exact. */
export async function listAgreements(
  query: { page?: number; limit?: number; search?: string; status?: string } = {},
): Promise<Page<StaffAgreement>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.agreements.list, { page, limit, search: query.search?.trim(), status: query.status }),
  );
  return toPage(raw, normalizeAgreement, { page, limit });
}

// ─── Send ─────────────────────────────────────────────────────────────────────────────────────────────────

export type SendAgreementInput = {
  quotationId: number;
  entityType: "Individual" | "Company" | "AOP";
  fullName?: string;
  cnic?: string;
  phoneNumber?: string;
  address?: string;
  companyName?: string;
  ntn?: string;
  secpRegistrationNo?: string;
  /** CMS default 30. */
  refundDays?: number;
  feeAmount?: number;
  securityDeposit?: number;
  /** yyyy-MM-dd */
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  /** CMS default "24/7". */
  operatingHours?: string;
  billingFrequency?: string;
  /** Send to this address instead of the customer's. */
  overrideEmail?: string;
};

/** First problem with the input, or null (same CNIC / phone rules as the API). */
export function validateSendAgreement(input: SendAgreementInput): string | null {
  if (!(input.quotationId > 0)) return "Choose the quotation.";
  const cnic = cnicError(input.cnic ?? "");
  if (cnic) return cnic;
  const phone = phoneError(input.phoneNumber ?? "");
  if (phone) return phone;
  if (input.contractStartDate && !isApiDate(input.contractStartDate)) return "Choose a valid contract start date.";
  if (input.contractEndDate && !isApiDate(input.contractEndDate)) return "Choose a valid contract end date.";
  return null;
}

/** POST agreement/send — generates the lease PDF and emails it to the customer. */
export async function sendAgreement(input: SendAgreementInput): Promise<ActionResult<StaffAgreement>> {
  const invalid = validateSendAgreement(input);
  if (invalid) throw new Error(invalid);
  const text = (v?: string | null) => v?.trim() || null;
  const raw = await staffPost(STAFF_ENDPOINTS.agreements.send, {
    quotationId: input.quotationId,
    entityType: input.entityType,
    fullName: text(input.fullName),
    cnic: text(input.cnic),
    phoneNumber: text(input.phoneNumber),
    address: text(input.address),
    companyName: text(input.companyName),
    ntn: text(input.ntn),
    secpRegistrationNo: text(input.secpRegistrationNo),
    refundDays: input.refundDays ?? 30,
    feeAmount: input.feeAmount ?? null,
    securityDeposit: input.securityDeposit ?? null,
    contractStartDate: input.contractStartDate || null,
    contractEndDate: input.contractEndDate || null,
    operatingHours: input.operatingHours ?? "24/7",
    billingFrequency: text(input.billingFrequency),
    overrideEmail: text(input.overrideEmail),
  });
  const result = actionResult<any>(raw, "Agreement sent.");
  return { message: result.message, data: normalizeAgreement(result.data) };
}

// ─── Signing ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * POST agreement/{id}/sign (multipart: file, signedDate, note) — saves the signed copy and creates the booking
 * dated on the signed date. `file` may be left out only when the customer already uploaded the signed copy.
 * signedDate: yyyy-MM-dd, not in the future and not before the agreement was sent.
 */
export async function signAgreement(
  id: number | string,
  input: { signedDate: string; file?: UploadFile | null; note?: string },
): Promise<ActionResult<StaffAgreement>> {
  if (!isApiDate(input.signedDate)) throw new Error("Enter the date written on the signed agreement.");
  const raw = await staffUpload(STAFF_ENDPOINTS.agreements.sign(id), {
    file: input.file ?? null,
    signedDate: input.signedDate,
    note: input.note?.trim() || null,
  });
  const result = actionResult<any>(raw, "Signed agreement saved.");
  return { message: result.message, data: normalizeAgreement(result.data) };
}

/** POST agreement/{id}/mark-signed { note } — needs the signed copy on file; creates the booking. */
export async function markAgreementSigned(id: number | string, note?: string): Promise<ActionResult<StaffAgreement>> {
  const raw = await staffPost(STAFF_ENDPOINTS.agreements.markSigned(id), note?.trim() ? { note: note.trim() } : {});
  const result = actionResult<any>(raw, "Agreement marked as signed.");
  return { message: result.message, data: normalizeAgreement(result.data) };
}

/** POST agreement/{id}/upload-signed (multipart: file, PDF up to 10 MB) — stores the signed copy only. */
export async function uploadSignedAgreement(id: number | string, file: UploadFile): Promise<ActionResult> {
  const raw = await staffUpload(STAFF_ENDPOINTS.agreements.uploadSigned(id), { file });
  return actionResult(raw, "Signed agreement uploaded.");
}

export type AgreementESignature = {
  agreementId: number;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  documentSha256: string | null;
  /** "data:image/png;base64,..." */
  signatureImage: string | null;
};

/** GET agreement/{id}/esignature — null when the agreement was not e-signed. */
export async function getAgreementESignature(id: number | string): Promise<AgreementESignature | null> {
  const d = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.agreements.esignature(id)));
  if (!d) return null;
  return {
    agreementId: num(d, "agreementId"),
    signerName: optStr(d, "signerName"),
    signerEmail: optStr(d, "signerEmail"),
    signedAt: optStr(d, "signedAt"),
    ipAddress: optStr(d, "ipAddress"),
    documentSha256: optStr(d, "documentSha256"),
    signatureImage: optStr(d, "signatureImage"),
  };
}

/** GET agreement/{id}/pdf — the generated agreement, downloaded with the login token. */
export function downloadAgreementPdf(id: number | string): Promise<DownloadedFile> {
  return downloadStaffFile(STAFF_ENDPOINTS.agreements.pdf(id), { fileName: `Agreement-${id}.pdf`, mimeType: "application/pdf" });
}

/** GET agreement/{id}/signed-pdf — the signed copy (404 when none is on file). */
export function downloadSignedAgreementPdf(id: number | string): Promise<DownloadedFile> {
  return downloadStaffFile(STAFF_ENDPOINTS.agreements.signedPdf(id), {
    fileName: `Signed-Agreement-${id}.pdf`,
    mimeType: "application/pdf",
  });
}
