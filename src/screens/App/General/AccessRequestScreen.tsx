import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Screen,
  SelectField,
  TextField,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import {
  allowedSpaces,
  confirmDoorAccess,
  saveDoorAccess,
  verifyDoorAccess,
  type DoorAccessDetails,
  type DoorAccessResult,
} from "../../../services/doorAccessService";
import { cnicError, formatCnicInput } from "../../../utils/cnic";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";
import { errorMessage } from "../../../services/apiClient";

type FormState = { name: string; email: string; cnic: string; phone: string };
type Errors = Partial<Record<keyof FormState | "room", string>>;

/**
 * Access Request: the details must match the access user your company added (at least two of name, email,
 * CNIC and phone, one of them CNIC or email). Once verified, Unlock Door opens your room door.
 */
export default function AccessRequestScreen() {
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<FormState>({
    name: typeof user?.name === "string" ? user.name : "",
    email: typeof user?.email === "string" ? user.email : "",
    cnic: "",
    phone: typeof user?.phoneNumber === "string" ? user.phoneNumber : "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "danger"; title: string; message: string } | null>(null);
  // Set when the details match more than one room: the user picks one, then confirms.
  const [pending, setPending] = useState<{ details: DoorAccessDetails; result: DoorAccessResult } | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const rooms = pending ? allowedSpaces(pending.result) : [];

  const emailRef = useRef<TextInput>(null);
  const cnicRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const enough = useMemo(
    () =>
      [form.name, form.email, form.cnic, form.phone].filter((v) => v.trim()).length >= 2 &&
      !!(form.email.trim() || form.cnic.trim()),
    [form],
  );

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setNotice(null);
    // Changed details mean the rooms found may no longer apply.
    setPending(null);
    setRoomId(null);
  };

  const finish = async (details: DoorAccessDetails, result: DoorAccessResult, bookingDetailId: number) => {
    // Record it on the server first (the web shows "App verified"); refuses if this login isn't the person's account.
    await confirmDoorAccess(details, bookingDetailId);
    if (user?.email) await saveDoorAccess(user.email, details, result, bookingDetailId);
    const room = allowedSpaces(result).find((sp) => sp.bookingDetailId === bookingDetailId)?.spaceName;
    toast.success(`${room ? `Room: ${room}. ` : ""}Use Unlock Door to open your room door.`, { title: "Access verified" });
    navigation.goBack();
  };

  const submit = async () => {
    if (submitting) return;
    setNotice(null);
    setSubmitting(true);
    try {
      if (pending) {
        if (roomId == null) {
          setErrors({ room: "Choose the room you use." });
          return;
        }
        await finish(pending.details, pending.result, roomId);
        return;
      }
      const next: Errors = {};
      if (!enough) {
        setNotice({
          tone: "warning",
          title: "More information needed",
          message: "Fill in at least two of name, email, CNIC and phone, including your CNIC or email.",
        });
      }
      const c = cnicError(form.cnic);
      if (c) next.cnic = c;
      const p = phoneError(form.phone);
      if (p) next.phone = p;
      setErrors(next);
      if (!enough || Object.keys(next).length) return;

      const details = { name: form.name.trim(), email: form.email.trim(), cnic: form.cnic.trim(), phone: form.phone.trim() };
      const result = await verifyDoorAccess(details);
      const allowed = allowedSpaces(result);
      if (!result.canOpenDoor || allowed.length === 0) {
        setNotice({ tone: "danger", title: result.matched ? "Access turned off" : "No match found", message: result.message });
      } else if (allowed.length === 1) {
        await finish(details, result, allowed[0].bookingDetailId);
      } else {
        setPending({ details, result });
        setRoomId(null);
      }
    } catch (err) {
      setNotice({ tone: "danger", title: "Could not verify access", message: errorMessage(err, "Please try again.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Access request" subtitle="Verify once to unlock your room door" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppText variant="bodySmall" color="textSecondary">
            Enter your details exactly as your company registered them: at least two, including your CNIC or email.
          </AppText>
          <Card>
            <View style={styles.fields}>
              <TextField
                label="Name"
                value={form.name}
                onChangeText={(v) => update("name", v)}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.name}
                leftIcon="person-outline"
              />
              <TextField
                ref={emailRef}
                label="Email"
                value={form.email}
                onChangeText={(v) => update("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => cnicRef.current?.focus()}
                error={errors.email}
                leftIcon="mail-outline"
              />
              <TextField
                ref={cnicRef}
                label="CNIC"
                value={form.cnic}
                onChangeText={(v) => update("cnic", formatCnicInput(v))}
                keyboardType="number-pad"
                maxLength={15}
                placeholder="35202-1234567-1"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={errors.cnic}
                leftIcon="card-outline"
              />
              <TextField
                ref={phoneRef}
                label="Phone"
                value={form.phone}
                onChangeText={(v) => update("phone", formatPhoneInput(v))}
                keyboardType="phone-pad"
                maxLength={PHONE_MAX_LENGTH}
                error={errors.phone}
                leftIcon="call-outline"
              />
              {rooms.length > 1 ? (
                <SelectField
                  label="Your room"
                  required
                  value={roomId}
                  onChange={(v) => {
                    setRoomId(v);
                    setErrors((e) => ({ ...e, room: undefined }));
                  }}
                  options={rooms.map((r) => ({ label: r.spaceName || `Booking ${r.bookingDetailId}`, value: r.bookingDetailId }))}
                  helperText="Your details match more than one booking. Choose the room you use."
                  error={errors.room}
                  leftIcon="business-outline"
                />
              ) : null}
            </View>
          </Card>

          {notice ? <Banner tone={notice.tone} title={notice.title} message={notice.message} /> : null}

          <Button title={pending ? "Confirm room" : "Verify access"} size="lg" fullWidth loading={submitting} onPress={submit} />
          <AppText variant="caption" color="textMuted" align="center">
            The verification lasts 30 days. The app opens your room door only; use your card, fingerprint or face at the
            building entrances.
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
