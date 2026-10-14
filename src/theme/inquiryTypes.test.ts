import {
  INQUIRY_TYPES,
  INQUIRY_TYPE_LABELS,
  darkInquiryTypeColors,
  inquiryTypeColor,
  lightInquiryTypeColors,
  normalizeInquiryType,
} from "./inquiryTypes";

describe("inquiry types", () => {
  it.each([
    ["Website", "Website"],
    ["website", "Website"],
    ["WhatsApp", "WhatsApp"],
    ["whats_app", "WhatsApp"],
    ["WalkIn", "WalkIn"],
    ["Walk-In", "WalkIn"],
    ["walk in", "WalkIn"],
    ["Reference", "Reference"],
    ["NotSet", "NotSet"],
    ["", "NotSet"],
    [null, "NotSet"],
    [undefined, "NotSet"],
    ["Billboard", null],
  ])("%p is %p", (input, expected) => {
    expect(normalizeInquiryType(input)).toBe(expected);
  });

  it("has a label for every type", () => {
    expect(INQUIRY_TYPES.map((t) => INQUIRY_TYPE_LABELS[t])).toEqual(["Website", "WhatsApp", "Walk-In", "Reference", "Not set"]);
  });

  it("uses the CMS colours in light mode and lighter steps of the same hues in dark mode", () => {
    expect(lightInquiryTypeColors).toEqual({
      Website: "#1d4ed8",
      WhatsApp: "#047857",
      WalkIn: "#c2410c",
      Reference: "#6d28d9",
      NotSet: "#64748b",
    });
    for (const t of INQUIRY_TYPES) expect(darkInquiryTypeColors[t]).not.toBe(lightInquiryTypeColors[t]);
    expect(inquiryTypeColor("WalkIn", false)).toBe("#c2410c");
    expect(inquiryTypeColor("WalkIn", true)).toBe(darkInquiryTypeColors.WalkIn);
    expect(inquiryTypeColor(null, true)).toBe(darkInquiryTypeColors.NotSet);
  });
});
