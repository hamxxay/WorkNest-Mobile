import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { submitChallanRequest } from "../../services/mockQuotationService";
import {
  simulateAdminNotification,
  simulateChallanReadyNotification,
} from "../../services/mockNotificationService";
import { MOCK_CHALLANS } from "../../data/mockQuotationData";
import { isValidEmail } from "../../utils/validation";
import type { AppStackParamList } from "../../navigation/types";

type Field = { value: string; error: string };
const field = (value = ""): Field => ({ value, error: "" });

export default function CustomerInfoScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "CustomerInfo">>();
  const { quotationId } = route.params;

  const [fullName, setFullName] = useState(field());
  const [cnic, setCnic] = useState(field());
  const [mobile, setMobile] = useState(field());
  const [sameAsWhatsApp, setSameAsWhatsApp] = useState(true);
  const [whatsapp, setWhatsapp] = useState(field());
  const [email, setEmail] = useState(field());
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [challanReady, setChallanReady] = useState(false);
  const [challanId, setChallanId] = useState("");

  function validate(): boolean {
    let valid = true;
    const set = (setter: typeof setFullName, msg: string) => {
      setter((f) => ({ ...f, error: msg }));
      if (msg) valid = false;
    };
    set(setFullName, fullName.value.trim() ? "" : "Full name is required.");
    set(setCnic, cnic.value.trim() ? "" : "CNIC is required.");
    set(setMobile, mobile.value.trim() ? "" : "Mobile number is required.");
    if (!sameAsWhatsApp) {
      set(setWhatsapp, whatsapp.value.trim() ? "" : "WhatsApp number is required.");
    }
    set(setEmail, !email.value.trim() ? "Email is required." : !isValidEmail(email.value) ? "Enter a valid email address." : "");
    return valid;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await submitChallanRequest(quotationId, {
        fullName: fullName.value.trim(),
        cnic: cnic.value.trim(),
        mobile: mobile.value.trim(),
        whatsapp: sameAsWhatsApp ? mobile.value.trim() : whatsapp.value.trim(),
        email: email.value.trim(),
      });
      await simulateAdminNotification(quotationId);
      setSubmitted(true);

      // Simulate admin processing → customer receives challan-ready notification
      const mockChallan = MOCK_CHALLANS[quotationId];
      if (mockChallan) {
        simulateChallanReadyNotification(
          quotationId,
          mockChallan.challanId,
          mockChallan.amount,
          (n) => {
            setChallanId(n.challanId ?? "");
            setChallanReady(true);
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Screen>
        <View style={s.successContainer}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text style={s.successTitle}>Request Submitted!</Text>
          <Text style={s.successBody}>
            Your challan request has been submitted successfully. Our team will process it shortly.
          </Text>

          {challanReady ? (
            <View style={s.challanReadyCard}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.challanReadyTitle}>Your challan is ready 🎉</Text>
                <Text style={s.challanReadyBody}>Challan {challanId} has been generated. Proceed to payment.</Text>
              </View>
            </View>
          ) : (
            <View style={s.waitingCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.waitingText}>Waiting for admin to process your request…</Text>
            </View>
          )}

          {challanReady && (
            <Pressable
              style={s.primaryBtn}
              onPress={() => navigation.navigate("QuotationPayment", { quotationId })}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Proceed to Payment</Text>
            </Pressable>
          )}

          <Pressable style={s.secondaryBtn} onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}>
            <Text style={s.secondaryBtnText}>Back to Home</Text>
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
            <Text style={s.topTitle}>Customer Information</Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={s.subtitle}>Please fill in your details to request a challan for quotation <Text style={s.quotationRef}>{quotationId}</Text>.</Text>

          {/* Form */}
          <View style={s.card}>
            <FormField label="Full Name" required value={fullName.value} error={fullName.error}
              onChangeText={(v) => setFullName({ value: v, error: "" })}
              placeholder="e.g. Ali Khan" />

            <FormField label="CNIC" required value={cnic.value} error={cnic.error}
              onChangeText={(v) => setCnic({ value: v, error: "" })}
              placeholder="e.g. 35202-1234567-1" keyboardType="number-pad" />

            <FormField label="Mobile Number" required value={mobile.value} error={mobile.error}
              onChangeText={(v) => setMobile({ value: v, error: "" })}
              placeholder="e.g. 0300 1234567" keyboardType="phone-pad" />

            {/* WhatsApp toggle */}
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>WhatsApp same as mobile</Text>
              <Switch
                value={sameAsWhatsApp}
                onValueChange={setSameAsWhatsApp}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>

            {!sameAsWhatsApp && (
              <FormField label="WhatsApp Number" required value={whatsapp.value} error={whatsapp.error}
                onChangeText={(v) => setWhatsapp({ value: v, error: "" })}
                placeholder="e.g. 0300 1234567" keyboardType="phone-pad" />
            )}

            <FormField label="Email Address" required value={email.value} error={email.error}
              onChangeText={(v) => setEmail({ value: v, error: "" })}
              placeholder="e.g. ali@example.com" keyboardType="email-address" autoCapitalize="none" />
          </View>

          <Pressable style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={s.primaryBtnText}>Submit Request</Text></>
            }
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FormField({
  label, required, value, error, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string; required?: boolean; value: string; error: string;
  onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences";
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
        {label}{required && <Text style={{ color: colors.danger }}> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        style={{
          borderRadius: 12, borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          paddingHorizontal: 14, paddingVertical: 11,
          backgroundColor: colors.muted, color: colors.foreground, fontSize: 14,
        }}
      />
      {!!error && <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
    topBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    topTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
    quotationRef: { color: colors.primary, fontWeight: "700" },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    switchLabel: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 15 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryBtn: { alignItems: "center", paddingVertical: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    secondaryBtnText: { color: colors.foreground, fontWeight: "700" },

    successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
    successIcon: { marginBottom: 4 },
    successTitle: { color: colors.foreground, fontSize: 22, fontWeight: "800" },
    successBody: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 21 },
    challanReadyCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, width: "100%" },
    challanReadyTitle: { color: colors.foreground, fontSize: 14, fontWeight: "700" },
    challanReadyBody: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
    waitingCard: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.muted, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, width: "100%" },
    waitingText: { color: colors.mutedForeground, fontSize: 13 },
  });
