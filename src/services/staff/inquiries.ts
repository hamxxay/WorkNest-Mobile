import { isWhatsAppUrl } from "../../utils/inquiry";
import { inquiryPath, type InquirySource, type TourInquiry } from "../contactService";
import { toBranchId } from "./branches";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPatch, type ActionResult } from "./http";
import { optStr, str, unwrapEnvelope } from "./normalize";

// Tour inquiries: the list, staff-entered inquiries and feedback already live in services/contactService.ts
// (GET contact, POST book-tour, POST contact/{id}/feedback — same calls as the CMS) and are re-exported here so
// staff screens import from one place. Roles: every staff role. Branch routing: the API gives location-bound staff
// (admins, sales executives) the inquiries of their locations plus those with no branch; super admins see all.
export {
  createTourInquiry,
  getTourInquiries,
  inquiryPath,
  inquirySource,
  normalizeInquiry,
  saveInquiryFeedback,
  type InquiryFeedbackRequest,
  type InquiryOutcome,
  type InquirySource,
  type StaffInquiryType,
  type TourInquiry,
  type TourInquiryPage,
} from "../contactService";

/** Inquiry status ids (CMS): 1 New, 2 In progress, 3 Resolved, 4 Closed. */
export const INQUIRY_STATUS = { new: 1, inProgress: 2, resolved: 3, closed: 4 } as const;

export const INQUIRY_STATUS_LABELS: Record<number, string> = {
  1: "New",
  2: "In Progress",
  3: "Resolved",
  4: "Closed",
};

/**
 * PATCH contact/{publicId}/status { statusId } (feedback already moves the status; this is the manual change). An old
 * row without a public id: contact/{id}/status?source= (the id alone can mean two inquiries).
 */
export async function updateInquiryStatus(
  inquiry: Pick<TourInquiry, "id" | "publicId"> & { source?: InquirySource | null },
  statusId: number,
): Promise<ActionResult> {
  if (!INQUIRY_STATUS_LABELS[statusId]) throw new Error("Choose a valid status.");
  const path = inquiryPath(inquiry, "status");
  if (!path) throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  const raw = await staffPatch(path, { statusId });
  return actionResult(raw, "Inquiry status updated.");
}

/**
 * PATCH contact/{publicId}/location { locationId } — set or change an inquiry's branch (location-bound staff: only
 * to one of their locations, and only inquiries they can see; the API checks).
 */
export async function updateInquiryLocation(
  inquiry: { publicId: string | null },
  locationId: number,
): Promise<ActionResult> {
  if (!inquiry.publicId) throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  const id = toBranchId(locationId);
  if (id == null) throw new Error("Choose the branch.");
  const raw = await staffPatch(STAFF_ENDPOINTS.inquiries.location(inquiry.publicId), { locationId: id });
  return actionResult(raw, "Branch updated.");
}

/** The first WhatsApp message to an inquiry, rendered by the API from the CMS template for the signed-in staff member. */
export type InquiryWhatsAppMessage = {
  /** International digits for wa.me ("923001234567"); "" when the API sent none. */
  phone: string;
  /** The filled-in message; "" when the API sent none. */
  text: string;
  /** "https://wa.me/<phone>?text=..."; null when missing or not a WhatsApp link (the app then uses its own greeting). */
  url: string | null;
};

/** A slow answer must not keep the WhatsApp button busy for long: after this the app opens its own greeting. */
const WHATSAPP_MESSAGE_TIMEOUT_MS = 8000;

/**
 * GET contact/{publicId}/whatsapp-message, read tolerantly: an ApiResponse envelope or the bare object, camelCase or
 * PascalCase. A url that is not a WhatsApp link is dropped (url null), so the app never opens anything else.
 */
export function normalizeWhatsAppMessage(raw: unknown): InquiryWhatsAppMessage {
  const row = unwrapEnvelope<unknown>(raw);
  const url = optStr(row, "url", "whatsappUrl");
  return {
    phone: str(row, "phone", "whatsappNumber").replace(/\D/g, ""),
    text: str(row, "text"),
    url: url && isWhatsAppUrl(url) ? url : null,
  };
}

/**
 * GET contact/{publicId}/whatsapp-message — the message for that inquiry (same visibility as the inquiry list: 404
 * when the user can't see it). Roles: staff who see tour inquiries. Throws ApiError when the call fails (offline, an
 * older API without the endpoint); the WhatsApp button then falls back to utils/inquiry inquiryWhatsAppMessage.
 */
export async function getInquiryWhatsAppMessage(inquiry: { publicId: string | null }): Promise<InquiryWhatsAppMessage> {
  if (!inquiry.publicId) throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  const raw = await staffGet(STAFF_ENDPOINTS.inquiries.whatsappMessage(inquiry.publicId), {
    timeoutMs: WHATSAPP_MESSAGE_TIMEOUT_MS,
  });
  return normalizeWhatsAppMessage(raw);
}
