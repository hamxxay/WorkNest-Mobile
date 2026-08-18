import { Platform } from "react-native";
import { store } from "../store/store";
import { addNotification, persistNotifications, type AppNotification } from "../store/slices/notificationSlice";
import { apiRequest } from "./apiClient";
import { buildApiPath } from "../config/api";

// Lazy-load Firebase Messaging to avoid crashing if module is unavailable
async function getMessaging() {
  try {
    const mod = await import("@react-native-firebase/messaging");
    return mod.default();
  } catch {
    return null;
  }
}

async function getAuthorizationStatus() {
  try {
    const mod = await import("@react-native-firebase/messaging");
    return mod.AuthorizationStatus;
  } catch {
    return null;
  }
}

async function saveToBackend(notification: AppNotification): Promise<void> {
  try {
    await apiRequest(buildApiPath("notifications"), {
      method: "POST",
      requiresAuth: true,
      body: {
        title: notification.title,
        body: notification.body,
        data: notification.data ?? {},
        receivedAt: notification.receivedAt,
      },
    });
  } catch {
    // Non-blocking — local store is the source of truth
  }
}

function buildNotification(title: string, body: string, data?: Record<string, string>): AppNotification {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    body,
    data,
    receivedAt: new Date().toISOString(),
    read: false,
  };
}

function dispatch(notification: AppNotification) {
  store.dispatch(addNotification(notification));
  const updated = store.getState().notifications.items;
  store.dispatch(persistNotifications(updated) as any);
  saveToBackend(notification);
}

export async function registerFCMToken(): Promise<string | null> {
  const messaging = await getMessaging();
  if (!messaging) return null;

  try {
    if (Platform.OS === "ios") {
      const AuthorizationStatus = await getAuthorizationStatus();
      const authStatus = await messaging.requestPermission();
      const granted =
        authStatus === AuthorizationStatus?.AUTHORIZED ||
        authStatus === AuthorizationStatus?.PROVISIONAL;
      if (!granted) return null;
    } else {
      const { PermissionsAndroid } = await import("react-native");
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return null;
    }

    const token = await messaging.getToken();


    // Save FCM token to backend so server can send targeted pushes
    try {
      await apiRequest(buildApiPath("notifications/register-token"), {
        method: "POST",
        requiresAuth: true,
        body: { token, platform: Platform.OS },
      });
    } catch {
      // Non-blocking
    }

    return token;
  } catch {
    return null;
  }
}

export async function setupPushNotifications(): Promise<() => void> {
  const messaging = await getMessaging();
  if (!messaging) return () => {};

  const unsubscribeForeground = messaging.onMessage(async remoteMessage => {
    const title = remoteMessage.notification?.title ?? "WorkNest";
    const body = remoteMessage.notification?.body ?? "";
    const data = remoteMessage.data as Record<string, string> | undefined;
    dispatch(buildNotification(title, body, data));
  });

  // Background / quit state — fires when user taps the notification
  messaging.onNotificationOpenedApp(remoteMessage => {
    if (!remoteMessage) return;
    const title = remoteMessage.notification?.title ?? "WorkNest";
    const body = remoteMessage.notification?.body ?? "";
    const data = remoteMessage.data as Record<string, string> | undefined;
    dispatch(buildNotification(title, body, data));
  });

  // App opened from quit state via notification
  const initial = await messaging.getInitialNotification();
  if (initial) {
    const title = initial.notification?.title ?? "WorkNest";
    const body = initial.notification?.body ?? "";
    const data = initial.data as Record<string, string> | undefined;
    dispatch(buildNotification(title, body, data));
  }

  return () => { unsubscribeForeground(); };
}

// Utility to manually push a local notification (e.g. after booking confirmed)
export function pushLocalNotification(title: string, body: string, data?: Record<string, string>) {
  dispatch(buildNotification(title, body, data));
}
