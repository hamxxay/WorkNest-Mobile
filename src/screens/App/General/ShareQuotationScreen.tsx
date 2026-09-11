import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../../theme";
import { isValidEmail } from "../../../utils/validation";
import type { AppStackParamList } from "../../../navigation/types";
import type { Quotation } from "../../../data/mockQuotationData";
import { getQuotationById, sendQuotation } from "../../../services/mockQuotationService";

// ─── Deep link base ───────────────────────────────────────────────────────────
// When the real backend is ready, replace this with a dynamic universal link
// e.g. https://worknestpk.com/quotation/QUO-1001
const DEEP_LINK_BASE = "https://work-nest-3936a.web.app/quotation";

export default function ShareQuotationScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "ShareQuotation">>();
  const { quotationId } = route.params;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const deepLink = `${DEEP_LINK_BASE}/${quotationId}`;

  const [toEmail, setToEmail] = useState("");
  const [toEmailError, setToEmailError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [subject, setSubject] = useState(`WorkNest Quotation ${quotationId}`);
  const [body, setBody] = useState("");

  useEffect(() => {
    getQuotationById(quotationId).then((q) => {
      if (q) {
        setQuotation(q);
        setSubject(`WorkNest Quotation ${quotationId} — PKR ${q.total.toLocaleString()}`);
        setBody(buildEmailBody(quotationId, q, deepLink));
      }
    }).catch(() => {});
  }, [quotationId, deepLink]);

  function validate(): boolean {
    if (!toEmail.trim()) { setToEmailError("Recipient email is required."); return false; }
    if (!isValidEmail(toEmail)) { setToEmailError("Enter a valid email address."); return false; }
    setToEmailError("");
    return true;
  }

  async function handleSend() {
    if (!validate()) return;
    setSending(true);
    try {
      await sendQuotation(quotationId, {
        recipientEmail: toEmail.trim(),
        subject: subject.trim() || undefined,
        message: body.trim() || undefined,
      });
      setSent(true);
    } catch (error) {
      Alert.alert("Unable to Send", error instanceof Error ? error.message : "Unable to send this quotation right now.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={s.center}>
          <Ionicons name="mail" size={64} color={colors.primary} />
          <Text style={s.successTitle}>Quotation Sent!</Text>
          <Text style={s.successBody}>
            The quotation has been sent to {toEmail.trim()}. The recipient can use the deep link to open it directly in the app.
          </Text>
          <View style={s.linkPreview}>
            <Text style={s.linkPreviewLabel}>Deep Link</Text>
            <Text style={s.linkPreviewValue}>{deepLink}</Text>
          </View>
          <Pressable style={s.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={s.primaryBtnText}>Back to Quotation</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={() => setSent(false)}>
            <Text style={s.secondaryBtnText}>Send to Another</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Top bar */}
          <View style={s.topBar}>
            <Pressable style={s.topBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={s.topTitle}>Share Quotation</Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={s.subtitle}>
            Send a quotation email with a deep link. The recipient can tap the link to open <Text style={s.ref}>{quotationId}</Text> directly in the app.
          </Text>

          {/* Deep link preview */}
          <View style={s.deepLinkCard}>
            <View style={s.deepLinkRow}>
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={s.deepLinkLabel}>Deep Link</Text>
            </View>
            <Text style={s.deepLinkValue}>{deepLink}</Text>
            <Text style={s.deepLinkHint}>
              Opens the app directly to this quotation. If the app is not installed, the user will need to install it first.
            </Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            {/* To */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>To <Text style={s.required}>*</Text></Text>
              <TextInput
                value={toEmail}
                onChangeText={(v) => { setToEmail(v); setToEmailError(""); }}
                placeholder="recipient@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[s.input, !!toEmailError && s.inputError]}
              />
              {!!toEmailError && <Text style={s.fieldError}>{toEmailError}</Text>}
            </View>

            {/* Subject */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Email subject"
                placeholderTextColor={colors.mutedForeground}
                style={s.input}
              />
            </View>

            {/* Body */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Message</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Email body"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={10}
                style={[s.input, s.textArea]}
                textAlignVertical="top"
              />
            </View>
          </View>

          <Pressable style={[s.primaryBtn, sending && { opacity: 0.6 }]} onPress={handleSend} disabled={sending}>
            {sending ? <Ionicons name="hourglass-outline" size={18} color="#fff" /> : <Ionicons name="mail-outline" size={18} color="#fff" />}
            <Text style={s.primaryBtnText}>{sending ? "Sending…" : "Send Quotation"}</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── Email body builder ───────────────────────────────────────────────────────
function buildEmailBody(
  quotationId: string,
  quotation: Quotation | undefined,
  deepLink: string
): string {
  const itemLines = quotation?.items
    .map((i) => `  • ${i.name} × ${i.quantity} = PKR ${i.total.toLocaleString()}`)
    .join("\n") ?? "";

  return `Dear ${quotation?.customerName ?? "Customer"},

Please find your WorkNest quotation details below.

──────────────────────────
QUOTATION: ${quotationId}
Date:      ${quotation?.quotationDate ?? "—"}
Valid Until: ${quotation?.validUntil ?? "—"}
──────────────────────────

ITEMS:
${itemLines}

──────────────────────────
TOTAL: PKR ${quotation?.total.toLocaleString() ?? "—"}
──────────────────────────

To view and action this quotation, tap the link below on your mobile device:

${deepLink}

(The link will open the WorkNest app directly to your quotation. If you don't have the app installed, please download it from the Play Store first.)

Regards,
WorkNest Team
+92 308 0256000
worknestpk.com`;
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
    topBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
    ref: { color: colors.primary, fontWeight: "700" },

    deepLinkCard: { backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 6 },
    deepLinkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    deepLinkLabel: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    deepLinkValue: { color: colors.foreground, fontSize: 14, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    deepLinkHint: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17 },

    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 },
    fieldGroup: { gap: 4 },
    label: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
    required: { color: colors.danger },
    input: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: colors.muted, color: colors.foreground, fontSize: 14 },
    inputError: { borderColor: colors.danger },
    textArea: { minHeight: 200, paddingTop: 11 },
    fieldError: { color: colors.danger, fontSize: 12 },

    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 15 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryBtn: { alignItems: "center", paddingVertical: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, width: "100%" },
    secondaryBtnText: { color: colors.foreground, fontWeight: "700" },

    successTitle: { color: colors.foreground, fontSize: 22, fontWeight: "800" },
    successBody: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 21 },
    linkPreview: { backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 4, width: "100%" },
    linkPreviewLabel: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    linkPreviewValue: { color: colors.foreground, fontSize: 13, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  });
