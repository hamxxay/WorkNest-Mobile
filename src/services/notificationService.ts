import { PermissionsAndroid, Platform } from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

// Push notifications and announcements for signed-in app users (MobileAnnouncementController):
//   POST /mobile/device-token            the device's FCM token (after sign-in, never for guests)
//   GET  /mobile/announcements           the user's announcements with isRead
//   POST /mobile/announcements/{id}/read mark one as read
// A tapped notification opens the app through the deep-link config (navigation/linking.ts).

type MessagingModule = typeof import("@react-native-firebase/messaging");

/** Firebase Messaging, or null when the native module is unavailable (tests, misconfigured builds). */
function messagingModule(): MessagingModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-firebase/messaging") as MessagingModule;
  } catch {
    return null;
  }
}

function messagingInstance() {
  const mod = messagingModule();
  if (!mod) return null;
  try {
    return { mod, messaging: mod.getMessaging() };
  } catch {
    return null;
  }
}

// ─── Announcements ───────────────────────────────────────────────────────────

export type Announcement = {
  id: string;
  title: string;
  body: string;
  /** Announcement | Alert */
  type: string;
  createdAt: string | null;
  sentAt: string | null;
  isRead: boolean;
  readAt: string | null;
};

export type AnnouncementPage = {
  items: Announcement[];
  total: number;
  page: number;
  limit: number;
};

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export function normalizeAnnouncement(input: unknown): Announcement {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    id: text(raw.id ?? raw.Id),
    title: text(raw.title ?? raw.Title) || "WorkNest",
    body: text(raw.body ?? raw.Body),
    type: text(raw.type ?? raw.Type) || "Announcement",
    createdAt: text(raw.createdAt ?? raw.CreatedAt) || null,
    sentAt: text(raw.sentAt ?? raw.SentAt) || null,
    isRead: raw.isRead === true || raw.IsRead === true,
    readAt: text(raw.readAt ?? raw.ReadAt) || null,
  };
}

/** GET /mobile/announcements — throws a readable ApiError on failure (callers show an error state). */
export async function getAnnouncements(page = 1, limit = 20): Promise<AnnouncementPage> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.mobile.announcements(page, limit), {
    requiresAuth: true,
  });
  const p = (payload ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(payload) ? payload : Array.isArray(p.items) ? (p.items as unknown[]) : [];
  const items = rows.map(normalizeAnnouncement).filter((a) => a.id);
  return {
    items,
    total: Number(p.total ?? items.length) || items.length,
    page: Number(p.page ?? page) || page,
    limit: Number(p.limit ?? limit) || limit,
  };
}

/** POST /mobile/announcements/{id}/read */
export async function markAnnouncementRead(id: string): Promise<void> {
  await apiRequest<unknown>(API_ENDPOINTS.mobile.announcementRead(id), {
    method: "POST",
    requiresAuth: true,
  });
}

// ─── Permission and device token ─────────────────────────────────────────────

/**
 * Asks for permission to show notifications (Android 13+ runtime permission). Call only after sign-in:
 * guests are never asked. Resolves true when notifications may be shown.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      if (typeof Platform.Version === "number" && Platform.Version < 33) return true;
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    const m = messagingInstance();
    if (!m) return false;
    const status = await m.mod.requestPermission(m.messaging);
    return (
      status === m.mod.AuthorizationStatus.AUTHORIZED || status === m.mod.AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

async function postDeviceToken(token: string): Promise<void> {
  await apiRequest<unknown>(API_ENDPOINTS.mobile.deviceToken, {
    method: "POST",
    requiresAuth: true,
    body: { token, platform: Platform.OS === "ios" ? "iOS" : "Android" },
  });
}

/**
 * Signed-in users only: asks for notification permission, then sends the FCM token to POST /mobile/device-token.
 * Resolves the token, or null when permission was refused or messaging is unavailable. Never throws.
 */
export async function registerDeviceToken(): Promise<string | null> {
  const m = messagingInstance();
  if (!m) return null;
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) return null;
    const token = await m.mod.getToken(m.messaging);
    if (!token) return null;
    await postDeviceToken(token);
    return token;
  } catch (error) {
    if (__DEV__) console.warn("[push] device token not registered", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Re-sends the token when FCM rotates it. Returns the unsubscribe function. */
export function subscribeToTokenRefresh(): () => void {
  const m = messagingInstance();
  if (!m) return () => undefined;
  try {
    return m.mod.onTokenRefresh(m.messaging, (token) => {
      postDeviceToken(token).catch(() => undefined);
    });
  } catch {
    return () => undefined;
  }
}

/** A notification received while the app is open (the system shows nothing in that case). */
export function subscribeToForegroundMessages(
  onMessage: (message: { title: string; body: string; data: Record<string, string> }) => void,
): () => void {
  const m = messagingInstance();
  if (!m) return () => undefined;
  try {
    return m.mod.onMessage(m.messaging, async (remoteMessage) => {
      onMessage({
        title: remoteMessage.notification?.title ?? "WorkNest",
        body: remoteMessage.notification?.body ?? "",
        data: (remoteMessage.data ?? {}) as Record<string, string>,
      });
    });
  } catch {
    return () => undefined;
  }
}

// ─── Notification tap -> deep link ───────────────────────────────────────────

const APP_LINK = "myapp://";
const LINK_PREFIXES = ["myapp://", "https://worknestpk.com", "https://work-nest-3936a.web.app"];

/** Screen keywords a push may carry in data.screen, mapped to the app's deep-link paths. */
const SCREEN_PATHS: Record<string, string> = {
  notifications: "notifications",
  announcements: "notifications",
  bookings: "bookings",
  booking: "bookings",
  payments: "payments",
  payment: "payments",
  challan: "payments",
  invoices: "payments",
  agreements: "agreements",
  agreement: "agreements",
  quotations: "quotation",
  quotation: "quotation",
  profile: "profile",
  home: "home",
};

/**
 * The deep link a tapped notification should open. Uses data.link / data.url when it points into the app,
 * data.screen (bookings, payments, agreements, quotation...) or data.quotationId; otherwise Notifications.
 */
export function notificationLink(data?: Record<string, unknown> | null): string {
  const d = data ?? {};
  const link = text(d.link ?? d.url ?? d.deepLink);
  if (link && LINK_PREFIXES.some((prefix) => link.startsWith(prefix))) return link;
  const quotationId = text(d.quotationId);
  if (quotationId && /^[\w-]+$/.test(quotationId)) return `${APP_LINK}quotation/${quotationId}`;
  const path = SCREEN_PATHS[text(d.screen ?? d.type).toLowerCase()];
  return `${APP_LINK}${path ?? "notifications"}`;
}

/** The deep link of the notification that opened the app from a quit state, if any. */
export async function getInitialNotificationLink(): Promise<string | null> {
  const m = messagingInstance();
  if (!m) return null;
  try {
    const message = await m.mod.getInitialNotification(m.messaging);
    return message ? notificationLink(message.data) : null;
  } catch {
    return null;
  }
}

/** Calls `listener` with the deep link of each notification tapped while the app is in the background. */
export function subscribeToNotificationOpens(listener: (url: string) => void): () => void {
  const m = messagingInstance();
  if (!m) return () => undefined;
  try {
    return m.mod.onNotificationOpenedApp(m.messaging, (message) => {
      listener(notificationLink(message?.data));
    });
  } catch {
    return () => undefined;
  }
}
