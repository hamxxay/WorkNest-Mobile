import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, AppText, Button, EmptyState, ErrorState, ListSkeleton, useToast } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  WA_MESSAGE_LIMIT,
  getWhatsAppMessages,
  waDisplayName,
  waPhoneLabel,
  waSenderLabel,
  whatsAppUrl,
  type WaMessage,
} from "../../../../services/staff/whatsappInbox";
import { radii, spacing, useTheme } from "../../../../theme";
import { formatDateTime } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { uniqueBy } from "../shared/guards";
import { useAsyncData } from "../shared/hooks";
import { useRefreshColors } from "../shared/refresh";
import { OpenWhatsAppButton, openWhatsAppChat } from "./OpenWhatsApp";

type Route = RouteProp<StaffStackParamList, "WhatsAppConversation">;

const PAGE_SIZE = WA_MESSAGE_LIMIT;

/**
 * One WhatsApp conversation (GET whatsapp/conversations/{id}/messages, oldest first), read only: customer messages on
 * the left, the bot's and staff replies on the right in green, each with its time. Loading the newest messages
 * marks the conversation read on the server, so the menu badge is refreshed after each load. "Load earlier
 * messages" pages back with beforeId. Staff reply from their own WhatsApp ("Open in WhatsApp": header and footer).
 */
export default function WhatsAppConversationScreen() {
  const { params } = useRoute<Route>();
  const c = params.conversation;
  const displayName = waDisplayName(c);
  const url = whatsAppUrl(c.phoneNumber);
  const toast = useToast();
  const refreshColors = useRefreshColors();
  const { refreshBadges } = useStaffSession();
  const { colors } = useTheme();
  const fetcher = useCallback(async () => {
    const messages = await getWhatsAppMessages(c.id, { limit: PAGE_SIZE });
    refreshBadges(); // the API has just marked the conversation read
    return messages;
  }, [c.id, refreshBadges]);
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher, { reloadOnFocus: true });

  // Older pages loaded with "Load earlier messages" (kept across refreshes of the newest page).
  const [older, setOlder] = useState<WaMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const messages = useMemo(
    () => uniqueBy([...older, ...(data ?? [])], (m) => String(m.id)).sort((a, b) => a.id - b.id),
    [older, data],
  );
  const canLoadOlder = !noMoreOlder && (older.length > 0 || (data?.length ?? 0) >= PAGE_SIZE);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getWhatsAppMessages(c.id, { beforeId: first.id, limit: PAGE_SIZE });
      setOlder((prev) => [...page, ...prev]);
      if (page.length < PAGE_SIZE) setNoMoreOlder(true);
    } catch (err) {
      toast.error(errorMessage(err, "Could not load earlier messages."));
    } finally {
      setLoadingOlder(false);
    }
  };

  // Keep the newest message in view: scroll to the end when a newer message arrives (not when older ones load).
  const listRef = useRef<FlatList<WaMessage>>(null);
  const newestId = messages.length ? messages[messages.length - 1].id : 0;
  const scrolledTo = useRef(0);
  const stickToEnd = () => {
    if (newestId && scrolledTo.current !== newestId) {
      scrolledTo.current = newestId;
      listRef.current?.scrollToEnd({ animated: false });
    }
  };
  const subtitle = [c.name ? waPhoneLabel(c.phoneNumber) : null, c.tags].filter(Boolean).join(" · ") || undefined;

  return (
    <StaffScreen>
      <AppHeader
        title={displayName}
        subtitle={subtitle}
        actions={[
          { icon: "refresh", accessibilityLabel: "Refresh messages", onPress: refresh, disabled: refreshing },
          {
            icon: "logo-whatsapp",
            accessibilityLabel: url ? `Message ${displayName} on WhatsApp` : "Open in WhatsApp: no valid number",
            onPress: () => openWhatsAppChat(url),
            disabled: !url,
          },
        ]}
      />
      {c.adminNotes ? (
        <View style={styles.notes}>
          <AppText variant="caption" color="textSecondary" numberOfLines={3}>
            <AppText variant="captionStrong" color="textSecondary">
              Note:{" "}
            </AppText>
            {c.adminNotes}
          </AppText>
        </View>
      ) : null}
      <View style={styles.flex}>
        {loading && !data ? (
          <ListSkeleton rows={5} avatar={false} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={[styles.thread, messages.length === 0 && styles.grow]}
            onContentSizeChange={stickToEnd}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />}
            ListHeaderComponent={
              canLoadOlder && messages.length ? (
                <Button
                  title="Load earlier messages"
                  variant="ghost"
                  size="sm"
                  loading={loadingOlder}
                  onPress={loadOlder}
                  style={styles.older}
                />
              ) : null
            }
            ListEmptyComponent={<EmptyState illustration="inbox" title="No messages yet" compact />}
          />
        )}
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <AppText variant="caption" color="textMuted" align="center">
          {url
            ? "Replies are not sent from the app. Reply from your own WhatsApp."
            : "This contact has no valid WhatsApp number."}
        </AppText>
        <OpenWhatsAppButton url={url} name={displayName} />
      </View>
    </StaffScreen>
  );
}

function MessageBubble({ message: m }: { message: WaMessage }) {
  const { colors, tones } = useTheme();
  const out = m.direction === "outgoing";
  const time = formatDateTime(m.createdOn, { year: false, fallback: "" });
  const senderLabel = waSenderLabel(m);
  const meta = [senderLabel, time].filter(Boolean).join(" · ");
  return (
    <View
      style={[styles.msgRow, out ? styles.msgOut : styles.msgIn]}
      accessible
      accessibilityLabel={`${out ? `Sent${senderLabel ? ` by ${senderLabel}` : ""}` : "Customer"}: ${m.messageText || "(no text)"}${time ? `, ${time}` : ""}`}
    >
      <View
        style={[
          styles.bubble,
          out
            ? [styles.bubbleOut, { backgroundColor: tones.success.bg, borderColor: tones.success.border }]
            : [styles.bubbleIn, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}
      >
        <AppText variant="bodySmall" selectable>
          {m.messageText || (m.messageType !== "text" ? `[${m.messageType}]` : "")}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textMuted" align="right" style={styles.meta}>
            {meta}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1, justifyContent: "center" },
  notes: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  thread: { padding: spacing.screen, gap: spacing.sm },
  older: { alignSelf: "center" },
  msgRow: { flexDirection: "row" },
  msgIn: { justifyContent: "flex-start" },
  msgOut: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleIn: { borderRadius: radii.md, borderBottomLeftRadius: radii.xs / 2 },
  bubbleOut: { borderRadius: radii.md, borderBottomRightRadius: radii.xs / 2 },
  meta: { marginTop: spacing.xs },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
});
