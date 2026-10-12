import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPost, type ActionResult } from "./http";
import { isApiDate, optNum, optStr, str, unwrapEnvelope, withQuery } from "./normalize";

// Challan Validity (CMS pages/admin/challan-validity, super admin only; API ChallanController, which also
// lets admins in). Find a booking's challan by booking id, challan number or payment voucher number, then move
// its expiry date (WN_Bookings.ValidityDate). Extending also moves the challan-based door suspension.

/** Booking status ids as the search returns them: 1/5 Pending, 2/33 Confirmed, 3 Rejected, 6 No Show, 86 Cancelled. */
export function challanBookingStatusLabel(statusId: number | null): string {
  switch (statusId) {
    case 1:
    case 5:
      return "Pending";
    case 2:
    case 33:
      return "Confirmed";
    case 3:
      return "Rejected";
    case 6:
      return "No Show";
    case 86:
      return "Cancelled";
    default:
      return statusId == null ? "" : String(statusId);
  }
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * yyyy-MM-dd from the formats the challan search returns for the current expiry (CMS toIso): ISO
 * ("2026-07-29..."), "29/07/2026", or SQL style 107 text ("Jul 29, 2026" / "29 Jul 2026"). Null when unreadable.
 */
export function challanDateToIso(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return isApiDate(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) {
    const iso = `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    return isApiDate(iso) ? iso : null;
  }
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(v);
  if (m && MONTHS[m[1].toLowerCase()]) {
    const iso = `${m[3]}-${pad2(MONTHS[m[1].toLowerCase()])}-${pad2(Number(m[2]))}`;
    return isApiDate(iso) ? iso : null;
  }
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const iso = `${m[3]}-${pad2(MONTHS[m[2].toLowerCase()])}-${pad2(Number(m[1]))}`;
    return isApiDate(iso) ? iso : null;
  }
  return null;
}

export type ChallanSearchResult = {
  bookingId: number | null;
  challanNumber: string | null;
  voucherNumber: string | null;
  consumerNumber: string | null;
  /** As the API sent it. */
  currentExpiryText: string | null;
  /** yyyy-MM-dd when readable. */
  currentExpiryDate: string | null;
  voucherStatus: string | null;
  bookingStatusId: number | null;
  bookingStatus: string;
  customerName: string;
  spaceName: string;
};

/** Same input rule as the CMS: letters, digits, dashes and spaces, 1-50 characters. */
export function isValidChallanQuery(q: string): boolean {
  return /^[a-zA-Z0-9\-\s]{1,50}$/.test(q.trim());
}

/** GET challan/search?q= — null when nothing matches (the API answers 404). */
export async function searchChallan(q: string): Promise<ChallanSearchResult | null> {
  const query = q.trim();
  if (!isValidChallanQuery(query)) throw new Error("Enter a booking number or challan number (letters, digits and dashes).");
  let raw: unknown;
  try {
    raw = await staffGet(withQuery(STAFF_ENDPOINTS.challan.search, { q: query }));
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
  const d = unwrapEnvelope<any>(raw);
  if (!d || (optNum(d, "bookingId") == null && !optStr(d, "challanNumber"))) return null;
  const statusId = optNum(d, "bookingStatus", "bookingStatusId");
  const expiryText = optStr(d, "currentExpiryDate");
  return {
    bookingId: optNum(d, "bookingId"),
    challanNumber: optStr(d, "challanNumber"),
    voucherNumber: optStr(d, "voucherNumber"),
    consumerNumber: optStr(d, "consumerNumber"),
    currentExpiryText: expiryText,
    currentExpiryDate: challanDateToIso(expiryText),
    voucherStatus: optStr(d, "voucherStatus"),
    bookingStatusId: statusId,
    bookingStatus: challanBookingStatusLabel(statusId),
    customerName: str(d, "customerName"),
    spaceName: str(d, "spaceName"),
  };
}

/**
 * POST challan/extend-validity { bookingId, newExpiryDate, remarks } — newExpiryDate yyyy-MM-dd, after the
 * current expiry and not in the past; remarks optional (max 500).
 */
export async function extendChallanValidity(input: {
  bookingId: number;
  newExpiryDate: string;
  currentExpiryDate?: string | null;
  remarks?: string;
}): Promise<ActionResult<{ bookingId: number; newExpiryDate: string }>> {
  if (!(input.bookingId > 0)) throw new Error("Booking is required.");
  if (!isApiDate(input.newExpiryDate)) throw new Error("Choose a valid new expiry date.");
  if (input.currentExpiryDate && isApiDate(input.currentExpiryDate) && input.newExpiryDate <= input.currentExpiryDate) {
    throw new Error("The new expiry date must be after the current expiry date.");
  }
  const remarks = (input.remarks ?? "").trim().slice(0, 500);
  const raw = await staffPost(STAFF_ENDPOINTS.challan.extendValidity, {
    bookingId: input.bookingId,
    newExpiryDate: input.newExpiryDate,
    ...(remarks ? { remarks } : {}),
  });
  const result = actionResult(raw, "Challan validity extended successfully.");
  return { message: result.message, data: { bookingId: input.bookingId, newExpiryDate: input.newExpiryDate } };
}
