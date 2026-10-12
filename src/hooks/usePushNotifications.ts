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

/**
 * Push notifications for the signed-in account (pass a stable key such as the email; null for guests).
 * After sign-in only: asks for notification permission, registers the FCM token (POST /mobile/device-token),
 * keeps it current, and refreshes the announcements on start, on a foreground push and when the app returns
 * to the foreground. Guests are never asked for permission; signing out clears the list and deletes the
 * device's FCM token (the API has no unregister endpoint).
 * Usable from any navigator (customer or staff).
 */
export function usePushNotifications(accountKey: string | null | undefined): void {
  const dispatch = useAppDispatch();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!accountKey) {
      dispatch(clearNotifications());
      // Signed out on this device: stop pushes meant for the previous account.
      if (wasSignedIn.current) unregisterDeviceToken();
      wasSignedIn.current = false;
      return;
    }
    wasSignedIn.current = true;

    dispatch(fetchAnnouncements());
    registerDeviceToken().catch(() => undefined);
    const stopTokenRefresh = subscribeToTokenRefresh();
    const stopMessages = subscribeToForegroundMessages(() => {
      dispatch(fetchAnnouncements());
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") dispatch(fetchAnnouncements());
    });

    return () => {
      stopTokenRefresh();
      stopMessages();
      appState.remove();
    };
  }, [accountKey, dispatch]);
}
