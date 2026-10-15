import { inquiryWhatsAppMessage, isWhatsAppUrl, resolveWhatsAppUrl, whatsappChatUrl, whatsappNumber } from "../inquiry";

describe("whatsappNumber", () => {
  it("turns a Pakistani local number into the international form wa.me expects", () => {
    expect(whatsappNumber("0300-1234567")).toBe("923001234567");
    expect(whatsappNumber("3001234567")).toBe("923001234567");
    expect(whatsappNumber("+92 300 1234567")).toBe("923001234567");
    expect(whatsappNumber("0092 300 1234567")).toBe("923001234567");
  });
});

describe("inquiryWhatsAppMessage", () => {
  it("greets the customer by first name and introduces the staff member", () => {
    expect(inquiryWhatsAppMessage("Ali Raza Khan", "Sana")).toBe("Hi Ali, this is Sana from WorkNest.");
  });

  it("uses only the staff member's first name", () => {
    expect(inquiryWhatsAppMessage("Ali", "Sana Iqbal")).toBe("Hi Ali, this is Sana from WorkNest.");
  });

  it("still reads well without the customer's or the staff member's name", () => {
    expect(inquiryWhatsAppMessage("", "Sana")).toBe("Hi, this is Sana from WorkNest.");
    expect(inquiryWhatsAppMessage("  Ali  ", "")).toBe("Hi Ali, greetings from WorkNest.");
    expect(inquiryWhatsAppMessage(null, undefined)).toBe("Hi, greetings from WorkNest.");
  });
});

describe("whatsappChatUrl", () => {
  it("opens a chat with the number and the message filled in", () => {
    expect(whatsappChatUrl("0300-1234567", "Hi Ali, this is Sana from WorkNest.")).toBe(
      "https://wa.me/923001234567?text=Hi%20Ali%2C%20this%20is%20Sana%20from%20WorkNest.",
    );
  });

  it("opens an empty chat when there is no message", () => {
    expect(whatsappChatUrl("03001234567")).toBe("https://wa.me/923001234567");
  });
});

describe("isWhatsAppUrl", () => {
  it("accepts WhatsApp chat links only", () => {
    expect(isWhatsAppUrl("https://wa.me/923001234567?text=Hi")).toBe(true);
    expect(isWhatsAppUrl("https://api.whatsapp.com/send?phone=923001234567&text=Hi")).toBe(true);
    expect(isWhatsAppUrl("whatsapp://send?phone=923001234567")).toBe(true);
    expect(isWhatsAppUrl("http://wa.me/923001234567")).toBe(false);
    expect(isWhatsAppUrl("https://wa.me.example.com/923001234567")).toBe(false);
    expect(isWhatsAppUrl("https://example.com/wa.me/923001234567")).toBe(false);
    expect(isWhatsAppUrl("")).toBe(false);
    expect(isWhatsAppUrl(null)).toBe(false);
  });
});

describe("resolveWhatsAppUrl", () => {
  const SERVER = "https://wa.me/923001234567?text=Hi%20Ali%2C%20this%20is%20Sana%20from%20WorkNest%20F-7.";
  const FALLBACK = whatsappChatUrl("03001234567", inquiryWhatsAppMessage("Ali", "Sana"));

  it("opens the server's message when the API answers with a link", async () => {
    await expect(resolveWhatsAppUrl(async () => ({ url: SERVER }), FALLBACK)).resolves.toBe(SERVER);
    await expect(resolveWhatsAppUrl(async () => ({ url: `  ${SERVER}  ` }), FALLBACK)).resolves.toBe(SERVER);
  });

  it("falls back to the app's own greeting when the answer has no usable url", async () => {
    await expect(resolveWhatsAppUrl(async () => ({ url: null }), FALLBACK)).resolves.toBe(FALLBACK);
    await expect(resolveWhatsAppUrl(async () => ({ url: "" }), FALLBACK)).resolves.toBe(FALLBACK);
    await expect(resolveWhatsAppUrl(async () => ({}), FALLBACK)).resolves.toBe(FALLBACK);
    await expect(resolveWhatsAppUrl(async () => null, FALLBACK)).resolves.toBe(FALLBACK);
    await expect(resolveWhatsAppUrl(async () => ({ url: "https://example.com/" }), FALLBACK)).resolves.toBe(FALLBACK);
  });

  it("falls back when the call fails (offline, an older API without the endpoint)", async () => {
    const notFound = Object.assign(new Error("Not found"), { status: 404 });
    await expect(resolveWhatsAppUrl(() => Promise.reject(notFound), FALLBACK)).resolves.toBe(FALLBACK);
    await expect(
      resolveWhatsAppUrl(() => {
        throw new Error("offline");
      }, FALLBACK),
    ).resolves.toBe(FALLBACK);
  });

  it("uses the fallback straight away when the inquiry has no public id", async () => {
    await expect(resolveWhatsAppUrl(null, FALLBACK)).resolves.toBe(FALLBACK);
  });
});
