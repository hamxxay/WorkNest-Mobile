import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { HeaderAction } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAppSelector } from "../store/hooks";
import { selectUnreadCount } from "../store/slices/notificationSlice";

/**
 * The notifications bell for customer tab headers: unread count from the announcements store.
 * Guests get no bell (they have no announcements).
 */
export function useNotificationsAction(): HeaderAction[] {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const unread = useAppSelector(selectUnreadCount);
  return useMemo(
    () =>
      user
        ? [
            {
              icon: unread > 0 ? "notifications" : "notifications-outline",
              accessibilityLabel: unread > 0 ? `Notifications, ${unread} unread` : "Notifications",
              badge: unread,
              onPress: () => navigation.navigate("Notifications"),
            },
          ]
        : [],
    [navigation, unread, user],
  );
}
