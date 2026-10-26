// WhatsApp Inbox service (GET whatsapp/conversations, GET whatsapp/conversations/{id}/messages): the calls, the
// tolerant reading of the answers, the wa.me rule and the unread count.

jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn() }));
jest.mock("../../apiClient", () => ({
  ApiError: class extends Error {},
  apiRequest: jest.fn(),
  friendlyApiMessage: () => "error",
  serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
}));

import { apiRequest } from "../../apiClient";
import {
  getWhatsAppMessages,
  listWhatsAppConversations,
  normalizeWaConversation,
  normalizeWaMessage,
  unreadConversationCount,
  waDisplayName,
  waPhoneLabel,
  waSenderLabel,
  whatsAppUrl,
} from "../whatsappInbox";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const CONVERSATION = {
  id: 7,
  contactId: 3,
  phoneNumber: "923001234567",
  name: "Ali Raza",
  tags: "member, i8",
  adminNotes: "Wants a private office",
  status: "open",
  lastMessageAt: "2026-10-26T10:15:00",
  lastMessageText: "Is the meeting room free?",
  lastIncomingAt: "2026-10-26T10:15:00",
  unreadCount: 2,
  inReplyWindow: true,
};

describe("whatsAppUrl (Open in WhatsApp)", () => {
  it("links a stored international number as is", () => {
    expect(whatsAppUrl("923001234567")).toBe("https://wa.me/923001234567");
  });

  it("strips everything but digits", () => {
    expect(whatsAppUrl("+92 (300) 123-4567")).toBe("https://wa.me/923001234567");
    expect(whatsAppUrl(" +44 20 7946 0958 ")).toBe("https://wa.me/442079460958");
  });

  it("turns a Pakistani 0xxxxxxxxxx (11 digits) into 92 + the rest", () => {
    expect(whatsAppUrl("03001234567")).toBe("https://wa.me/923001234567");
    expect(whatsAppUrl("0300-1234567")).toBe("https://wa.me/923001234567");
    // Not 0 + 10 digits: left as is.
    expect(whatsAppUrl("030012345")).toBe("https://wa.me/030012345");
  });

  it("is usable with 8 to 15 digits only, otherwise empty (button disabled)", () => {
    expect(whatsAppUrl("12345678")).toBe("https://wa.me/12345678");
    expect(whatsAppUrl("123456789012345")).toBe("https://wa.me/123456789012345");
    expect(whatsAppUrl("1234567")).toBe("");
    expect(whatsAppUrl("1234567890123456")).toBe("");
    expect(whatsAppUrl("")).toBe("");
    expect(whatsAppUrl("no number")).toBe("");
    expect(whatsAppUrl(null as unknown as string)).toBe("");
  });
});

describe("unreadConversationCount", () => {
  it("counts conversations with unread messages, not the messages", () => {
    expect(unreadConversationCount([{ unreadCount: 3 }, { unreadCount: 0 }, { unreadCount: 1 }])).toBe(2);
    expect(unreadConversationCount([])).toBe(0);
  });
});

describe("normalizeWaConversation", () => {
  it("reads the API's conversation", () => {
    expect(normalizeWaConversation(CONVERSATION)).toEqual(CONVERSATION);
  });

  it("reads PascalCase fields, blank names and string numbers", () => {
    expect(normalizeWaConversation({ Id: "9", PhoneNumber: " 923331112222 ", Name: "  ", UnreadCount: "1", InReplyWindow: "true" })).toMatchObject({
      id: 9,
      phoneNumber: "923331112222",
      name: null,
      unreadCount: 1,
      inReplyWindow: true,
      status: "open",
    });
  });

  it("never gives a negative or fractional unread count", () => {
    expect(normalizeWaConversation({ unreadCount: -3 }).unreadCount).toBe(0);
    expect(normalizeWaConversation({ unreadCount: "x" }).unreadCount).toBe(0);
    expect(normalizeWaConversation({ unreadCount: 2.7 }).unreadCount).toBe(2);
  });
});

