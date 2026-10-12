import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import {
  sanitizeEmailInput,
  sanitizeMessageInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizeSearchInput,
} from "../utils/inputSanitizer";

type ApiResponse<T> = {
  isSuccessful?: boolean;
  data?: T;
  message?: string;
};

function ensureSuccess<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response?.isSuccessful && response.data !== undefined) {
    return response.data;
  }

  if (response?.isSuccessful) {
    return {} as T;
  }

  throw new Error(response?.message || fallbackMessage);
}

// ─── Tour inquiries (staff: admin / sales executive) ─────────────────────────

export type InquiryOutcome = "not_interested" | "future_prospect" | "converted";

export type TourInquiry = {
  id: number | null;
  publicId: string | null;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  contactType: string;
  createdAt: string;
  statusId: number;
  feedbackOutcome: InquiryOutcome | null;
  feedbackReason: string | null;
  followUpOn: string | null;
  followUpDue: boolean;
  quotationId: number | null;
};

export type TourInquiryPage = {
  items: TourInquiry[];
  total: number;
};

export type InquiryFeedbackRequest = {
  outcome: InquiryOutcome;
  reason?: string | null;
  followUpOn?: string | null; // yyyy-MM-dd
  quotationId?: number | null;
};

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

// The list rows come from a stored procedure, so the column names are read the same tolerant way as the website.
function normalizeInquiry(raw: any): TourInquiry {
  const c = raw ?? {};
  const statusRaw = c.statusId ?? c.StatusId ?? c.status ?? c.Status;
  const statusId = Number(statusRaw);
  const outcome = text(c.feedbackOutcome ?? c.FeedbackOutcome);
  const quotationId = Number(c.quotationId ?? c.QuotationId);
  const id = Number(c.id ?? c.Id ?? c.contactId ?? c.ContactId);
  return {
    id: id > 0 ? id : null,
    publicId: text(c.publicId ?? c.PublicId) || null,
    fullName: text(c.fullName ?? c.FullName ?? c.name ?? c.Name ?? c.customerName),
    email: text(c.email ?? c.Email ?? c.customerEmail),
    phone: text(c.phone ?? c.Phone ?? c.phoneNumber ?? c.PhoneNumber ?? c.customerPhone),
    message: text(c.message ?? c.Message ?? c.notes ?? c.Notes),
    contactType: text(c.contactType ?? c.ContactType),
    createdAt: text(c.createdAt ?? c.CreatedAt ?? c.createdOn ?? c.CreatedOn ?? c.createdDate ?? c.CreatedDate),
    statusId: Number.isFinite(statusId) && statusId > 0 ? statusId : 1,
    feedbackOutcome:
      outcome === "not_interested" || outcome === "future_prospect" || outcome === "converted"
        ? outcome
        : null,
    feedbackReason: text(c.feedbackReason ?? c.FeedbackReason) || null,
    followUpOn: text(c.followUpOn ?? c.FollowUpOn) || null,
    followUpDue: !!(c.followUpDue ?? c.FollowUpDue),
    quotationId: quotationId > 0 ? quotationId : null,
  };
}

/** GET /api/contact?page=&limit=&search= — inquiries with their latest feedback ({ data, total }). */
export async function getTourInquiries(page = 1, limit = 100, search?: string): Promise<TourInquiryPage> {
  const query = search ? sanitizeSearchInput(search) : "";
  const response = await apiRequest<any>(API_ENDPOINTS.contact.list(page, limit, query || undefined), {
    method: "GET",
    requiresAuth: true,
    unwrapData: false,
  });
  if (response?.isSuccessful === false) {
    throw new Error(response?.message || "Unable to load tour inquiries.");
  }
  const rows: any[] = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : [];
  const items = rows.map(normalizeInquiry);
  const total = Number(response?.total ?? response?.Total ?? response?.totalCount);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

/** POST /api/book-tour — an inquiry entered by staff (phone call / walk-in), saved like the website's form. */
export async function createTourInquiry(payload: {
  fullName: string;
  email?: string;
  phone: string;
  message?: string;
}) {
  const fullName = sanitizeNameInput(payload.fullName, "Full name");
  const email = payload.email?.trim() ? sanitizeEmailInput(payload.email) : "";
  const phone = sanitizePhoneInput(payload.phone);
  const message = payload.message?.trim() ? sanitizeMessageInput(payload.message) : "";
  const response = await apiRequest<ApiResponse<{ id?: number; publicId?: string }>>(
    API_ENDPOINTS.contact.bookTour,
    {
      method: "POST",
      requiresAuth: true,
      unwrapData: false,
      body: { fullName, email, phone, message },
    },
  );
  ensureSuccess(response, "Unable to add the inquiry right now.");
  return response?.message || "Inquiry added.";
}

/**
 * POST /api/contact/{id}/feedback (number id, or the public id when the list returns only that).
 * not_interested needs a reason and closes the inquiry; future_prospect needs a follow-up date;
 * converted links the quotation. A refusal comes back as HTTP 400 with the API's message.
 */
export async function saveInquiryFeedback(
  inquiry: Pick<TourInquiry, "id" | "publicId">,
  payload: InquiryFeedbackRequest,
): Promise<string> {
  const key = inquiry.id ?? inquiry.publicId;
  if (!key) {
    throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  }
  const response = await apiRequest<ApiResponse<unknown>>(API_ENDPOINTS.contact.feedback(key), {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      outcome: payload.outcome,
      reason: payload.reason?.trim() || null,
      followUpOn: payload.followUpOn || null,
      quotationId: payload.quotationId ?? null,
    },
  });
  if (response?.isSuccessful === false) {
    throw new Error(response?.message || "Could not save the feedback.");
  }
  return response?.message || "Feedback saved.";
}
