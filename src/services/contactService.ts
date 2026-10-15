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

/**
 * Which table a list row comes from: the old website bookings still kept in WN_BookTour ("booktour") or the
 * inquiries table WN_Contacts ("contact"). The two number their rows separately, so the same id can be on two rows:
 * rows are told apart by `key`, and every write is sent by public id (or id + source, see inquiryPath).
 */
export type InquirySource = "contact" | "booktour";

export type TourInquiry = {
  id: number | null;
  publicId: string | null;
  source: InquirySource;
  /** Unique in the list ("contact-12" / "booktour-12"), from the API; built from source + id when it sends none. */
  key: string;
  /** Branch (and Type) can be changed: only inquiries in WN_Contacts (the API's canChangeBranch). */
  canChangeBranch: boolean;
  /** Status New: the same rule as the dashboard "New inquiries" figure and the badge (the API's isNew). */
  isNew: boolean;
  /** Website | WhatsApp | WalkIn | Reference (null = not set). */
  inquiryType: string | null;
  /** Type Reference: who referred the visitor. */
  referenceName: string | null;
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
  /** Branch (WN_Locations.Id) the inquiry belongs to; null = no branch (old inquiries, general messages). */
  locationId: number | null;
  /** Branch name from the API (WN_Locations.Name); null when the inquiry has no branch. */
  locationName: string | null;
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

const positiveId = (value: unknown): number | null => {
  if (value === null || value === undefined || typeof value === "boolean" || text(value) === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** "contact" / "booktour" from the API's source; an older API: the "Book Tour" type it gives the WN_BookTour rows. */
export function inquirySource(raw: any): InquirySource {
  const c = raw ?? {};
  const source = text(c.source ?? c.Source).toLowerCase().replace(/[^a-z]/g, "");
  if (source === "booktour") return "booktour";
  if (source === "contact") return "contact";
  return text(c.contactType ?? c.ContactType).toLowerCase() === "book tour" ? "booktour" : "contact";
}

const flag = (value: unknown): boolean | null =>
  value === true || value === "true" || value === 1 ? true : value === false || value === "false" || value === 0 ? false : null;

// The list rows come from a stored procedure, so the column names are read the same tolerant way as the website.
// LocationId / LocationName come with branch routing; when the API does not send them yet the inquiry has no branch.
export function normalizeInquiry(raw: any): TourInquiry {
  const c = raw ?? {};
  const statusRaw = c.statusId ?? c.StatusId ?? c.status ?? c.Status;
  const statusId = Number(statusRaw);
  const outcome = text(c.feedbackOutcome ?? c.FeedbackOutcome);
  const quotationId = Number(c.quotationId ?? c.QuotationId);
  const id = Number(c.id ?? c.Id ?? c.contactId ?? c.ContactId);
  const source = inquirySource(c);
  const publicId = text(c.publicId ?? c.PublicId) || null;
  const feedbackOutcome: InquiryOutcome | null =
    outcome === "not_interested" || outcome === "future_prospect" || outcome === "converted" ? outcome : null;
  const normalizedStatus = Number.isFinite(statusId) && statusId > 0 ? statusId : 1;
  return {
    id: id > 0 ? id : null,
    publicId,
    source,
    key: text(c.key ?? c.Key) || `${source}-${id > 0 ? id : publicId ?? ""}`,
    canChangeBranch: flag(c.canChangeBranch ?? c.CanChangeBranch) ?? source === "contact",
    // An older API sends no isNew: New = status New and no feedback yet (as before).
    isNew: flag(c.isNew ?? c.IsNew) ?? (!feedbackOutcome && normalizedStatus === 1),
    inquiryType: text(c.inquiryType ?? c.InquiryType) || null,
    referenceName: text(c.referenceName ?? c.ReferenceName) || null,
    fullName: text(c.fullName ?? c.FullName ?? c.name ?? c.Name ?? c.customerName),
    email: text(c.email ?? c.Email ?? c.customerEmail),
    phone: text(c.phone ?? c.Phone ?? c.phoneNumber ?? c.PhoneNumber ?? c.customerPhone),
    message: text(c.message ?? c.Message ?? c.notes ?? c.Notes),
    contactType: text(c.contactType ?? c.ContactType),
    createdAt: text(c.createdAt ?? c.CreatedAt ?? c.createdOn ?? c.CreatedOn ?? c.createdDate ?? c.CreatedDate),
    statusId: normalizedStatus,
    feedbackOutcome,
    feedbackReason: text(c.feedbackReason ?? c.FeedbackReason) || null,
    followUpOn: text(c.followUpOn ?? c.FollowUpOn) || null,
    followUpDue: !!(c.followUpDue ?? c.FollowUpDue),
    quotationId: quotationId > 0 ? quotationId : null,
    locationId: positiveId(c.locationId ?? c.LocationId),
    locationName: text(c.locationName ?? c.LocationName) || null,
  };
}

/**
 * GET /api/contact?page=&limit=&search=&locationId= — inquiries with their latest feedback ({ data, total }).
 * The API returns the user's locations (plus inquiries with no branch); locationId narrows it to one location.
 */
export async function getTourInquiries(
  page = 1,
  limit = 100,
  search?: string,
  locationId?: number | null,
): Promise<TourInquiryPage> {
  const query = search ? sanitizeSearchInput(search) : "";
  // 0 = only the inquiries with no branch (the "No branch" filter); a positive id = that branch; otherwise all.
  const branch = locationId === 0 ? 0 : positiveId(locationId) ?? undefined;
  const path = API_ENDPOINTS.contact.list(page, limit, query || undefined, branch);
  const response = await apiRequest<any>(path, {
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

/** Where a staff-entered inquiry came from (the API stores Walk-In unless Reference is chosen). */
export type StaffInquiryType = "WalkIn" | "Reference";

/**
 * POST /api/book-tour — an inquiry entered by staff (phone call / walk-in), saved like the website's form, with
 * its branch (locationId; the API keeps a location-bound user to their own locations) and its Type: Walk-In or
 * Reference (+ who referred the visitor; empty = the signed-in staff member, as the CMS does).
 */
export async function createTourInquiry(payload: {
  fullName: string;
  email?: string;
  phone: string;
  message?: string;
  locationId?: number | null;
  inquiryType?: StaffInquiryType;
  referenceName?: string | null;
}) {
  const fullName = sanitizeNameInput(payload.fullName, "Full name");
  const email = payload.email?.trim() ? sanitizeEmailInput(payload.email) : "";
  const phone = sanitizePhoneInput(payload.phone);
  const message = payload.message?.trim() ? sanitizeMessageInput(payload.message) : "";
  const locationId = positiveId(payload.locationId);
  const inquiryType: StaffInquiryType = payload.inquiryType === "Reference" ? "Reference" : "WalkIn";
  const referenceName = inquiryType === "Reference" ? payload.referenceName?.trim().slice(0, 200) || null : null;
  const response = await apiRequest<ApiResponse<{ id?: number; publicId?: string }>>(
    API_ENDPOINTS.contact.bookTour,
    {
      method: "POST",
      requiresAuth: true,
      unwrapData: false,
      body: {
        fullName,
        email,
        phone,
        message,
        inquiryType,
        referenceName,
        ...(locationId ? { locationId } : {}),
      },
    },
  );
  ensureSuccess(response, "Unable to add the inquiry right now.");
  return response?.message || "Inquiry added.";
}

/**
 * The API path of an inquiry action ("feedback", "status"): by its public id, which is unique across both tables;
 * an old row without one (before the database update QA_05) by its id plus ?source=, so the API changes the right
 * row. Null when the inquiry can't be identified.
 */
export function inquiryPath(
  inquiry: Pick<TourInquiry, "id" | "publicId"> & { source?: InquirySource | null },
  action: "feedback" | "status",
): string | null {
  if (inquiry.publicId) return `/contact/${encodeURIComponent(inquiry.publicId)}/${action}`;
  if (inquiry.id && inquiry.id > 0) return `/contact/${inquiry.id}/${action}?source=${inquiry.source ?? "contact"}`;
  return null;
}

/**
 * POST /api/contact/{publicId}/feedback (or {id}/feedback?source= for a row without a public id).
 * not_interested needs a reason and closes the inquiry; future_prospect needs a follow-up date;
 * converted links the quotation. A refusal comes back as HTTP 400 with the API's message.
 */
export async function saveInquiryFeedback(
  inquiry: Pick<TourInquiry, "id" | "publicId"> & { source?: InquirySource | null },
  payload: InquiryFeedbackRequest,
): Promise<string> {
  const path = inquiryPath(inquiry, "feedback");
  if (!path) {
    throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  }
  const response = await apiRequest<ApiResponse<unknown>>(path, {
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
