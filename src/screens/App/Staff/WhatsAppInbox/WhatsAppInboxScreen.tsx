import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Avatar, Badge, Card } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import {
  listWhatsAppConversations,
  unreadConversationCount,
  waDisplayName,
  waPhoneLabel,
  whatsAppUrl,
  type WaConversation,
} from "../../../../services/staff/whatsappInbox";
import { spacing } from "../../../../theme";
import { formatRelative } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useAsyncData, useDebounced } from "../shared/hooks";
import { WhatsAppIconButton } from "./OpenWhatsApp";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/**
 * WhatsApp Inbox (GET whatsapp/conversations?search=), read only: the conversations with the WorkNest WhatsApp
 * number, unread first (the newest 100, as the CMS inbox). A row opens the conversation (which marks it read); its
 * WhatsApp button opens the chat in the phone's WhatsApp, where staff reply (the app does not send). Pull to
 * refresh; coming back to the screen reloads quietly and refreshes the staff badges (GET admin/nav-badges).
 */
export default function WhatsAppInboxScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshBadges } = useStaffSession();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const fetcher = useCallback(() => listWhatsAppConversations(search), [search]);
  const { data, loading, refreshing, error, refresh, setData } = useAsyncData(fetcher, { reloadOnFocus: true });
  const items = data ?? [];
  const unread = unreadConversationCount(items);

  useFocusEffect(
    useCallback(() => {
      refreshBadges();
    }, [refreshBadges]),
  );

  const onRefresh = () => {
    refresh();
    refreshBadges();
  };

  const open = (conversation: WaConversation) => {
    // Opening it marks it read on the server: clear the row's count now (the focus reload confirms it).
    if (conversation.unreadCount > 0) {
      setData((rows) => rows?.map((r) => (r.id === conversation.id ? { ...r, unreadCount: 0 } : r)) ?? rows);
    }
    navigation.navigate("WhatsAppConversation", { conversation });
  };

  const subtitle = unread > 0 ? `${unread} unread` : items.length ? `${items.length} conversations` : undefined;

  return (
    <StaffScreen>
      <AppHeader title="WhatsApp Inbox" subtitle={subtitle} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, number, tag or message" />
      <AsyncList
        data={data}
        keyExtractor={(c) => String(c.id)}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={
          search
            ? { illustration: "search", title: "No conversations found", message: "Try another name, number or word." }
            : { illustration: "inbox", title: "No conversations yet", message: "Messages to the WorkNest WhatsApp number show up here." }
        }
        renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => open(item)} />}
      />
    </StaffScreen>
  );
}

function ConversationRow({ conversation: c, onPress }: { conversation: WaConversation; onPress: () => void }) {
  const unread = c.unreadCount > 0;
  const displayName = waDisplayName(c);
  const phoneLabel = waPhoneLabel(c.phoneNumber);
  const time = c.lastMessageAt ? formatRelative(c.lastMessageAt, new Date(), "") : "";
  const preview = c.lastMessageText || "No messages yet";
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[displayName, unread ? `${c.unreadCount} unread` : null, preview, time].filter(Boolean).join(", ")}
    >
      <View style={styles.row}>
        <Avatar name={c.name || "#"} size={44} />
        <View style={styles.body}>
          <View style={styles.line}>
            <AppText variant={unread ? "bodyStrong" : "body"} numberOfLines={1} style={styles.flex}>
              {displayName}
            </AppText>
            {time ? (
              <AppText variant="caption" color={unread ? "success" : "textMuted"} weight={unread ? "600" : undefined}>
                {time}
              </AppText>
            ) : null}
          </View>
          <View style={styles.line}>
            <AppText
              variant="bodySmall"
              color={unread ? "text" : "textSecondary"}
              numberOfLines={2}
              style={styles.flex}
            >
              {preview}
            </AppText>
            {unread ? <Badge count={c.unreadCount} tone="success" accessibilityLabel={`${c.unreadCount} unread`} /> : null}
          </View>
          {c.name ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {[phoneLabel, c.tags].filter(Boolean).join(" · ")}
            </AppText>
          ) : c.tags ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {c.tags}
            </AppText>
          ) : null}
        </View>
        <WhatsAppIconButton url={whatsAppUrl(c.phoneNumber)} name={displayName} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  body: { flex: 1, minWidth: 0, gap: spacing.xxs },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
