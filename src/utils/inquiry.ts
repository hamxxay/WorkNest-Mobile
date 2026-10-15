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

const firstWord = (value: string | null | undefined): string => (value ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * The first WhatsApp message a sales executive sends to an inquiry from their own phone: "Hi Ali, this is Sana from
 * WorkNest." Without the staff name: "Hi Ali, greetings from WorkNest."; without the customer's name: "Hi, this is ...".
 * WhatsApp opens it ready to send, so it can still be edited first.
 */
export function inquiryWhatsAppMessage(customerName: string | null | undefined, staffName: string | null | undefined): string {
  const customer = firstWord(customerName);
  const staff = firstWord(staffName);
  const hi = customer ? `Hi ${customer}` : "Hi";
  return staff ? `${hi}, this is ${staff} from WorkNest.` : `${hi}, greetings from WorkNest.`;
}

/** https://wa.me/<number>?text=<message>: a chat with that number in the phone's WhatsApp, the message filled in. */
export function whatsappChatUrl(phone: string, message?: string): string {
  const url = `https://wa.me/${whatsappNumber(phone)}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

/** A link that opens a WhatsApp chat (wa.me, api.whatsapp.com or the whatsapp:// scheme) and nothing else. */
export function isWhatsAppUrl(url: string | null | undefined): boolean {
  return /^(?:https:\/\/(?:wa\.me|api\.whatsapp\.com)\/|whatsapp:\/\/)\S*$/i.test((url ?? "").trim());
}

/**
 * The link the WhatsApp button opens: the API's message for that inquiry (the CMS template, filled in on the server)
 * when it answers with a WhatsApp link, otherwise `fallbackUrl` (the app's own greeting), so the button always opens
 * a chat. `fetchServer` is null when the inquiry has no public id. A failed call (offline, an older API without the
 * endpoint: 404 / 405) or an answer without a usable url falls back too. Never throws.
 */
export async function resolveWhatsAppUrl(
  fetchServer: (() => Promise<{ url?: string | null } | null | undefined>) | null,
  fallbackUrl: string,
): Promise<string> {
  if (!fetchServer) return fallbackUrl;
  try {
    const url = (await fetchServer())?.url?.trim();
    return url && isWhatsAppUrl(url) ? url : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}
