import type { TourInquiry } from "../services/contactService";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as yyyy-MM-dd (what the feedback API expects). */
export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayYmd(): string {
  return toYmd(new Date());
}

export function addDaysYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

export function addMonthsYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return toYmd(d);
}

/** yyyy-MM-dd → local Date (null when it isn't a real calendar date). */
export function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

/** "2026-10-12" → "12 Oct 2026". */
export function formatYmd(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseYmd(value.slice(0, 10));
  if (!date) return value;
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Created date of an inquiry ("12 Oct 2026, 14:05"); falls back to the raw text. */
export function formatCreated(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Latest feedback, worded like the website's Tour Inquiries "Feedback" column. */
export function inquiryFeedbackText(item: TourInquiry): string {
  switch (item.feedbackOutcome) {
    case "not_interested":
      return "Not interested" + (item.feedbackReason ? ` – ${item.feedbackReason}` : "");
    case "future_prospect":
      return item.followUpDue
        ? `Follow-up due (${formatYmd(item.followUpOn)})`
        : `Future prospect – follow up ${formatYmd(item.followUpOn)}`;
    case "converted":
      return "Converted to quotation" + (item.quotationId ? ` #${item.quotationId}` : "");
    default:
      return "";
  }
}

/** New = no feedback yet and still at status 1 (New). */
export function isNewInquiry(item: TourInquiry): boolean {
  return !item.feedbackOutcome && item.statusId === 1;
}

/**
 * Phone → digits for https://wa.me/<number> (international format, no "+").
 * Pakistani local numbers 03xx-xxxxxxx become 923xx-xxxxxxx; a leading 00 is dropped.
 */
export function whatsappNumber(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("03")) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return digits;
}
