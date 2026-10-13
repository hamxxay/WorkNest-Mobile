import { CHAT_FALLBACK, CHAT_QUICK_QUESTIONS, CHAT_RULES, getBotReply } from "./chatBotReplies";

describe("WorkNest assistant answers", () => {
  it("answers each quick question with its own topic", () => {
    const [book, payment, wifi, hourly, cancel, locations] = CHAT_QUICK_QUESTIONS.map(getBotReply);
    expect(book).toContain("Book this space");
    expect(payment).toContain("bank challan");
    expect(wifi).toContain("Amenities");
    expect(hourly).toContain("by the hour");
    // Used to get the booking steps because "booking" contains "book".
    expect(cancel).toContain("tap Cancel");
    expect(locations).toContain("Location filter");
  });

  it("points to screens that exist (no Booking tab, menu, Book Now or Profile > My Bookings)", () => {
    const texts = [...CHAT_RULES.map((r) => r.answer), CHAT_FALLBACK].join("\n");
    expect(texts).not.toMatch(/Booking tab/);
    expect(texts).not.toMatch(/\bmenu\b/i);
    expect(texts).not.toMatch(/Book Now/);
    expect(texts).not.toMatch(/Profile > My Bookings/);
    expect(getBotReply("where can I see my booking history")).toContain("Bookings tab");
  });

  it("matches keywords at word starts only", () => {
    // "hi" must not match "this" or "history".
    expect(getBotReply("this is weird")).toBe(CHAT_FALLBACK);
    expect(getBotReply("hi")).toContain("Hello");
    expect(getBotReply("I need to sign my agreement")).toContain("Agreements tab");
    expect(getBotReply("how do I unlock my door")).toContain("Access request");
    expect(getBotReply("any quotation for me?")).toContain("Quotations");
  });
});
