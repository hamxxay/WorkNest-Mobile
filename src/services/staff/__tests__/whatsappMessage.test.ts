// The WhatsApp message of a tour inquiry (GET contact/{publicId}/whatsapp-message): the call and the tolerant
// reading of the answer. The screen's choice between this url and the app's own greeting is in utils/inquiry.

jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn() }));
jest.mock("../../apiClient", () => ({
  ApiError: class extends Error {},
  apiRequest: jest.fn(),
  friendlyApiMessage: () => "error",
  serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
}));

import { apiRequest } from "../../apiClient";
import { getInquiryWhatsAppMessage, normalizeWhatsAppMessage } from "../inquiries";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const PUBLIC_ID = "2b7c0b6e-0000-4000-8000-000000000001";
const URL = "https://wa.me/923001234567?text=Hi%20Ali%2C%20this%20is%20Sana%20from%20WorkNest%20F-7.";

describe("normalizeWhatsAppMessage", () => {
  it("reads the bare object", () => {
    expect(normalizeWhatsAppMessage({ phone: "923001234567", text: "Hi Ali, this is Sana from WorkNest F-7.", url: URL })).toEqual({
      phone: "923001234567",
      text: "Hi Ali, this is Sana from WorkNest F-7.",
      url: URL,
    });
  });

  it("reads an ApiResponse envelope and PascalCase fields", () => {
    expect(
      normalizeWhatsAppMessage({ isSuccessful: true, message: "Success", data: { Phone: "+92 300 1234567", Text: "Hi", Url: ` ${URL} ` } }),
    ).toEqual({ phone: "923001234567", text: "Hi", url: URL });
  });

  it("gives url null when it is missing, blank or not a WhatsApp link", () => {
    expect(normalizeWhatsAppMessage({ phone: "923001234567", text: "Hi" }).url).toBeNull();
    expect(normalizeWhatsAppMessage({ url: "   " }).url).toBeNull();
    expect(normalizeWhatsAppMessage({ url: "https://example.com/?text=Hi" }).url).toBeNull();
    expect(normalizeWhatsAppMessage({ url: "https://wa.me.example.com/923001234567" }).url).toBeNull();
  });

  it("copes with an empty answer", () => {
    expect(normalizeWhatsAppMessage(null)).toEqual({ phone: "", text: "", url: null });
    expect(normalizeWhatsAppMessage({ isSuccessful: true, data: null })).toEqual({ phone: "", text: "", url: null });
    expect(normalizeWhatsAppMessage("not json")).toEqual({ phone: "", text: "", url: null });
  });
});

describe("getInquiryWhatsAppMessage", () => {
  it("GETs the message by the inquiry's public id, authenticated, with a short time limit", async () => {
    api.mockResolvedValueOnce({ phone: "923001234567", text: "Hi Ali", url: URL });
    const result = await getInquiryWhatsAppMessage({ publicId: PUBLIC_ID });
    expect(lastCall()).toMatchObject({
      path: `/contact/${PUBLIC_ID}/whatsapp-message`,
      method: "GET",
      requiresAuth: true,
      unwrapData: false,
    });
    expect(lastCall().timeoutMs).toBeGreaterThan(0);
    expect(lastCall().timeoutMs).toBeLessThan(20000);
    expect(result).toEqual({ phone: "923001234567", text: "Hi Ali", url: URL });
  });

  it("refuses an inquiry without a public id without calling the API", async () => {
    await expect(getInquiryWhatsAppMessage({ publicId: null })).rejects.toThrow(/could not be identified/);
    expect(api).not.toHaveBeenCalled();
  });

  it("passes a failed call on (the screen then falls back to its own greeting)", async () => {
    api.mockRejectedValueOnce(new Error("Not found"));
    await expect(getInquiryWhatsAppMessage({ publicId: PUBLIC_ID })).rejects.toThrow("Not found");
  });
});
