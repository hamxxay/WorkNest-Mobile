import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizeTextForState,
} from "../utils/inputSanitizer";
import { isValidPhone, PHONE_ERROR } from "../utils/phone";

// Book a Tour, exactly like worknestpk.com: POST /book-tour (public, works signed out) with the tour details in
// the message; the sales team also gets the request on WhatsApp.

/** WorkNest sales WhatsApp (+92 328 0256000), same number as the website's tour form. */
export const SALES_WHATSAPP_NUMBER = "923280256000";

/** Time slots offered on the website's tour form. */
export const TOUR_TIME_SLOTS = [
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM",
] as const;

export type TourRequest = {
  fullName: string;
  email: string;
  phone: string;
  /** Location name (from GET /location/all). */
  location?: string;
  /** Id of that location (WN_Locations.Id): the API sends the request to that branch's staff. */
  locationId?: number;
  /** yyyy-MM-dd */
  preferredDate?: string;
  timeSlot?: string;
  notes?: string;
};

/** The message the API stores, in the website's format. */
export function buildTourMessage(request: TourRequest): string {
  const lines = ["Tour Request"];
  if (request.location) lines.push(`Location: ${request.location}`);
  if (request.preferredDate) lines.push(`Date: ${request.preferredDate}`);
  if (request.timeSlot) lines.push(`Time: ${request.timeSlot}`);
  const notes = (request.notes ?? "").trim();
  return notes ? `${lines.join("\n")}\n\n${notes}` : lines.join("\n");
}

/** WhatsApp text sent to the sales team after the request is saved (website wording). */
export function buildTourWhatsAppText(request: TourRequest): string {
  const parts = [
    "Hi WorkNest! I'd like to book a tour.",
    "",
    `Name: ${request.fullName}`,
    `Email: ${request.email}`,
    `Phone: ${request.phone}`,
  ];
  if (request.location) parts.push(`Location: ${request.location}`);
  if (request.preferredDate) parts.push(`Date: ${request.preferredDate}`);
  if (request.timeSlot) parts.push(`Time: ${request.timeSlot}`);
  if (request.notes?.trim()) parts.push(`Notes: ${request.notes.trim()}`);
  return parts.join("\n");
}

/** What the app says when a tour request was saved (the API's own text, e.g. "Contact recorded.", is for staff). */
export const TOUR_SENT_MESSAGE = "Your tour request has been sent. Our team will contact you to confirm the visit.";
/** What the app says when a contact message was saved. */
export const CONTACT_SENT_MESSAGE = "Your message has been sent. We will get back to you soon.";

/**
 * POST /book-tour — saves the tour request (no sign-in needed; when signed in the API records who sent it).
 * Resolves with the app's confirmation text. Throws a readable error for invalid details or a refused request.
 */
export async function submitTourRequest(request: TourRequest): Promise<string> {
  const phone = (request.phone ?? "").trim();
  if (!isValidPhone(phone)) throw new ApiError(PHONE_ERROR, 400);
  const clean: TourRequest = {
    fullName: sanitizeNameInput(request.fullName, "Full name"),
    email: sanitizeEmailInput(request.email),
    phone: sanitizePhoneInput(phone),
    location: request.location ? sanitizeTextForState(request.location, { maxLength: 120, collapse: true }).trim() : undefined,
    preferredDate: request.preferredDate,
    timeSlot: request.timeSlot,
    notes: request.notes ? sanitizeTextForState(request.notes, { maxLength: 1000 }).trim() : undefined,
  };
  const locationId =
    request.locationId != null && Number.isInteger(request.locationId) && request.locationId > 0 ? request.locationId : undefined;
  await apiRequest<{ message?: string }>(API_ENDPOINTS.contact.bookTour, {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      fullName: clean.fullName,
      email: clean.email,
      phone: clean.phone,
      message: buildTourMessage(clean),
      ...(locationId ? { locationId } : {}),
    },
  });
  return TOUR_SENT_MESSAGE;
}

// ─── Contact us ───────────────────────────────────────────────────────────────

export type ContactMessage = { fullName: string; email: string; phone: string; message: string };

/** WorkNest sales email (also on the website). */
export const SALES_EMAIL = "sales@worknestpk.com";

/**
 * POST /contact — the public contact form (works signed out; when signed in the API records who sent it).
 * Resolves with the app's confirmation text. Throws a readable error for invalid details or a refused request.
 */
export async function submitContactMessage(input: ContactMessage): Promise<string> {
  const phone = (input.phone ?? "").trim();
  if (phone && !isValidPhone(phone)) throw new ApiError(PHONE_ERROR, 400);
  const message = sanitizeTextForState(input.message ?? "", { maxLength: 1000 }).trim();
  if (message.length < 5) throw new ApiError("Please write a short message.", 400);
  await apiRequest<{ message?: string }>(API_ENDPOINTS.contact.create, {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      fullName: sanitizeNameInput(input.fullName, "Full name"),
      email: sanitizeEmailInput(input.email),
      phone: phone ? sanitizePhoneInput(phone) : undefined,
      message,
    },
  });
  return CONTACT_SENT_MESSAGE;
}
