import { MAX_FILE_NAME_LENGTH, safeFileBaseName, safeFileName } from "../fileName";

describe("safeFileName (keeps the extension)", () => {
  it("keeps an ordinary name", () => {
    expect(safeFileName("cnic_front.jpg", "fallback")).toBe("cnic_front.jpg");
    expect(safeFileName("Agreement-12.pdf", "fallback")).toBe("Agreement-12.pdf");
  });

  it("drops folders and path traversal", () => {
    expect(safeFileName("../../shared_prefs/RKStorage.xml", "fallback")).toBe("RKStorage.xml");
    expect(safeFileName("..\\..\\databases\\x.db", "fallback")).toBe("x.db");
    expect(safeFileName("/data/data/com.worknestmobile/files/a.png", "fallback")).toBe("a.png");
    expect(safeFileName("docs/", "KYC-Document-7")).toBe("KYC-Document-7");
  });

  it("replaces spaces and odd characters, never leaves '..' or a leading dot", () => {
    expect(safeFileName("CNIC front (1).JPG", "fallback")).toBe("CNIC-front-1.JPG");
    expect(safeFileName('a:b*c?"d<e>|f.pdf', "fallback")).toBe("a-b-c-d-e-f.pdf");
    expect(safeFileName("..hidden..pdf", "fallback")).toBe("hidden.pdf");
    expect(safeFileName(".env", "fallback")).toBe("fallback.env");
    expect(safeFileName("bad\u0000name\n.png", "fallback")).toBe("bad-name.png");
    expect(safeFileName("شناختی کارڈ.jpg", "KYC-Document-3")).toBe("KYC-Document-3.jpg");
  });

  it("uses the (cleaned) fallback when nothing usable is left", () => {
    expect(safeFileName(null, "KYC-Document-5")).toBe("KYC-Document-5");
    expect(safeFileName("   ", "KYC-Document-5")).toBe("KYC-Document-5");
    expect(safeFileName("../..", "../KYC Document")).toBe("KYC-Document");
    expect(safeFileName("", "")).toBe("file");
  });

  it("caps very long names and keeps the extension", () => {
    const result = safeFileName(`${"a".repeat(300)}.pdf`, "fallback");
    expect(result).toBe(`${"a".repeat(MAX_FILE_NAME_LENGTH)}.pdf`);
  });
});

describe("safeFileBaseName (extension removed, for the share sheet)", () => {
  it("removes any extension by default", () => {
    expect(safeFileBaseName("cnic_front.jpeg", "fallback")).toBe("cnic_front");
    expect(safeFileBaseName("../../x/Report 2026.pdf", "fallback")).toBe("Report-2026");
  });

  it("removes only the given extension", () => {
    expect(safeFileBaseName("Invoice.v2.pdf", "fallback", /\.pdf$/i)).toBe("Invoice.v2");
    expect(safeFileBaseName("Invoice.v2", "fallback", /\.pdf$/i)).toBe("Invoice.v2");
  });

  it("falls back when the name is empty or only unsafe characters", () => {
    expect(safeFileBaseName(undefined, "WorkNest-Agreement-4")).toBe("WorkNest-Agreement-4");
    expect(safeFileBaseName("/../", "WorkNest file")).toBe("WorkNest-file");
    expect(safeFileBaseName(".pdf", "x", /\.pdf$/i)).toBe("x");
    expect(safeFileBaseName("شناختی کارڈ.jpg", "KYC-Document-3")).toBe("KYC-Document-3");
    expect(safeFileBaseName("", "")).toBe("file");
  });

  it("never returns a path separator or '..'", () => {
    for (const input of ["../../../etc/passwd", "..\\..\\a", "a/../../b.png", "....", "..../x/..png"]) {
      const result = safeFileBaseName(input, "fallback");
      expect(result).not.toMatch(/[\\/]/);
      expect(result).not.toContain("..");
      expect(result.startsWith(".")).toBe(false);
    }
  });
});
