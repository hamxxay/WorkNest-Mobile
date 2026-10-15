// The app's link prefixes (pure, shared by every role's navigator and by notification taps).
//
// worknest:// is the app's own scheme. myapp:// is the generic scheme of the first builds: still accepted so links
// already sent (emails, WhatsApp messages, old notifications) keep opening the app. https links come from the
// website domains (Android App Links / iOS universal links).

/** The app's own custom scheme (AndroidManifest.xml and Info.plist register it). */
export const APP_SCHEME = "worknest://";

/** The first builds' scheme, kept working for old links. */
export const LEGACY_APP_SCHEME = "myapp://";

export const APP_LINK_PREFIXES: string[] = [
  APP_SCHEME,
  LEGACY_APP_SCHEME,
  "https://worknestpk.com",
  "https://work-nest-3936a.web.app",
];
