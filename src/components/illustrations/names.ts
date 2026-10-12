/**
 * Names of the empty / error state illustrations. Pure data (no React Native imports), so services, tests and
 * screens can use the names without loading react-native-svg.
 */
export const ILLUSTRATION_NAMES = [
  "calendar", // no bookings
  "receipt", // no payments / invoices / challans
  "document", // no agreements / quotations / KYC documents
  "people", // no customers / attendants / users
  "bell", // no notifications
  "search", // no results for a search or filter
  "inbox", // no inquiries / complaints / requests
  "door", // no access yet (door with a key)
  "chart", // no data yet
  "cloud-off", // load failed / offline (ErrorState default)
  "building", // no spaces / locations
  "image", // no photos
] as const;

export type IllustrationName = (typeof ILLUSTRATION_NAMES)[number];

/** True when `value` is one of ILLUSTRATION_NAMES (for names that come from data or route params). */
export function isIllustrationName(value: unknown): value is IllustrationName {
  return typeof value === "string" && (ILLUSTRATION_NAMES as readonly string[]).includes(value);
}
