import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppDispatch } from "../store/hooks";
import { clearNotifications, fetchAnnouncements } from "../store/slices/notificationSlice";
import {
  registerDeviceToken,
  subscribeToForegroundMessages,
  subscribeToTokenRefresh,
  unregisterDeviceToken,
} from "../services/notificationService";

export type PushNotificationOptions = {
  /**
   * Load the announcements (GET /mobile/announcements) on start, on a foreground push and when the app returns to
   * the foreground. Default true. False for an app that may not call it (the CEO, Sales Manager and Access Officer:
   * the API answers 403 on everything but their own pages, auth/me and the device token; see loadsAnnouncements).
   */
  announcements?: boolean;
};

/**
 * Push notifications for the signed-in account (pass a stable key such as the email; null for guests).
 * After sign-in only: asks for notification permission, registers the FCM token (POST /mobile/device-token),
 * keeps it current, and (unless `announcements` is false) refreshes the announcements on start, on a foreground
 * push and when the app returns to the foreground. Guests are never asked for permission; signing out clears the
 * list and deletes the device's FCM token (the API has no unregister endpoint).
 * Usable from any navigator (customer or staff).
 */
export function usePushNotifications(
  accountKey: string | null | undefined,
  { announcements = true }: PushNotificationOptions = {},
): void {
  const dispatch = useAppDispatch();
  const wasSignedIn = useRef(false);

  // The device token: registered once per account, deleted on sign-out.
  useEffect(() => {
    if (!accountKey) {
      dispatch(clearNotifications());
      // Signed out on this device: stop pushes meant for the previous account.
      if (wasSignedIn.current) unregisterDeviceToken();
      wasSignedIn.current = false;
      return;
    }
    wasSignedIn.current = true;

    registerDeviceToken().catch(() => undefined);
    const stopTokenRefresh = subscribeToTokenRefresh();
    return () => {
      stopTokenRefresh();
    };
  }, [accountKey, dispatch]);

  // The announcements list, for the apps that show it.
  useEffect(() => {
    if (!accountKey || !announcements) return;

    dispatch(fetchAnnouncements());
    const stopMessages = subscribeToForegroundMessages(() => {
      dispatch(fetchAnnouncements());
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") dispatch(fetchAnnouncements());
    });

    return () => {
      stopMessages();
      appState.remove();
    };
  }, [accountKey, announcements, dispatch]);
}