describe("display helpers", () => {
  it("shows the name, else the number with +", () => {
    expect(waDisplayName({ name: "Ali", phoneNumber: "923001234567" })).toBe("Ali");
    expect(waDisplayName({ name: null, phoneNumber: "923001234567" })).toBe("+923001234567");
    expect(waDisplayName({ name: " ", phoneNumber: "" })).toBe("Unknown contact");
  });

  it("adds + to a stored international number only", () => {
    expect(waPhoneLabel("923001234567")).toBe("+923001234567");
    expect(waPhoneLabel("03001234567")).toBe("03001234567");
    expect(waPhoneLabel(null)).toBe("");
  });

  it("labels outgoing messages Staff or Bot, and templates (as the CMS bubble)", () => {
    expect(waSenderLabel({ direction: "outgoing", sentByUserId: 12, messageType: "text" })).toBe("Staff");
    expect(waSenderLabel({ direction: "outgoing", sentByUserId: null, messageType: "text" })).toBe("Bot");
    expect(waSenderLabel({ direction: "outgoing", sentByUserId: 4, messageType: "template" })).toBe("Staff · template");
    expect(waSenderLabel({ direction: "incoming", sentByUserId: null, messageType: "text" })).toBe("");
  });
});

describe("normalizeWaMessage", () => {
  it("reads a message", () => {
    const raw = {
      id: 101,
      conversationId: 7,
      direction: "incoming",
      messageType: "text",
      messageText: "Hi",
      sentByUserId: null,
      createdOn: "2026-10-26T10:15:00",
    };
    expect(normalizeWaMessage(raw)).toEqual(raw);
  });

  it("reads PascalCase, lower-cases the type and direction, copes with missing fields", () => {
    expect(normalizeWaMessage({ Id: 5, Direction: "Outgoing", MessageType: "Template", SentByUserId: "4" })).toMatchObject({
      id: 5,
      direction: "outgoing",
      messageType: "template",
      sentByUserId: 4,
    });
    expect(normalizeWaMessage({ direction: "weird" }).direction).toBe("incoming");
    expect(normalizeWaMessage({})).toMatchObject({ messageText: null, messageType: "text", createdOn: "" });
  });
});

describe("listWhatsAppConversations", () => {
  it("GETs the first 100 with the search, authenticated", async () => {
    api.mockResolvedValueOnce({ data: [CONVERSATION], total: 41 });
    const list = await listWhatsAppConversations("  ali ");
    expect(lastCall()).toMatchObject({
      path: "/whatsapp/conversations?page=1&limit=100&search=ali",
      method: "GET",
      requiresAuth: true,
      unwrapData: false,
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 7, unreadCount: 2 });
  });

  it("leaves out an empty search, lists each conversation once, copes with an empty answer", async () => {
    api.mockResolvedValueOnce({ data: [CONVERSATION, CONVERSATION], total: 2 });
    expect(await listWhatsAppConversations("   ")).toHaveLength(1);
    expect(lastCall().path).toBe("/whatsapp/conversations?page=1&limit=100");
    api.mockResolvedValueOnce(null);
    await expect(listWhatsAppConversations()).resolves.toEqual([]);
  });
});

describe("getWhatsAppMessages", () => {
  it("GETs the newest messages (which marks the conversation read) and returns them oldest first", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      message: "Success",
      data: [
        { id: 12, direction: "outgoing", messageText: "Yes, it is" },
        { id: 11, direction: "incoming", messageText: "Is the room free?" },
      ],
    });
    const messages = await getWhatsAppMessages(7);
    expect(lastCall()).toMatchObject({ path: "/whatsapp/conversations/7/messages?limit=100", method: "GET", requiresAuth: true });
    expect(messages.map((m) => m.id)).toEqual([11, 12]);
  });

  it("pages back with beforeId", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: [] });
    await getWhatsAppMessages(7, { beforeId: 11, limit: 50 });
    expect(lastCall().path).toBe("/whatsapp/conversations/7/messages?beforeId=11&limit=50");
  });

  it("passes a failure on (the screen shows it; never an empty thread)", async () => {
    api.mockRejectedValueOnce(new Error("Conversation not found."));
    await expect(getWhatsAppMessages(99)).rejects.toThrow("Conversation not found.");
  });
});
