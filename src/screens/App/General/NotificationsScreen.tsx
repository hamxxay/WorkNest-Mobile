import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../../components/Screen';
import { useThemeColors, shadows, radii, spacing } from '../../../theme';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementAsRead,
  selectUnreadCount,
} from '../../../store/slices/notificationSlice';

// The signed-in user's announcements from the API (GET /mobile/announcements); read state is saved on the API.
export default function NotificationsScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(s => s.notifications.items);
  const loading = useAppSelector(s => s.notifications.loading);
  const error = useAppSelector(s => s.notifications.error);
  const unreadCount = useAppSelector(selectUnreadCount);

  const refresh = useCallback(() => {
    dispatch(fetchAnnouncements());
  }, [dispatch]);

  const handleMarkAllRead = () => {
    dispatch(markAllAnnouncementsRead());
  };

  const handleRead = (id: string, isRead: boolean) => {
    if (!isRead) dispatch(markAnnouncementAsRead(id));
  };

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead} hitSlop={10}>
              <Text style={[styles.actionText, { color: colors.primary }]}>
                Read all
              </Text>
            </Pressable>
          )}

        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : styles.list
        }
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {error ? 'Notifications not loaded' : 'No notifications yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {error ?? "You'll see announcements and alerts from WorkNest here."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleRead(item.id, item.isRead)}
            style={[
              {
                backgroundColor: item.isRead ? colors.card : colors.primaryMuted,
                borderColor: item.isRead ? colors.border : colors.primary + '40',
              },
              styles.card,
               item.isRead && shadows.lg,
            ]}
          >
            <View
              style={[
                styles.iconWell,
                { backgroundColor: item.isRead ? colors.muted : colors.primary },
              ]}
            >
              <Ionicons
                name={item.isRead ? 'notifications-outline' : 'notifications'}
                size={18}
                color={item.isRead ? colors.mutedForeground : '#fff'}
              />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {!item.isRead && (
                  <View
                    style={[
                      styles.unreadDot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[styles.cardBody2, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {item.body}
              </Text>
              <Text
                style={[styles.cardTime, { color: colors.mutedForeground }]}
              >
                {formatTime(item.sentAt ?? item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  badge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: spacing.md },
  actionText: { fontSize: 13, fontWeight: '700' },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: spacing.sm },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  cardBody2: { fontSize: 13, lineHeight: 19 },
  cardTime: { fontSize: 11, marginTop: 5, fontWeight: '600' },
});
