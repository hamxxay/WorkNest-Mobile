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
import { useTheme, useThemeColors, useThemedStyles, type AppColors, type Theme } from "../theme";
import { IconButton } from "./ui";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = { id: string; text: string; from: "user" | "bot" };

// ─── Knowledge base ───────────────────────────────────────────────────────────
const RULES: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["book", "booking", "reserve", "how to book"],
    answer:
      "To book a workspace:\n1. Go to the Booking tab\n2. Search or filter spaces\n3. Tap a card, then Book Now\n4. Pick your dates and slot\n5. Fill in your details\n6. Confirm: you get a bank challan to pay",
  },
  {
    keywords: ["payment", "pay", "price", "cost", "pkr", "fee"],
    answer:
      "Payment is by bank challan. After you confirm a booking, your challan appears under My Bookings and Payments. Pay it at any HBL branch, ATM or in your mobile banking app under 1Bill / Bill Payment. Your booking is confirmed once the payment reaches us.",
  },
  {
    keywords: ["cancel", "cancellation", "refund"],
    answer:
      "You can cancel a booking from My Bookings while it is still pending payment. For a paid booking or a refund, please contact us from the menu (Contact Us).",
  },
  {
    keywords: ["wifi", "internet", "connection"],
    answer: "Each space's amenities are listed on its detail page. For anything not listed, please contact us from the menu (Contact Us).",
  },
  {
    keywords: ["meeting", "conference", "boardroom"],
    answer:
      "Meeting rooms are booked by the hour. Open the Booking tab to see the rooms, their capacity and the listed rate.",
  },
  {
    keywords: ["office", "private", "dedicated"],
    answer:
      "Private offices are booked by the month. Open the Booking tab to see what is available, or book a tour from the menu to visit first.",
  },
  {
    keywords: ["hot desk", "hotdesk", "shared", "cowork", "co-work"],
    answer:
      "Shared desks are booked by the month. Open the Booking tab to see availability and the listed rate.",
  },
  {
    keywords: ["hour", "hourly", "daily", "weekly", "monthly", "plan", "duration"],
    answer:
      "Meeting rooms are booked by the hour; private offices and shared desks by the month. The Booking tab shows each space's listed rate, and the exact amount is on your challan.",
  },
  {
    keywords: ["location", "city", "where", "address"],
    answer:
      "Use the Booking tab to see WorkNest locations and filter spaces by location.",
  },
  {
    keywords: ["amenities", "facilities", "features", "include"],
    answer:
      "Amenities vary by space. The ones a space offers are listed on its detail page.",
  },
  {
    keywords: ["contact", "support", "help", "issue", "problem"],
    answer:
      "For support, open the menu and choose Contact Us. Our team will get back to you as soon as possible.",
  },
  {
    keywords: ["gallery", "photo", "image", "picture"],
    answer:
      "Browse workspace photos in the Gallery (open the menu and choose Gallery).",
  },
  {
    keywords: ["history", "past booking", "my booking"],
    answer:
      "View all your bookings, and their challans, under Profile > My Bookings.",
  },
  {
    keywords: ["hello", "hi", "hey", "greet"],
    answer: "Hello! I'm the WorkNest assistant. Ask me about booking, payments or spaces.",
  },
  {
    keywords: ["thank", "thanks", "great", "awesome"],
    answer: "You're welcome! Let me know if there's anything else I can help with.",
  },
];

const QUICK_QUESTIONS = [
  "How do I book a space?",
  "What payment methods are accepted?",
  "Do spaces have WiFi?",
  "Can I book by the hour?",
  "How do I cancel a booking?",
  "Where are your locations?",
];

const FALLBACK =
  "I'm not sure about that one. Try rephrasing, or contact our team from the menu (Contact Us) for detailed help.";

function getBotReply(input: string): string {
  const lower = input.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.answer;
    }
  }
  return FALLBACK;
}

// ─── Component ────────────────────────────────────────────────────────────────
/** Floating "WorkNest assistant" button and chat sheet (offline answers about booking, payments and spaces). */
export function ChatBot({ visible = true }: { visible?: boolean }) {
  const colors = useThemeColors();
  const { shadows } = useTheme();
  const s = useThemedStyles(makeStyles);
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

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: Date.now().toString(), from: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(trimmed);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), from: "bot", text: reply }]);
      setTyping(false);
    }, 650);
  }

  const fabVisibility = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(fabVisibility, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [fabVisibility, visible]);

  return (
    <>
      <Animated.View
        pointerEvents={visible ? "box-none" : "none"}
        style={[s.fabWrap, { opacity: fabVisibility, transform: [{ scale: fabVisibility }] }]}
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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close assistant" />

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
                {QUICK_QUESTIONS.map((q) => (
                  <Pressable key={q} style={s.quickChip} onPress={() => send(q)} accessibilityRole="button">
                    <Text style={s.quickChipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={s.inputRow}>
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
