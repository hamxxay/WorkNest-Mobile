import { useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  TextField,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { errorMessage } from "../../../services/apiClient";
import { SALES_EMAIL, SALES_WHATSAPP_NUMBER, submitContactMessage } from "../../../services/tourService";
import { isValidEmail } from "../../../utils/validation";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";

type Errors = Partial<Record<"fullName" | "email" | "phone" | "message", string>>;

/** Contact us: message form (POST /contact), WhatsApp and email, and a link to Book a Tour. */
export default function ContactUsScreen() {
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const { user } = useAuth();

  const [fullName, setFullName] = useState(typeof user?.name === "string" ? user.name : "");
  const [email, setEmail] = useState(typeof user?.email === "string" ? user.email : "");
  const [phone, setPhone] = useState(typeof user?.phoneNumber === "string" ? user.phoneNumber : "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  const submit = async () => {
    if (sending) return;
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!isValidEmail(email.trim())) next.email = "Enter a valid email address.";
    if (phone.trim() && phoneError(phone)) next.phone = phoneError(phone) ?? undefined;
    if (message.trim().length < 5) next.message = "Write a short message.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    setFormError("");
    try {
      const result = await submitContactMessage({ fullName, email, phone, message });
      toast.success(`${result} We will get back to you soon.`, { title: "Message sent" });
      setMessage("");
    } catch (err) {
      setFormError(errorMessage(err, "Your message could not be sent. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = async () => {
    const text = encodeURIComponent(`Hello WorkNest, my name is ${fullName.trim() || "a customer"}.`);
    const appUrl = `whatsapp://send?phone=${SALES_WHATSAPP_NUMBER}&text=${text}`;
    const webUrl = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${text}`;
    try {
      await Linking.openURL((await Linking.canOpenURL(appUrl)) ? appUrl : webUrl);
    } catch {
      toast.error("WhatsApp could not be opened on this device.");
    }
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${SALES_EMAIL}`).catch(() => toast.error("No email app found on this device."));
  };

  return (
    <Screen>
      <AppHeader title="Contact us" subtitle="We usually reply within a working day" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card padding={0}>
            <ListRow leftIcon="logo-whatsapp" title="WhatsApp" subtitle="+92 328 0256000" chevron onPress={openWhatsApp} />
            <Divider inset={68} />
            <ListRow leftIcon="mail-outline" title="Email" subtitle={SALES_EMAIL} chevron onPress={openEmail} />
            <Divider inset={68} />
            <ListRow leftIcon="walk-outline" title="Book a tour" subtitle="Visit a space before you book" chevron onPress={() => navigation.navigate("BookTour")} />
          </Card>

          <SectionHeader title="Send us a message" />
          <Card>
            <View style={styles.fields}>
              <TextField
                label="Full name"
                required
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  clear("fullName");
                }}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.fullName}
              />
              <TextField
                ref={emailRef}
                label="Email"
                required
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clear("email");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={errors.email}
              />
              <TextField
                ref={phoneRef}
                label="Phone"
                value={phone}
                onChangeText={(v) => {
                  setPhone(formatPhoneInput(v));
                  clear("phone");
                }}
                keyboardType="phone-pad"
                maxLength={PHONE_MAX_LENGTH}
                returnKeyType="next"
                onSubmitEditing={() => messageRef.current?.focus()}
                error={errors.phone}
                helperText="Optional"
              />
              <TextField
                ref={messageRef}
                label="Message"
                required
                value={message}
                onChangeText={(v) => {
                  setMessage(v.slice(0, 1000));
                  clear("message");
                }}
                multiline
                rows={5}
                error={errors.message}
              />
            </View>
          </Card>

          {formError ? <Banner tone="danger" title="Not sent" message={formError} /> : null}
          <Button title="Send message" size="lg" fullWidth loading={sending} leftIcon="send-outline" onPress={submit} haptic />
          <AppText variant="caption" color="textMuted" align="center">
            For bookings and challans, see the Bookings and Payments tabs.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    fields: { gap: t.spacing.md },
  });
