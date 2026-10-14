import { blue, emerald, orange, slate, violet } from "./palette";

// Tour-inquiry Type (how the visitor found WorkNest): Website, WhatsApp, Walk-In, Reference, or not set on older
// inquiries. Colours match the CMS (Website #1d4ed8, WhatsApp #047857, Walk-In #c2410c, Reference #6d28d9, Not set
// slate); dark mode uses the 400 step of the same hue so marks keep at least 3:1 against the dark card surface.
// Pure (no React), so the CEO service and its tests can use it; components use useInquiryTypeColors().

/** The API's type keys (WN_Contact Type); "NotSet" = no type recorded. */
export type InquiryType = "Website" | "WhatsApp" | "WalkIn" | "Reference" | "NotSet";

/** Display order (charts, legends, lists). */
export const INQUIRY_TYPES: readonly InquiryType[] = ["Website", "WhatsApp", "WalkIn", "Reference", "NotSet"];

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  Website: "Website",
  WhatsApp: "WhatsApp",
  WalkIn: "Walk-In",
  Reference: "Reference",
  NotSet: "Not set",
};

/** Keys are lower-cased with spaces, underscores and dashes removed. */
const ALIASES: Record<string, InquiryType> = {
  website: "Website",
  web: "Website",
  whatsapp: "WhatsApp",
  walkin: "WalkIn",
  reference: "Reference",
  referral: "Reference",
  notset: "NotSet",
  none: "NotSet",
  null: "NotSet",
  unknown: "NotSet",
};

/**
 * The type key for any spelling the API / CMS uses ("Walk-In", "walk_in", "WALKIN"...). Missing or blank is
 * "NotSet"; a non-empty text that is not a known type is null (shown with its own label, in the "Not set" colour).
 */
export function normalizeInquiryType(value: unknown): InquiryType | null {
  if (value == null) return "NotSet";
  const key = String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!key) return "NotSet";
  return ALIASES[key] ?? null;
}

export const lightInquiryTypeColors: Record<InquiryType, string> = {
  Website: blue[700],
  WhatsApp: emerald[700],
  WalkIn: orange[700],
  Reference: violet[700],
  NotSet: slate[500],
};

export const darkInquiryTypeColors: Record<InquiryType, string> = {
  Website: blue[400],
  WhatsApp: emerald[400],
  WalkIn: orange[400],
  Reference: violet[400],
  NotSet: slate[400],
};

/** Colour of an inquiry type in the active mode; an unknown type uses the "Not set" colour. */
export function inquiryTypeColor(type: InquiryType | null | undefined, isDark: boolean): string {
  const colors = isDark ? darkInquiryTypeColors : lightInquiryTypeColors;
  return colors[type ?? "NotSet"] ?? colors.NotSet;
}
