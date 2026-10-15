import { resolveMediaUrl } from "../mediaUrl";
import { nameError, sanitizeNameInput } from "../inputSanitizer";
import { isPastPakistanDate, pakistanToday } from "../pakistanDate";

jest.mock("../../config/api", () => ({ API_BASE_URL: "https://aeo.example.com/WorkNest/api" }));

describe("media URLs", () => {
  it("uses a full URL from the API as it is (no double encoding, http stays http)", () => {
    expect(resolveMediaUrl("https://cdn.example.com/spaces%2Foffice%20301.jpg")).toBe("https://cdn.example.com/spaces%2Foffice%20301.jpg");
    expect(resolveMediaUrl("http://cdn.example.com/a.jpg")).toBe("http://cdn.example.com/a.jpg");
    expect(resolveMediaUrl("https://images.unsplash.com/photo-1?w=800&q=80")).toBe("https://images.unsplash.com/photo-1?w=800&q=80");
    // Only raw spaces are encoded.
    expect(resolveMediaUrl("https://cdn.example.com/office 301.jpg")).toBe("https://cdn.example.com/office%20301.jpg");
    expect(resolveMediaUrl("http://")).toBeNull();
  });

  it("builds a relative path from the API's origin, encoding raw characters but not existing escapes", () => {
    expect(resolveMediaUrl("uploads/spaces/office 301.jpg")).toBe("https://aeo.example.com/WorkNest/uploads/spaces/office%20301.jpg");
    expect(resolveMediaUrl("/WorkNest/uploads/a%2Fb.jpg")).toBe("https://aeo.example.com/WorkNest/uploads/a%2Fb.jpg");
    expect(resolveMediaUrl("//cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(resolveMediaUrl("")).toBeNull();
    expect(resolveMediaUrl(null)).toBeNull();
  });
});

describe("names", () => {
  it("accepts letters of any language, apostrophes, periods and hyphens", () => {
    for (const name of ["Zoë Muñoz", "محمد علی", "Ali O'Brien", "Ali O’Brien", "M. Ali Khan", "Anne-Marie", "Jürgen", "José", "Ali Jr."]) {
      expect(nameError(name, "Full name")).toBeNull();
      expect(sanitizeNameInput(name, "Full name")).toBe(name);
    }
  });

  it("refuses digits and symbols with a plain message", () => {
    expect(nameError("Ali123", "Full name")).toBe("Full name can only have letters, spaces, apostrophes, periods and hyphens.");
    expect(nameError("Ali@Khan", "Full name")).not.toBeNull();
    expect(() => sanitizeNameInput("Ali_Khan", "Full name")).toThrow("Full name can only have");
    expect(nameError("", "Full name")).toBe("Enter your full name.");
    expect(nameError("A", "Full name")).toBe("Enter your full name.");
  });

  it("while typing, only flags characters a name can't have", () => {
    expect(nameError("Anne-", "Full name", { typing: true })).toBeNull();
    expect(nameError("Ali ", "Full name", { typing: true })).toBeNull();
    expect(nameError("", "Full name", { typing: true })).toBeNull();
    expect(nameError("Ali1", "Full name", { typing: true })).not.toBeNull();
  });
});

describe("Pakistan dates", () => {
  it("knows today's date in Pakistan whatever the phone's time zone", () => {
    expect(pakistanToday(new Date("2026-10-14T19:30:00Z"))).toBe("2026-10-15"); // 00:30 in Pakistan
    expect(pakistanToday(new Date("2026-10-14T18:59:00Z"))).toBe("2026-10-14");
  });

  it("treats the last valid day as valid all day", () => {
    const now = new Date("2026-10-15T18:00:00Z"); // 23:00 on 15 Oct in Pakistan
    expect(isPastPakistanDate("2026-10-15T00:00:00", now)).toBe(false);
    expect(isPastPakistanDate("2026-10-14T00:00:00", now)).toBe(true);
    expect(isPastPakistanDate("", now)).toBe(false);
  });
});
