import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Modal,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import type { AppStackParamList } from "../../navigation/types";

type StepKey = "datetime" | "guest" | "payment";
type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingInfoScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingInfo">>();
  const { workspace, booking } = route.params;
  const isOffice = booking.mode === "office";
  const isShared = booking.mode === "shared";
  const isMeeting = booking.mode === "meeting";

  const [activeStep, setActiveStep] = useState<StepKey>("datetime");
  const [selectedDate, setSelectedDate] = useState<string>(booking.dates[0] ?? "");
  const [selectedTime, setSelectedTime] = useState<string>(booking.slot ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const [datePickerMonth, setDatePickerMonth] = useState<Date>(startOfMonth(new Date()));
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());

  const timeOptions = useMemo(() => {
    if (isOffice) {
      return [booking.month ? `${booking.month} (Monthly)` : "Monthly"];
    }
    if (isShared) {
      return ["09:00 - 17:00", "18:00 - 02:00"];
    }
    return ["09:00 - 11:00", "11:00 - 13:00", "13:00 - 15:00", "15:00 - 17:00"];
  }, [booking.month, isOffice, isShared]);

  const selectedDatesLabel = useMemo(() => {
    if (isOffice) {
      return booking.month ? booking.month : "Monthly";
    }
    if (isShared) {
      return booking.dates.length ? booking.dates.join(", ") : "No dates selected";
    }
    return selectedDate || "Select";
  }, [booking.dates, booking.month, isOffice, isShared, selectedDate]);

  const stepLabel = (step: StepKey) => {
    if (step === "datetime") return "Date & Time";
    if (step === "guest") return "Guest Info";
    return "Payment";
  };
  const isActiveStep = (step: StepKey) =>
    activeStep === step || (step === "payment" && activeStep !== "datetime" && activeStep !== "guest");

  const openDatePicker = () => {
    const baseDate = selectedDate ? parseDate(selectedDate) : new Date();
    setDatePickerValue(baseDate);
    setDatePickerMonth(startOfMonth(baseDate));
    setDatePickerOpen(true);
  };

  const openTimePicker = () => {
    setTimePickerValue(timeStringToDate(extractStartTime(selectedTime) || "09:00"));
    setTimePickerOpen(true);
  };

  const onNext = () => {
    setError("");
    if (activeStep === "datetime") {
      if (isOffice && !booking.month) {
        setError("Please select a booking month.");
        return;
      }
      if (isShared && (!booking.dates.length || !selectedTime)) {
        setError("Please confirm your selected dates and time slot.");
        return;
      }
      if (isMeeting && (!selectedDate || !selectedTime)) {
        setError("Please select a date and time.");
        return;
      }
      setActiveStep("guest");
      return;
    }
    if (activeStep === "guest") {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        setError("Please fill in all guest information fields.");
        return;
      }
      navigation.navigate("Payment", {
        workspace,
        booking: {
          ...booking,
          dates: isShared ? booking.dates : isOffice ? [] : [selectedDate],
          slot: isOffice ? "" : selectedTime,
          month: isOffice ? booking.month : undefined,
          guest: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
        },
      });
      return;
    }
    setActiveStep("payment");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>{workspace.name}</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.stepsRow}>
          {(["datetime", "guest", "payment"] as StepKey[]).map((step, index) => {
            const active = isActiveStep(step);
            return (
              <View key={step} style={styles.stepItem}>
                <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                  {stepLabel(step)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <Text style={styles.helperText}>
            {isOffice
              ? "Private office bookings are handled monthly."
              : isShared
                ? "Shared space bookings keep the dates you selected on the previous screen."
                : "Meeting room bookings can be adjusted here."}
          </Text>

          <Text style={styles.label}>{isOffice ? "Booking Month" : isShared ? "Selected Dates" : "Select Date"}</Text>
          {isMeeting ? (
            <Pressable style={styles.input} onPress={openDatePicker}>
              <Text style={styles.inputValue}>{selectedDatesLabel}</Text>
            </Pressable>
          ) : (
            <View style={styles.input}>
              <Text style={styles.inputValue}>{selectedDatesLabel}</Text>
            </View>
          )}

          {!isOffice ? <Text style={styles.label}>Select Time</Text> : null}
          {isOffice ? (
            <View style={styles.input}>
              <Text style={styles.inputValue}>Month-based booking only</Text>
            </View>
          ) : (
            <>
              <View style={styles.timeOptions}>
                {timeOptions.map((slot) => {
                  const active = selectedTime === slot;
                  return (
                    <Pressable
                      key={slot}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                      onPress={() => setSelectedTime(slot)}
                    >
                      <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {isMeeting ? (
                <Pressable style={styles.input} onPress={openTimePicker}>
                  <Text style={styles.inputValue}>
                    {selectedTime ? `Custom: ${selectedTime}` : "Pick a time"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Guest Info</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            style={styles.input}
          />
          <Text style={styles.label}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.nextButton} onPress={onNext}>
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
      </ScrollView>

      <ModalWrapper visible={datePickerOpen && isMeeting} onClose={() => setDatePickerOpen(false)} styles={styles}>
        <Text style={styles.modalTitle}>Select date</Text>
        <View style={styles.calendarHeader}>
          <Pressable style={styles.iconButton} onPress={() => setDatePickerMonth((prev) => addMonths(prev, -1))}>
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={styles.calendarTitle}>
            {MONTH_LABELS[datePickerMonth.getMonth()]} {datePickerMonth.getFullYear()}
          </Text>
          <Pressable style={styles.iconButton} onPress={() => setDatePickerMonth((prev) => addMonths(prev, 1))}>
            <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={`weekday-${label}`} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {buildCalendarDays(datePickerMonth).map((day) => {
            const isSelected = isSameDay(day.date, datePickerValue);
            return (
              <Pressable
                key={day.date.toISOString()}
                style={[
                  styles.dayCell,
                  !day.isCurrentMonth && styles.dayCellMuted,
                  isSelected && styles.dayCellSelected,
                ]}
                onPress={() => {
                  setDatePickerValue(day.date);
                  setSelectedDate(formatDate(day.date));
                  setDatePickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.dayTextMuted,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ModalWrapper>

      <ModalWrapper visible={timePickerOpen && isMeeting} onClose={() => setTimePickerOpen(false)} styles={styles}>
        <Text style={styles.modalTitle}>Select time</Text>
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          design={Platform.OS === "android" ? "material" : undefined}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") {
              setTimePickerOpen(false);
            }
            if (event.type === "set" && date) {
              setTimePickerValue(date);
              setSelectedTime(`${formatTime(date)} - ${formatTime(addHours(date, 2))}`);
            }
          }}
        />
      </ModalWrapper>
    </Screen>
  );
}

function ModalWrapper({
  visible,
  onClose,
  children,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!visible) return null;
  return (
    <Modal transparent visible onRequestClose={onClose} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {children}
          <Pressable style={styles.modalPrimary} onPress={onClose}>
            <Text style={styles.modalPrimaryText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function buildCalendarDays(baseMonth: Date): CalendarDay[] {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  const startDate = new Date(year, month, 1 - startDay);
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    days.push({
      date,
      isCurrentMonth: date.getMonth() === month,
    });
  }

  return days;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function extractStartTime(value: string) {
  if (!value) return "";
  return value.split("-")[0]?.trim() ?? "";
}

function timeStringToDate(value: string) {
  const [h, m] = value.split(":").map((part) => Number(part));
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

function formatTime(value: Date) {
  const h = String(value.getHours()).padStart(2, "0");
  const m = String(value.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.foreground,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  stepItem: { alignItems: "center", flex: 1, gap: 6 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNumber: { color: colors.mutedForeground, fontWeight: "700" },
  stepNumberActive: { color: colors.background },
  stepLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
  stepLabelActive: { color: colors.foreground },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  helperText: { color: colors.mutedForeground, fontSize: 12 },
  label: { color: colors.foreground, fontWeight: "600", fontSize: 13 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.muted,
    color: colors.foreground,
  },
  inputValue: { color: colors.foreground, fontWeight: "600" },
  timeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.muted,
  },
  timeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
  timeChipTextActive: { color: colors.background },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center" },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  nextButtonText: { color: colors.background, fontWeight: "800" },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: "12.8%",
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.foreground,
    fontWeight: "600",
    transform: [{ translateY: -10 }],
  },
  dayTextMuted: {
    color: colors.mutedForeground,
  },
  dayTextSelected: {
    color: colors.background,
  },
  modalPrimary: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalPrimaryText: { color: colors.background, fontWeight: "700" },
});
