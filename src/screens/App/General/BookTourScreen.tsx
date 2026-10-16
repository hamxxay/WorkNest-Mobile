import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  DateField,
  EmptyState,
  Screen,
  SelectField,
  TextField,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, toYmdLocal } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { errorMessage } from "../../../services/apiClient";
import { getLocations } from "../../../services/workspaceService";
import {
  buildTourWhatsAppText,
  SALES_WHATSAPP_NUMBER,
  submitTourRequest,
  TOUR_TIME_SLOTS,
  type TourRequest,
} from "../../../services/tourService";
import { isValidEmail } from "../../../utils/validation";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";
import { nameError } from "../../../utils/inputSanitizer";
import { ScrollableState } from "./shared/ScrollableState";
import { fittingLabel, useContentWidth } from "./shared/layout";

type Errors = Partial<Record<"fullName" | "email" | "phone" | "location" | "date" | "slot", string>>;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The WhatsApp button after a tour request, then shorter labels for a narrow phone or large text. */
const WHATSAPP_LABELS = ["Also message us on WhatsApp", "Message us on WhatsApp", "WhatsApp us"] as const;

/**
 * Book a Tour, like worknestpk.com: name, email, phone, location, preferred date and time slot.
 * Sent to POST /book-tour (works signed out); the sales team can also be messaged on WhatsApp.
 */
