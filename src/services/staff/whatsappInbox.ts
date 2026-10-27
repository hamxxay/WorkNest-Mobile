import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, num, optNum, optStr, str, toList, withQuery } from "./normalize";

// WhatsApp Inbox (CMS whatsapp.service.ts getConversations / getMessages; API WhatsAppInboxController). Read roles:
// admin, super admin, receptionist, sales executive. The app only reads: replies, new conversations and broadcasts
// (admin / super admin in the CMS) are not offered; staff reply from their own WhatsApp ("Open in WhatsApp", a
// wa.me link from whatsAppUrl). Loading a conversation's newest messages marks it read on the server.

/** A conversation (WhatsAppConversationDto): one per customer number. */
export type WaConversation = {
  id: number;
  contactId: number;
  /** As stored by the API: digits in international form (923001234567). */
  phoneNumber: string;
  name?: string | null;
  /** "open" unless the API says otherwise. */
  status: string;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  /** Incoming messages not yet read by staff (reset to 0 when the conversation is opened). */
  unreadCount: number;
  tags?: string | null;
  adminNotes?: string | null;
  lastIncomingAt?: string | null;
  /** WhatsApp's 24-hour window is open (the customer wrote in the last 24 hours). */
  inReplyWindow?: boolean;
};

export type WaDirection = "incoming" | "outgoing";

/** A message (WhatsAppMessageDto). */
export type WaMessage = {
  id: number;
  conversationId: number;
  direction: WaDirection;
  /** text | template | ... (lower case) */
  messageType: string;
  messageText: string | null;
  /** Staff member who sent an outgoing message; null for the bot (and for incoming messages). */
  sentByUserId: number | null;
  createdOn: string;
};

/**
 * https://wa.me/<digits> for a phone number, or "" when it can't be a WhatsApp number (the button is then disabled).
 * Everything but digits is dropped; a Pakistani local 0 + 10 digits becomes 92 + the 10 digits; usable with 8 to 15
 * digits (the CMS inbox rule).
 */
export function whatsAppUrl(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) digits = `92${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : "";
}

/** Conversations with unread customer messages (the CMS sidebar / inbox count), not the number of messages. */
export function unreadConversationCount(list: readonly Pick<WaConversation, "unreadCount">[]): number {
  return list.filter((c) => c.unreadCount > 0).length;
}

/** "+923001234567" for a stored number of plain digits (not a local 0... number); anything else as is. */
export function waPhoneLabel(phone: string | null | undefined): string {
  const p = (phone ?? "").trim();
  return /^[1-9]\d{6,14}$/.test(p) ? `+${p}` : p;
}

/** Name, or the number when the contact has no name (CMS displayName). */
export function waDisplayName(c: Pick<WaConversation, "name" | "phoneNumber">): string {
  return c.name?.trim() || waPhoneLabel(c.phoneNumber) || "Unknown contact";
}

/** Outgoing: "Staff" or "Bot" (+ " · template"), as the CMS bubble; incoming: "". */
export function waSenderLabel(m: Pick<WaMessage, "direction" | "sentByUserId" | "messageType">): string {
  if (m.direction !== "outgoing") return "";
  return `${m.sentByUserId ? "Staff" : "Bot"}${m.messageType === "template" ? " · template" : ""}`;
}

export function normalizeWaConversation(raw: any): WaConversation {
  const unread = num(raw, "unreadCount");
  return {
    id: num(raw, "id"),
    contactId: num(raw, "contactId"),
    phoneNumber: str(raw, "phoneNumber", "phone").trim(),
    name: optStr(raw, "name"),
    status: optStr(raw, "status")?.toLowerCase() ?? "open",
    lastMessageAt: optStr(raw, "lastMessageAt"),
    lastMessageText: optStr(raw, "lastMessageText"),
    unreadCount: unread > 0 ? Math.floor(unread) : 0,
    tags: optStr(raw, "tags"),
    adminNotes: optStr(raw, "adminNotes"),
    lastIncomingAt: optStr(raw, "lastIncomingAt"),
    inReplyWindow: bool(raw, "inReplyWindow"),
  };
}

export function normalizeWaDirection(value: unknown): WaDirection {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "outgoing" || v === "outbound" || v === "out" || v === "sent" ? "outgoing" : "incoming";
}

export function normalizeWaMessage(raw: any): WaMessage {
  return {
    id: num(raw, "id"),
    conversationId: num(raw, "conversationId"),
    direction: normalizeWaDirection(str(raw, "direction")),
    messageType: (optStr(raw, "messageType") ?? "text").toLowerCase(),
    messageText: optStr(raw, "messageText", "text"),
    sentByUserId: optNum(raw, "sentByUserId"),
    createdOn: str(raw, "createdOn", "createdAt"),
  };
}

/** Conversations per load: the API's maximum (as the CMS inbox, which loads page 1 of 100). */
export const WA_CONVERSATION_LIMIT = 100;

/**
 * GET whatsapp/conversations?page=1&limit=100&search= — unread first, then by the latest message. Search matches
 * the number, name, tags and last message.
 */
export async function listWhatsAppConversations(search?: string): Promise<WaConversation[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.whatsappInbox.conversations, { page: 1, limit: WA_CONVERSATION_LIMIT, search: search?.trim() }),
  );
  // Each conversation once (a row can move between pages while the list is read).
  const seen = new Set<number>();
  return toList(raw, normalizeWaConversation).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** Messages per load (the API allows 1-200). */
export const WA_MESSAGE_LIMIT = 100;

/**
 * GET whatsapp/conversations/{id}/messages — oldest first. Without `beforeId` (the newest page) the API marks the
 * conversation read; with it, the page of older messages before that id.
 */
export async function getWhatsAppMessages(
  conversationId: number,
  options: { beforeId?: number | null; limit?: number } = {},
): Promise<WaMessage[]> {
  const limit = Math.min(200, Math.max(1, options.limit ?? WA_MESSAGE_LIMIT));
  const beforeId = options.beforeId != null && options.beforeId > 0 ? options.beforeId : undefined;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.whatsappInbox.messages(conversationId), { beforeId, limit }));
  // Oldest first even if a server sends them the other way round (ids grow with time).
  return toList(raw, normalizeWaMessage).sort((a, b) => a.id - b.id);
}
