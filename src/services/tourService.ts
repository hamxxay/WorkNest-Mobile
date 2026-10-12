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

/**
 * POST /book-tour — saves the tour request (no sign-in needed; when signed in the API records who sent it).
 * Throws a readable error for invalid details or a refused request.
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
  const payload = await apiRequest<{ message?: string }>(API_ENDPOINTS.contact.bookTour, {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      fullName: clean.fullName,
      email: clean.email,
      phone: clean.phone,
      message: buildTourMessage(clean),
    },
  });
  return (typeof payload?.message === "string" && payload.message.trim()) || "Your tour request has been sent.";
}