export default function BookTourScreen() {
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  // The empty state's button sits inside its 24dp side padding.
  const stateWidth = useContentWidth("content", 24);
  const toast = useToast();
  const { user } = useAuth();

  const [fullName, setFullName] = useState(typeof user?.name === "string" ? user.name : "");
  const [email, setEmail] = useState(typeof user?.email === "string" ? user.email : "");
  const [phone, setPhone] = useState(typeof user?.phoneNumber === "string" ? user.phoneNumber : "");
  const [location, setLocation] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [locations, setLocations] = useState<string[]>([]);
  // Location name -> id, so the request is sent to that branch's staff (locationId).
  const [locationIds, setLocationIds] = useState<Record<string, number>>({});
  const [locationsLoading, setLocationsLoading] = useState(true);
  // GET /location/all failed: the branch stays required (the request goes to that branch's staff), so the form
  // shows the error with Retry instead of quietly sending it without a branch.
  const [locationsError, setLocationsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState<TourRequest | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  // Locations from the API (dbo.WN_Locations), not hard-coded. Only when the API has none is the field optional.
  const loadLocations = useCallback(() => {
    setLocationsLoading(true);
    setLocationsError("");
    getLocations()
      .then((rows) => {
        const active = rows.filter((l) => (l as { isActive?: boolean }).isActive !== false && l.name);
        setLocations(active.map((l) => l.name).sort((a, b) => a.localeCompare(b)));
        setLocationIds(Object.fromEntries(active.filter((l) => Number(l.id) > 0).map((l) => [l.name, Number(l.id)])));
      })
      .catch((err) => {
        setLocations([]);
        setLocationsError(errorMessage(err, "Our locations could not be loaded."));
      })
      .finally(() => setLocationsLoading(false));
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  const validate = (): boolean => {
    const next: Errors = {};
    const nameProblem = nameError(fullName, "Full name");
    if (nameProblem) next.fullName = nameProblem;
    if (!isValidEmail(email.trim())) next.email = "Enter a valid email address.";
    if (!phone.trim()) next.phone = "Enter your phone number.";
    else if (phoneError(phone)) next.phone = phoneError(phone) ?? undefined;
    if (locationsError || locationsLoading) next.location = "Choose a location (tap Retry to load the list).";
    else if (locations.length > 0 && !location) next.location = "Choose a location.";
    if (!date) next.date = "Choose a date.";
    if (!slot) next.slot = "Choose a time slot.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    const request: TourRequest = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      location: location ?? undefined,
      locationId: location ? locationIds[location] : undefined,
      preferredDate: date ? toYmdLocal(date) : undefined,
      timeSlot: slot ?? undefined,
      notes: notes.trim() || undefined,
    };
    setSubmitting(true);
    setFormError("");
    try {
      const message = await submitTourRequest(request);
      setSent(request);
      toast.success(message, { title: "Tour requested" });
    } catch (err) {
      setFormError(errorMessage(err, "Your tour request could not be sent. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = async (request: TourRequest) => {
    const text = encodeURIComponent(buildTourWhatsAppText(request));
    const appUrl = `whatsapp://send?phone=${SALES_WHATSAPP_NUMBER}&text=${text}`;
    const webUrl = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${text}`;
    try {
      await Linking.openURL((await Linking.canOpenURL(appUrl)) ? appUrl : webUrl);
    } catch {
      toast.error("WhatsApp could not be opened on this device.");
    }
  };

  if (sent) {
    return (
      <Screen>
        <AppHeader title="Book a tour" />
        <ScrollableState>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Tour requested"
            message={`We received your request for ${sent.preferredDate ? formatDate(sent.preferredDate) : "your visit"}${sent.timeSlot ? `, ${sent.timeSlot}` : ""}. Our team will contact you to confirm.`}
            actionLabel={fittingLabel(WHATSAPP_LABELS, stateWidth, fontScale)}
            onAction={() => openWhatsApp(sent)}
          />
          <View style={styles.doneActions}>
            <Button title="Back to home" variant="outline" fullWidth onPress={() => navigation.navigate("MainTabs", { screen: "Home" })} />
          </View>
        </ScrollableState>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Book a tour" subtitle="Visit a WorkNest space before you book" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.fields}>
              <TextField
                label="Full name"
                required
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  // Characters a name can't have are pointed out while typing; the rest when leaving the field.
                  setErrors((e) => ({ ...e, fullName: nameError(v, "Full name", { typing: true }) ?? undefined }));
                }}
                onBlur={() => setErrors((e) => ({ ...e, fullName: nameError(fullName, "Full name") ?? undefined }))}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.fullName}
                leftIcon="person-outline"
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
                leftIcon="mail-outline"
              />
              <TextField
                ref={phoneRef}
                label="Phone"
                required
                value={phone}
                onChangeText={(v) => {
                  setPhone(formatPhoneInput(v));
                  clear("phone");
                }}
                keyboardType="phone-pad"
                maxLength={PHONE_MAX_LENGTH}
                autoComplete="tel"
                error={errors.phone}
                leftIcon="call-outline"
                placeholder="03001234567"
              />
              <SelectField
                label="Location"
                required={locations.length > 0 || !!locationsError}
                value={location}
                onChange={(v) => {
                  setLocation(v);
                  clear("location");
                }}
                options={locations.map((l) => ({ label: l, value: l }))}
                loading={locationsLoading}
                placeholder={locationsLoading ? "Loading locations" : locationsError ? "Locations not loaded" : "Choose a location"}
                emptyText={locationsError ? "Locations could not be loaded. Tap Retry below." : "No locations available. Leave it empty and we will suggest one."}
                error={errors.location}
                leftIcon="location-outline"
              />
              {locationsError ? (
                <Banner
                  tone="danger"
                  title="Locations not loaded"
                  message={`${locationsError} Choose the branch you want to visit once they load.`}
                  actionLabel="Retry"
                  onAction={loadLocations}
                />
              ) : null}
              <DateField
                label="Preferred date"
                required
                value={date}
                onChange={(d) => {
                  setDate(d);
                  clear("date");
                }}
                minimumDate={startOfToday()}
                error={errors.date}
              />
              <SelectField
                label="Time slot"
                required
                value={slot}
                onChange={(v) => {
                  setSlot(v);
                  clear("slot");
                }}
                options={TOUR_TIME_SLOTS.map((s) => ({ label: s, value: s }))}
                placeholder="Choose a time"
                error={errors.slot}
                leftIcon="time-outline"
              />
              <TextField
                label="Notes"
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, 500))}
                multiline
                rows={3}
                helperText="Optional: team size, the kind of space you need."
              />
            </View>
          </Card>

          {formError ? <Banner tone="danger" title="Not sent" message={formError} /> : null}

          <Button title="Request tour" size="lg" fullWidth loading={submitting} onPress={submit} leftIcon="send-outline" haptic />
          <AppText variant="caption" color="textMuted" align="center">
            No commitment. Our team will call or email you to confirm the visit.
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
    doneActions: { padding: t.spacing.screen },
  });
