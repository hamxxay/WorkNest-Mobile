import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import type { AppStackParamList } from "../../../navigation/types";
import { createContact } from "../../../services/contactService";
import { errorMessage } from "../../../services/apiClient";
import {
  buildTourWhatsAppText,
  SALES_WHATSAPP_NUMBER,
  submitTourRequest,
} from "../../../services/tourService";
import {
  INPUT_LIMITS,
  sanitizeEmailInput,
  sanitizeMessageInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizeTextForState,
} from "../../../utils/inputSanitizer";
import { formatPhoneInput } from "../../../utils/phone";
import { useAuth } from "../../../context/AuthContext";

const WHATSAPP_NUMBER = SALES_WHATSAPP_NUMBER;

export default function ContactUsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const route = useRoute<RouteProp<AppStackParamList, "ContactUs">>();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPrepopulated, setIsPrepopulated] = useState(false);

  useEffect(() => {
    if (user && !isPrepopulated) {
      if (user.name) setFullName(user.name);
      if (user.email) setEmail(user.email);
      if (user.phoneNumber) setPhone(user.phoneNumber);
      setIsPrepopulated(true);
    }
  }, [user, isPrepopulated]);

  const isTour = route.params?.source === "tour";
  const introTitle = isTour ? "Book a Tour" : "Contact Us";
  const introText = useMemo(
    () =>
      route.params?.source === "tour"
        ? "Tell us a little about your preferred visit and we will help you schedule the right workspace tour."
        : "Share your details and message, and our team will get back to you shortly.",
    [route.params?.source]
  );

  const whatsappMessage = useMemo(() => {
    if (isTour) {
      return buildTourWhatsAppText({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), notes: message });
    }
    const name = fullName.trim() || "Hi";
    return `Hello WorkNest, my name is ${name}. ${message.trim()}`.trim();
  }, [email, fullName, isTour, message, phone]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      if (isTour) {
        // Same as the website's Book a Tour form: POST /book-tour.
        const sent = await submitTourRequest({ fullName, email, phone, notes: message });
        setSuccess(`${sent} Our team will contact you to confirm the visit.`);
      } else {
        await createContact({
          fullName: sanitizeNameInput(fullName, "Full name"),
          email: sanitizeEmailInput(email),
          phone: sanitizePhoneInput(phone),
          message: sanitizeMessageInput(message),
        });
        setSuccess("Your message has been sent. We will contact you soon.");
      }
      setFullName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      setError(errorMessage(err, "Unable to send your message right now."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsapp = async () => {
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const appUrl = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
    const webUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    try {
      const canOpenWhatsapp = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpenWhatsapp ? appUrl : webUrl);
    } catch {
      Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp on this device right now.");
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color={colors.foreground} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>WorkNest Support</Text>
            <Text style={styles.heroTitle}>{introTitle}</Text>
            <Text style={styles.heroSubtitle}>{introText}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{isTour ? "Tour Request Form" : "Send us a message"}</Text>
            <Text style={styles.sectionSubtitle}>
              {isTour
                ? "Leave your details and our team will reach out with available slots."
                : "Leave your details and message and our team will get back to you."}
            </Text>

            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={fullName}
                onChangeText={(value) =>
                  setFullName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))
                }
                placeholder="Enter your name"
                placeholderTextColor={colors.mutedForeground}
                maxLength={INPUT_LIMITS.name}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={email}
                onChangeText={(value) =>
                  setEmail(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.email }))
                }
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={INPUT_LIMITS.email}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={phone}
                onChangeText={(value) =>
                  setPhone(formatPhoneInput(value))
                }
                placeholder="Enter your phone number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={INPUT_LIMITS.phone}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Message</Text>
            <View style={[styles.inputWrapper, styles.messageWrapper]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={message}
                onChangeText={(value) =>
                  setMessage(
                    sanitizeTextForState(value, {
                      maxLength: INPUT_LIMITS.message,
                      multiline: true,
                    })
                  )
                }
                placeholder="Tell us your preferred date, team size, or any special requirements"
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                maxLength={INPUT_LIMITS.message}
                style={[styles.input, styles.messageInput]}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <Pressable
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Send Request</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>

        <Pressable style={styles.whatsappFab} onPress={handleOpenWhatsapp}>
          <Ionicons name="logo-whatsapp" size={26} color="#FFFFFF" />
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 20,
    gap: 8,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#E8EEFF",
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  label: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.muted,
  },
  messageWrapper: {
    alignItems: "flex-start",
  },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
  },
  messageInput: {
    minHeight: 110,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  successText: {
    color: "#15803d",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  responseCard: {
    marginTop: 4,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    gap: 6,
  },
  responseTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  responseText: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  whatsappFab: {
    position: "absolute",
    right: 22,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
