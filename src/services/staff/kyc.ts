import { STAFF_ENDPOINTS } from "./endpoints";
import { downloadStaffFile, staffGet, staffPost, type DownloadedFile } from "./http";
import { num, optStr, str, toList, toPage, withQuery, type Page } from "./normalize";
import { safeFileName } from "../../utils/fileName";

// KYC portal (CMS kyc.service.ts; API KycController, policy KycAccessPolicy: super admin, admin, sales
// executive; verify / reject: admin and super admin only, the customer page says so in canVerifyAndReject).
// The customer page and the upload already live in services/kycService.ts (used by KycDocumentsScreen) and are
// re-exported here. Notes: KYC scoping uses the user's PRIMARY location only, so a new customer with no booking
// may be missing here for an admin / sales executive although it shows under Customers; responses are plain
// objects ({ items, total } / { success, message }), not ApiResponse envelopes.
export {
  KYC_MAX_FILE_BYTES,
  KYC_REQUIRED,
  KYC_STATUS,
  getCustomerKyc,
  uploadKycDocument,
  type CustomerKyc,
  type KycChecklistGroup,
  type KycChecklistItem,
  type KycDocumentTypeOption,
  type KycFile,
  type KycUploadedDocument,
  type KycUploadInput,
} from "../kycService";

export type KycListItem = {
  id: number;
  idGuid: string;
  code: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phoneNumber: string | null;
  /** Individual | Business */
  category: string;
  totalActiveDocs: number;
  verifiedDocsCount: number;
  pendingDocsCount: number;
  rejectedDocsCount: number;
  completenessPercentage: number;
  completenessStatus: string;
  /** Not Uploaded | Action Required | Under Review | Verified */
  overallStatus: string;
  createdAt: string | null;
};

export function normalizeKycListItem(raw: any): KycListItem {
  return {
    id: num(raw, "id"),
    idGuid: str(raw, "idGUID", "idGuid"),
    code: str(raw, "code"),
    fullName: str(raw, "fullName"),
    company: optStr(raw, "company"),
    email: optStr(raw, "email"),
    phoneNumber: optStr(raw, "phoneNumber"),
    category: str(raw, "category") || "Individual",
    totalActiveDocs: num(raw, "totalActiveDocs"),
    verifiedDocsCount: num(raw, "verifiedDocsCount"),
    pendingDocsCount: num(raw, "pendingDocsCount"),
    rejectedDocsCount: num(raw, "rejectedDocsCount"),
    completenessPercentage: num(raw, "completenessPercentage"),
    completenessStatus: str(raw, "completenessStatus"),
    overallStatus: str(raw, "overallStatus") || "Not Uploaded",
    createdAt: optStr(raw, "createdAt"),
  };
}

/** GET kyc?page=&limit=&search= — customers with their KYC counts ({ items, total, page, limit }). */
export async function listKycCustomers(query: { page?: number; limit?: number; search?: string } = {}): Promise<Page<KycListItem>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.kyc.list, { page, limit, search: query.search?.trim() }));
  return toPage(raw, normalizeKycListItem, { page, limit });
}

const resultMessage = (raw: any, fallback: string) => optStr(raw, "message") ?? fallback;

/** POST kyc/verify { documentId, status: 1 } — admin / super admin. */
export async function verifyKycDocument(documentId: number): Promise<string> {
  const raw = await staffPost(STAFF_ENDPOINTS.kyc.verify, { documentId, status: 1 });
  return resultMessage(raw, "Document verified.");
}

/** POST kyc/reject { documentId, status: 2, remarks } — admin / super admin; remarks are required. */
export async function rejectKycDocument(documentId: number, remarks: string): Promise<string> {
  const text = remarks?.trim() ?? "";
  if (!text) throw new Error("Rejection remarks are mandatory.");
  const raw = await staffPost(STAFF_ENDPOINTS.kyc.reject, { documentId, status: 2, remarks: text });
  return resultMessage(raw, "Document rejected.");
}

export type KycDocumentVersion = {
  id: number;
  versionNo: number;
  originalFileName: string;
  /** 0 Pending, 1 Verified, 2 Rejected */
  status: number;
  isActive: boolean;
  remarks: string | null;
  uploadedByName: string | null;
  uploadedOn: string | null;
  verifiedByName: string | null;
  verifiedOn: string | null;
};

/** GET kyc/history/{customerId}/{documentTypeId}/{slotNo} — every version of a document, newest first. */
export async function getKycDocumentHistory(customerId: number, documentTypeId: number, slotNo = 1): Promise<KycDocumentVersion[]> {
  const raw = await staffGet(STAFF_ENDPOINTS.kyc.history(customerId, documentTypeId, slotNo));
  return toList(raw, (d) => ({
    id: num(d, "id"),
    versionNo: num(d, "versionNo"),
    originalFileName: str(d, "originalFileName"),
    status: num(d, "status"),
    isActive: d?.isActive !== false && d?.IsActive !== false,
    remarks: optStr(d, "remarks"),
    uploadedByName: optStr(d, "uploadedByName"),
    uploadedOn: optStr(d, "uploadedOn"),
    verifiedByName: optStr(d, "verifiedByName"),
    verifiedOn: optStr(d, "verifiedOn"),
  }));
}

/**
 * GET kyc/document/{id}/download — the document file (PDF / JPG / PNG), downloaded with the login token.
 * `fileName` is the uploader's originalFileName from the server: cleaned (no folders, odd characters) before
 * it becomes a file name on the device.
 */
export function downloadKycDocument(documentId: number, fileName?: string | null): Promise<DownloadedFile> {
  return downloadStaffFile(STAFF_ENDPOINTS.kyc.document(documentId), {
    fileName: safeFileName(fileName, `KYC-Document-${documentId}`),
    mimeType: "application/octet-stream",
  });
}
