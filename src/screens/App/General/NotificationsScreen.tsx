import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppHeader, AppText, AsyncList, Card, Screen, useToast } from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatRelative } from "../../../utils/format";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  fetchAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementAsRead,
  selectUnreadCount,
} from "../../../store/slices/notificationSlice";
import { useAuth } from "../../../context/AuthContext";
import { GuestState } from "./shared/GuestState";

/** The signed-in user's announcements from the API (GET /mobile/announcements); read state is saved on the API. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { user } = useAuth();
  const items = useAppSelector((s) => s.notifications.items);
  const loading = useAppSelector((s) => s.notifications.loading);
  const loaded = useAppSelector((s) => s.notifications.loaded);
  const error = useAppSelector((s) => s.notifications.error);
  const unread = useAppSelector(selectUnreadCount);

  const refresh = useCallback(() => {
    dispatch(fetchAnnouncements());
  }, [dispatch]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const markAll = async () => {
    const result = await dispatch(markAllAnnouncementsRead());
    if (markAllAnnouncementsRead.rejected.match(result)) {
      toast.error(result.payload ?? "Could not mark the notifications as read.");
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : undefined}
        actions={unread > 0 ? [{ icon: "checkmark-done-outline", accessibilityLabel: "Mark all as read", onPress: markAll }] : []}
      />
      {!user ? (
        <GuestState illustration="bell" title="Sign in for notifications" message="Announcements and alerts from WorkNest appear here." />
      ) : (
        <AsyncList
          data={items}
          keyExtractor={(n) => n.id}
          loading={loading && !loaded}
          refreshing={loading && loaded}
          onRefresh={refresh}
          error={error}
          empty={{
            illustration: "bell",
            title: "No notifications yet",
            message: "Announcements and alerts from WorkNest appear here.",
          }}
          renderItem={({ item }) => (
            <Card
              variant={item.isRead ? "outlined" : "elevated"}
              onPress={item.isRead ? undefined : () => dispatch(markAnnouncementAsRead(item.id))}
              accessibilityLabel={`${item.isRead ? "" : "Unread. "}${item.title}. ${item.body}`}
              accessibilityHint={item.isRead ? undefined : "Marks it as read"}
            >
              <View style={styles.row}>
                <View style={[styles.iconWell, item.isRead ? styles.iconRead : styles.iconUnread]}>
                  <Ionicons
                    name={item.type.toLowerCase() === "alert" ? "alert-circle-outline" : "megaphone-outline"}
                    size={20}
                    color={item.isRead ? colors.textMuted : colors.onPrimarySoft}
                  />
                </View>
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <AppText variant={item.isRead ? "bodyStrong" : "subheading"} numberOfLines={2} style={styles.flex}>
                      {item.title}
                    </AppText>
                    {!item.isRead ? <View style={styles.dot} accessibilityElementsHidden /> : null}
                  </View>
                  {item.body ? (
                    <AppText variant="bodySmall" color="textSecondary">
                      {item.body}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" color="textMuted" style={styles.time}>
                    {formatRelative(item.sentAt ?? item.createdAt)}
                  </AppText>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: t.spacing.md },
    flex: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm },
    iconWell: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    iconUnread: { backgroundColor: c.primarySoft },
    iconRead: { backgroundColor: c.surfaceAlt },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 6 },
    time: { marginTop: t.spacing.xs },
  });
