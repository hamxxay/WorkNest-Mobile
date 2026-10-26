import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { listWhatsAppConversations, unreadConversationCount } from "../../../../services/staff/whatsappInbox";

/**
 * WhatsApp conversations with unread customer messages, for the "WhatsApp Inbox" badge of the staff menu (the CMS
 * sidebar's green unread pill). Loaded when the screen gains focus and when the app comes back to the foreground
 * while the screen is focused; no polling. A failed load shows no badge (0) rather than an error or a stale count.
 */
export function useWhatsAppUnread(enabled = true): number {
  const focused = useIsFocused();
  const [count, setCount] = useState(0);
  const mounted = useRef(true);
  /** Only the newest request may set the count (an older, slower answer is dropped). */
  const requestId = useRef(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  const load = useCallback(() => {
    const id = ++requestId.current;
    listWhatsAppConversations()
      .then((list) => {
        if (mounted.current && id === requestId.current) setCount(unreadConversationCount(list));
      })
      .catch(() => {
        if (mounted.current && id === requestId.current) setCount(0);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled && focused) load();
  }, [enabled, focused, load]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && focusedRef.current) load();
    });
    return () => sub.remove();
  }, [enabled, load]);

  return enabled ? count : 0;
}
