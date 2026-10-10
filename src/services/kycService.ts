import { API_BASE_URL, API_ENDPOINTS, buildApiPath } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import { getToken, getUser } from "../utils/authStorage";

// Same shapes the website's KYC page uses (WorkNest_FE src/app/services/kyc.service.ts).

/** Document status as the API stores it: 0 Pending, 1 Verified, 2 Rejected. */
export const KYC_STATUS = { pending: 0, verified: 1, rejected: 2 } as const;
/** Requirement level per customer category: 0 not applicable, 1 optional, 2 required. */
export const KYC_REQUIRED = 2;

/** Server limit (KycStorage:MaxFileSizeBytes, 5 MB) and formats (PDF / JPG / PNG, checked by magic bytes). */
export const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type KycDocumentTypeOption = {
  id: number;
  code: string;
  name: string;
  displayLabel: string;
  groupCode?: string | null;
  alternativeCode?: string | null;
  allowMultiple: boolean;
  requiresHolderName: boolean;
  requiresExpiry: boolean;
  isRequired: boolean;
  isUploaded: boolean;
  existingDocumentId?: number | null;
  sortOrder: number;
};

export type KycPersonSlot = { slotNo: number; displayName: string; holderName?: string | null };

export type KycChecklistItem = {
  documentTypeId: number;
  code: string;
  name: string;
  requirementLevel: number;
  isUploaded: boolean;
  status?: number | null;
  statusLabel?: string | null;
  documentId?: number | null;
  slotNo: number;
  holderName?: string | null;
  expiryDate?: string | null;
};

export type KycChecklistGroup = {
  groupCode?: string | null;
  title: string;
  isRequired: boolean;
  isSatisfied: boolean;
  statusSummary: string;
  items: KycChecklistItem[];
};

export type KycUploadedDocument = {
  id: number;
  documentTypeId: number;
  documentTypeName?: string | null;
  slotNo: number;
  holderName?: string | null;
  originalFileName: string;
  expiryDate?: string | null;
  versionNo: number;
  isActive: boolean;
  status: number;
  remarks?: string | null;
  uploadedOn: string;
};

export type CustomerKyc = {
  customerId: number;
  customerCode: string;
  fullName: string;
  company?: string | null;
  category: string;
  completenessPercentage: number;
  overallStatus: string;
  availableDocumentTypes: KycDocumentTypeOption[];
  existingPersonSlots: KycPersonSlot[];
  checklistGroups: KycChecklistGroup[];
  uploadedDocuments: KycUploadedDocument[];
};

export type KycCustomerListItem = {
  id: number;
  idGUID: string;
  fullName: string;
  totalActiveDocs: number;
  verifiedDocsCount: number;
  pendingDocsCount: number;
  rejectedDocsCount: number;
  completenessPercentage: number;
  completenessStatus: string;
  overallStatus: string;
};

export type KycFile = { uri: string; name: string; type: string };

export type KycUploadInput = {
  customerId: number;
  documentTypeId: number;
  slotNo?: number;
  holderName?: string;
  /** yyyy-MM-dd */
  expiryDate?: string;
  file: KycFile;
};

function friendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "Your account isn't allowed to manage KYC documents.";
    if (err.message && err.message !== "Request failed") return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** GET /api/kyc/{id} — the customer's checklist, document types and uploaded documents. */
export async function getCustomerKyc(customerIdOrGuid: number | string): Promise<CustomerKyc> {
  try {
    const data = await apiRequest<CustomerKyc>(buildApiPath(API_ENDPOINTS.kyc.customer(customerIdOrGuid)), {
      requiresAuth: true,
      unwrapData: false,
    });
    return {
      ...data,
      availableDocumentTypes: data?.availableDocumentTypes ?? [],
      existingPersonSlots: data?.existingPersonSlots ?? [],
      checklistGroups: data?.checklistGroups ?? [],
      uploadedDocuments: data?.uploadedDocuments ?? [],
    };
  } catch (err) {
    throw new Error(friendlyMessage(err, "Could not load KYC documents. Please try again."));
  }
}

/** GET /api/kyc — KYC counts per customer (for the badges on the customer list). */
export async function getKycCustomers(limit = 200): Promise<KycCustomerListItem[]> {
  const res = await apiRequest<{ items?: KycCustomerListItem[] }>(buildApiPath(API_ENDPOINTS.kyc.list(1, limit)), {
    requiresAuth: true,
    unwrapData: false,
  });
  return res?.items ?? [];
}

/**
 * POST /api/kyc/upload (multipart/form-data) with the same field names the website sends:
 * CustomerId, DocumentTypeId, SlotNo, HolderName, ExpiryDate, File.
 * Uses XMLHttpRequest so the screen can show upload progress (0..1).
 */
export async function uploadKycDocument(
  input: KycUploadInput,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const token = await getToken();
  const user = await getUser();

  const form = new FormData();
  form.append("CustomerId", String(input.customerId));
  form.append("DocumentTypeId", String(input.documentTypeId));
  form.append("SlotNo", String(input.slotNo && input.slotNo > 0 ? input.slotNo : 1));
  if (input.holderName?.trim()) form.append("HolderName", input.holderName.trim());
  if (input.expiryDate) form.append("ExpiryDate", input.expiryDate);
  form.append("File", { uri: input.file.uri, name: input.file.name, type: input.file.type } as any);

  const url = `${API_BASE_URL}${buildApiPath(API_ENDPOINTS.kyc.upload)}`;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (user?.email) xhr.setRequestHeader("X-User-Email", user.email);
    // No Content-Type: React Native sets multipart/form-data with the boundary itself.

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      };
    }

    xhr.onload = () => {
      let payload: any = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      const message: string | undefined =
        typeof payload?.message === "string" && payload.message.trim() ? payload.message : undefined;
      if (xhr.status >= 200 && xhr.status < 300 && payload?.success !== false) {
        resolve(message ?? "Document uploaded.");
        return;
      }
      if (xhr.status === 401) return reject(new Error("Your session has expired. Please log in again."));
      if (xhr.status === 403) return reject(new Error("Your account isn't allowed to upload KYC documents."));
      if (xhr.status === 413) return reject(new Error("The file is too large. Please retake the photo."));
      reject(new Error(message ?? `Upload failed (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Please try again."));
    xhr.timeout = 120000;

    xhr.send(form);
  });
}
