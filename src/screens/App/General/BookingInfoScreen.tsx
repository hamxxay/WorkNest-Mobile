import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  DateField,
  Screen,
  SectionHeader,
  SelectField,
  TextField,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate, formatMoney, formatTime, toYmdLocal } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { errorMessage } from "../../../services/apiClient";
import { categoryCodeForMode, getSmartAvailability, type SmartAvailability } from "../../../services/bookingService";
import { priceUnitLabel } from "../../../services/workspaceService";
import { formatPhoneInput, phoneError, PHONE_MAX_LENGTH } from "../../../utils/phone";
import type { AppStackParamList, BookingDraft } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Mode = BookingDraft["mode"];

/** Meeting rooms: hourly starts from 8 AM to 8 PM; bookings end by 10 PM. */
const START_HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);
const CLOSING_HOUR = 22;
const DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function modeOf(type: string): Mode {
  if (type === "Meeting Room") return "meeting";
  if (type === "Co-Working Space") return "shared";
  return "office";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local "YYYY-MM-DDTHH:mm:ss" (what the booking API expects). */
function localDateTime(d: Date): string {
  return `${toYmdLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function hourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return formatTime(d);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Booking step 1: when (meeting room: date, start time and hours; office / shared desk: start date and months,
 * like the staff portal's booking form) and the customer's details. Checks availability as the period changes
 * (GET /booking/smart/available). The amount payable is calculated by the API and shown on the challan.
 */
export default function BookingInfoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingInfo">>();
  const { workspace } = route.params;
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const mode = modeOf(workspace.type);
  const categoryCode = workspace.categoryCode || categoryCodeForMode(mode);

  const [date, setDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState<number>(10);
  const [hours, setHours] = useState<number>(2);
  const [months, setMonths] = useState<number>(mode === "office" ? 3 : 1);
  const [people, setPeople] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(typeof user?.name === "string" ? user.name : "");
  const [phone, setPhone] = useState(typeof user?.phoneNumber === "string" ? user.phoneNumber : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<SmartAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const phoneRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const email = typeof user?.email === "string" ? user.email : "";

  const capacity = Number(people) > 0 ? Math.floor(Number(people)) : undefined;

  // The booking period from the choices above (null until a date is picked).
  const period = useMemo(() => {
    if (!date) return null;
    const start = new Date(date);
    const end = new Date(date);
    if (mode === "meeting") {
      start.setHours(startHour, 0, 0, 0);
      end.setHours(startHour + hours, 0, 0, 0);
      return {
        start,
        end,
        label: `${formatDate(start, { weekday: true })}, ${formatTime(start)} to ${formatTime(end)} (${hours} hour${hours === 1 ? "" : "s"})`,
      };
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + months);
    return {
      start,
      end,
      label: `${formatDate(start)} to ${formatDate(end)} (${months} month${months === 1 ? "" : "s"})`,
    };
  }, [date, mode, startHour, hours, months]);

  const meetingInPast = mode === "meeting" && !!period && period.start.getTime() <= Date.now();

  // Availability for the chosen period (debounced; the last answer wins).
  useEffect(() => {
    if (!period || meetingInPast) {
      // Also ends a check that was still running for the previous choice (its answer is ignored), so
      // "Review booking" is never left disabled with nothing to explain why.
      setAvailability(null);
      setAvailabilityError("");
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    setAvailabilityError("");
    const timer = setTimeout(() => {
      getSmartAvailability({
        categoryCode,
        startOn: localDateTime(period.start),
        endOn: localDateTime(period.end),
        capacity,
      })
        .then((result) => active && setAvailability(result))
        .catch((err) => {
          if (!active) return;
          setAvailability(null);
          setAvailabilityError(errorMessage(err, "Availability could not be checked. You can still continue."));
        })
        .finally(() => active && setChecking(false));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [period, meetingInPast, categoryCode, capacity]);

  const noSpace = !!availability && availability.count === 0;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!date) next.date = "Choose a date.";
    else if (meetingInPast) next.startHour = "Choose a time later than now.";
    if (people && !(Number(people) > 0)) next.people = "Enter the number of people, or leave it empty.";
    if (name.trim().length < 2) next.name = "Enter your full name.";
    if (!phone.trim()) next.phone = "Enter your phone number.";
    else {
      const p = phoneError(phone);
      if (p) next.phone = p;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onContinue = () => {
    if (!validate() || !period) return;
    navigation.navigate("BookingConfirm", {
      workspace,
      booking: {
        mode,
        startDateTime: localDateTime(period.start),
        endDateTime: localDateTime(period.end),
        periodLabel: period.label,
        months: mode === "meeting" ? undefined : months,
        hours: mode === "meeting" ? hours : undefined,
        capacity,
        notes: notes.trim() || undefined,
        guest: { name: name.trim(), email, phone: phone.trim() },
      },
    });
  };

  const unit = availability?.billingPeriodCode ? priceUnitLabel({ priceUnit: availability.billingPeriodCode }) : "";

  return (
    <Screen>
      <AppHeader title="Booking details" subtitle={`${workspace.name}${workspace.location ? `, ${workspace.location}` : ""}`} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionHeader title="When" subtitle={mode === "meeting" ? "Meeting rooms are booked by the hour." : "Offices and shared desks are booked by the month."} />
          <Card>
            <View style={styles.fields}>
              <DateField
                label={mode === "meeting" ? "Date" : "Start date"}
                required
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setErrors((e) => ({ ...e, date: "" }));
                }}
                minimumDate={startOfToday()}
                error={errors.date || undefined}
              />
              {mode === "meeting" ? (
                <>
                  <SelectField
                    label="Start time"
                    required
                    value={startHour}
                    onChange={(h) => {
                      setStartHour(h);
                      // Keep the duration inside opening hours (last booking ends at 10 PM).
                      setHours((d) => Math.min(d, CLOSING_HOUR - h));
                      setErrors((e) => ({ ...e, startHour: "" }));
                    }}
                    options={START_HOURS.map((h) => ({ label: hourLabel(h), value: h }))}
                    error={errors.startHour || undefined}
                  />
                  <SelectField
                    label="Duration"
                    required
                    value={hours}
                    onChange={setHours}
                    options={DURATIONS.filter((d) => startHour + d <= CLOSING_HOUR).map((d) => ({
                      label: `${d} hour${d === 1 ? "" : "s"}`,
                      value: d,
                    }))}
                  />
                </>
              ) : (
                <SelectField
                  label="Number of months"
                  required
                  value={months}
                  onChange={setMonths}
                  options={MONTHS.map((m) => ({ label: `${m} month${m === 1 ? "" : "s"}`, value: m }))}
                />
              )}
              {mode !== "shared" ? (
                <TextField
                  label="Number of people"
                  value={people}
                  onChangeText={(v) => setPeople(v.replace(/[^0-9]/g, "").slice(0, 3))}
                  keyboardType="number-pad"
                  helperText="Optional. We pick a space that fits."
                  error={errors.people || undefined}
                  leftIcon="people-outline"
                />
              ) : null}
            </View>
          </Card>

          {period ? (
            <View style={styles.status}>
              <AppText variant="bodySmall" color="textSecondary">
                {period.label}
              </AppText>
              {meetingInPast ? (
                <Banner
                  tone="warning"
                  title="This time has passed"
                  message="Choose a later start time or another date."
                />
              ) : checking ? (
                <Banner tone="info" message="Checking availability..." />
              ) : availabilityError ? (
                <Banner tone="warning" message={availabilityError} />
              ) : availability ? (
                availability.count > 0 ? (
                  <Banner
                    tone="success"
                    title={`${availability.count} space${availability.count === 1 ? "" : "s"} available`}
                    message={
                      availability.fromPrice !== null
                        ? `Listed rate from ${formatMoney(availability.fromPrice)}${unit ? ` per ${unit}` : ""}. The exact amount is on your challan.`
                        : "The exact amount is on your challan."
                    }
                  />
                ) : (
                  <Banner
                    tone="danger"
                    title="Not available"
                    message="No space of this type is free for this period. Try other dates or a shorter period."
                  />
                )
              ) : null}
            </View>
          ) : null}

          <SectionHeader title="Your details" subtitle="Used for the booking and the challan." />
          <Card>
            <View style={styles.fields}>
              <TextField
                label="Full name"
                required
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setErrors((e) => ({ ...e, name: "" }));
                }}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={errors.name || undefined}
                leftIcon="person-outline"
              />
              <TextField label="Email" value={email} disabled leftIcon="mail-outline" helperText="Your account email." />
              <TextField
                ref={phoneRef}
                label="Phone"
                required
                value={phone}
                onChangeText={(v) => {
                  setPhone(formatPhoneInput(v));
                  setErrors((e) => ({ ...e, phone: "" }));
                }}
                keyboardType="phone-pad"
                maxLength={PHONE_MAX_LENGTH}
                autoComplete="tel"
                returnKeyType="next"
                onSubmitEditing={() => notesRef.current?.focus()}
                error={errors.phone || undefined}
                leftIcon="call-outline"
                placeholder="03001234567"
              />
              <TextField
                ref={notesRef}
                label="Notes"
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, 300))}
                multiline
                rows={3}
                helperText="Optional, for the WorkNest team."
              />
            </View>
          </Card>

          <Button
            title="Review booking"
            rightIcon="arrow-forward"
            size="lg"
            fullWidth
            disabled={noSpace || checking}
            onPress={onContinue}
          />
          <AppText variant="caption" color="textMuted" align="center">
            Nothing is booked yet: you review and confirm on the next step.
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
    status: { gap: t.spacing.sm },
  });
