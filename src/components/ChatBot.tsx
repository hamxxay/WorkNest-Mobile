import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemeColors, useThemedStyles, type AppColors, type Theme } from "../theme";
import { IconButton } from "./ui";
import { useTabBarSpace } from "./ui/TabBar";
import { CHAT_QUICK_QUESTIONS, getBotReply } from "./chatBotReplies";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = { id: string; text: string; from: "user" | "bot" };

// ─── Component ────────────────────────────────────────────────────────────────
/** Floating "WorkNest assistant" button and chat sheet (offline answers about booking, payments and spaces). */
export function ChatBot({ visible = true }: { visible?: boolean }) {
  const colors = useThemeColors();
  const { shadows } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      from: "bot",
      text: "Hi! I'm your WorkNest assistant. Ask me about booking, payments or spaces, or pick a quick question below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  // Message ids from a counter: two messages in the same millisecond never share a React key.
  const nextId = useRef(1);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: `m${nextId.current++}`, from: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(trimmed);
      setMessages((prev) => [...prev, { id: `m${nextId.current++}`, from: "bot", text: reply }]);
      setTyping(false);
    }, 650);
  }

  // On a tab screen the button floats above the floating tab bar.
  const tabBarSpace = useTabBarSpace();
  const fabVisibility = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(fabVisibility, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [fabVisibility, visible]);

  return (
    <>
      <Animated.View
        pointerEvents={visible ? "box-none" : "none"}
        style={[s.fabWrap, { bottom: s.fabWrap.bottom + tabBarSpace, opacity: fabVisibility, transform: [{ scale: fabVisibility }] }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open WorkNest assistant"
          style={[s.fab, shadows.md]}
          android_ripple={{ color: colors.rippleOnPrimary, borderless: true }}
          onPress={() => setOpen(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close assistant" />

          <View style={s.sheet}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.avatarWell}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.onPrimary} />
                </View>
                <View>
                  <Text style={s.headerTitle}>WorkNest Assistant</Text>
                  <Text style={s.headerSub}>Quick answers about booking and payments</Text>
                </View>
              </View>
              <IconButton icon="close" accessibilityLabel="Close assistant" onPress={() => setOpen(false)} />
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={s.messageList}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[s.bubble, item.from === "user" ? s.bubbleUser : s.bubbleBot]}>
                  <Text style={[s.bubbleText, item.from === "user" ? s.bubbleTextUser : s.bubbleTextBot]}>
                    {item.text}
                  </Text>
                </View>
              )}
              ListFooterComponent={
                typing ? (
                  <View style={[s.bubble, s.bubbleBot]}>
                    <Text style={s.typing}>Typing...</Text>
                  </View>
                ) : null
              }
            />

            {messages.length <= 2 && (
              <View style={s.quickRow}>
                {CHAT_QUICK_QUESTIONS.map((q) => (
                  <Pressable key={q} style={s.quickChip} onPress={() => send(q)} accessibilityRole="button">
                    <Text style={s.quickChipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Edge-to-edge: keep the input above the gesture bar / navigation buttons. */}
            <View style={[s.inputRow, { paddingBottom: 12 + insets.bottom }]}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask something"
                placeholderTextColor={colors.placeholder}
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={() => send(input)}
                accessibilityLabel="Your question"
              />
              <IconButton
                icon="send"
                variant="primary"
                accessibilityLabel="Send"
                onPress={() => send(input)}
                disabled={!input.trim()}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    fabWrap: { position: "absolute", bottom: 20, right: 16, zIndex: 99 },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primaryStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: t.radii.sheet,
      borderTopRightRadius: t.radii.sheet,
      height: "85%",
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: t.spacing.lg,
      paddingRight: t.spacing.sm,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatarWell: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.primaryStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { ...t.typography.subheading, color: c.text },
    headerSub: { ...t.typography.caption, color: c.textMuted },
    messageList: { padding: t.spacing.lg, gap: 10 },
    bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { alignSelf: "flex-end", backgroundColor: c.primaryStrong, borderBottomRightRadius: 4 },
    bubbleBot: {
      alignSelf: "flex-start",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 4,
    },
    bubbleText: { ...t.typography.bodySmall },
    bubbleTextUser: { color: c.onPrimary },
    bubbleTextBot: { color: c.text },
    typing: { ...t.typography.caption, color: c.textMuted },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: 10,
    },
    quickChip: {
      backgroundColor: c.primarySoft,
      borderRadius: t.radii.pill,
      paddingHorizontal: 12,
      minHeight: 36,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    quickChipText: { ...t.typography.captionStrong, color: c.onPrimarySoft },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    input: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: t.radii.control,
      borderWidth: 1,
      borderColor: c.inputBorder,
      paddingHorizontal: 14,
      minHeight: 44,
      ...t.typography.bodySmall,
      color: c.text,
    },
  });
