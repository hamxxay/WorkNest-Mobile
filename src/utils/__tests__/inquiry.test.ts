import { inquiryWhatsAppMessage, whatsappChatUrl, whatsappNumber } from "../inquiry";

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
