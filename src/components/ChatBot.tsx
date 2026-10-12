import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { radii, shadows, useThemeColors } from "../theme";

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
export function ChatBot({ visible = true }: { visible?: boolean }) {
  const colors = useThemeColors();
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

  // FAB pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: Date.now().toString(), from: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(trimmed);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), from: "bot", text: reply },
      ]);
      setTyping(false);
    }, 650);
  }

  const s = makeStyles(colors);

  const fabVisibility = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(fabVisibility, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [fabVisibility, visible]);

  return (
    <>
      {/* ── FAB ── */}
      
      <Animated.View pointerEvents={visible ? "auto" : "none"} style={{ opacity: fabVisibility, transform: [{ scale: fabVisibility }] }}>
      <Animated.View style={[s.fabRing, { opacity: fabVisibility, transform: [{ scale: Animated.multiply(pulse, fabVisibility) }] }]} pointerEvents="none" />
      <Pressable accessibilityRole="button" accessibilityLabel="Open WorkNest assistant" style={s.fab} onPress={() => setOpen(true)}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </Pressable>
      </Animated.View>

      {/* ── Chat modal ── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent >
      
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === "ios" ? "padding" : 'height'}
        >

          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />

          <View style={s.sheet}>
            {/* Header */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.avatarWell}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={s.headerTitle}>WorkNest Assistant</Text>
                  <View style={s.onlineRow}>
                    <View style={s.onlineDot} />
                    <Text style={s.onlineText}>Online</Text>
                  </View>
                </View>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Messages */}
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
                  <View style={[s.bubble, s.bubbleBot, s.typingBubble]}>
                    <Text style={s.typingDots}>● ● ●</Text>
                  </View>
                ) : null
              }
            />

            {/* Quick questions */}
            {messages.length <= 2 && (
              <View style={s.quickRow}>
                {QUICK_QUESTIONS.map((q) => (
                  <Pressable key={q} style={s.quickChip} onPress={() => send(q)}>
                    <Text style={s.quickChipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Input */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask something…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={() => send(input)}
              />
              <Pressable
                style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]}
                onPress={() => send(input)}
                disabled={!input.trim()}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    // FAB
    fab: {
      position: "absolute",
      bottom: 24,
      right: 20,
      width: 48,
      height: 48,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99,
      ...shadows.lg,
      shadowColor: colors.primary,
    },
    fabRing: {
      position: "absolute",
      bottom: 24,
      right: 20,
      width: 48,
      height: 48,
      borderRadius: 999,
      backgroundColor: colors.primary,
      opacity: 0.25,
      zIndex: 98,
    },

    // Modal
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      flex: 1/1.08,
      overflow: "hidden",
      ...shadows.lg,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatarWell: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "800", color: colors.foreground },
    onlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
    onlineText: { fontSize: 11, color: "#10b981", fontWeight: "600" },

    // Messages
    messageList: { padding: 16, gap: 10 },
    bubble: {
      maxWidth: "80%",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleBot: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    bubbleTextUser: { color: "#fff" },
    bubbleTextBot: { color: colors.foreground },
    typingBubble: { paddingVertical: 12 },
    typingDots: { color: colors.mutedForeground, fontSize: 12, letterSpacing: 3 },

    // Quick questions
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    quickChip: {
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipText: { fontSize: 12, fontWeight: "600", color: colors.primary },

    // Input
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.foreground,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
