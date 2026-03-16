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
import { colors, radii } from "../../theme";
import type { AppStackParamList } from "../../navigation/types";

type StepKey = "datetime" | "guest" | "payment";

export default function BookingInfoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingInfo">>();
  const { workspace, booking } = route.params;

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
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());

  const timeOptions = useMemo(() => {
    if (booking.mode === "office") {
      return [booking.month ? `${booking.month} (Monthly)` : "Monthly"];
    }
    if (booking.mode === "shared") {
      return ["09:00 - 17:00", "18:00 - 02:00"];
    }
    return ["09:00 - 11:00", "11:00 - 13:00", "13:00 - 15:00", "15:00 - 17:00"];
  }, [booking.mode, booking.month]);

  const stepLabel = (step: StepKey) => {
    if (step === "datetime") return "Date & Time";
    if (step === "guest") return "Guest Info";
    return "Payment";
  };
  const isActiveStep = (step: StepKey) =>
    activeStep === step || (step === "payment" && activeStep !== "datetime" && activeStep !== "guest");

  const openDatePicker = () => {
    setDatePickerValue(selectedDate ? parseDate(selectedDate) : new Date());
    setDatePickerOpen(true);
  };

  const openTimePicker = () => {
    setTimePickerValue(timeStringToDate(extractStartTime(selectedTime) || "09:00"));
    setTimePickerOpen(true);
  };

  const onNext = () => {
    setError("");
    if (activeStep === "datetime") {
      if (!selectedDate || !selectedTime) {
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
          dates: [selectedDate],
          slot: selectedTime,
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
          <Text style={styles.helperText}>Pre-filled from your selection.</Text>

          <Text style={styles.label}>Select Date</Text>
          <Pressable style={styles.input} onPress={openDatePicker}>
            <Text style={styles.inputValue}>
              {selectedDate || (booking.month ? `${booking.month} (Monthly)` : "Select")}
            </Text>
          </Pressable>

          <Text style={styles.label}>Select Time</Text>
          {booking.mode === "office" ? (
            <View style={styles.input}>
              <Text style={styles.inputValue}>{timeOptions[0]}</Text>
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
              <Pressable style={styles.input} onPress={openTimePicker}>
                <Text style={styles.inputValue}>
                  {selectedTime ? `Custom: ${selectedTime}` : "Pick a time"}
                </Text>
              </Pressable>
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

      <ModalWrapper visible={datePickerOpen} onClose={() => setDatePickerOpen(false)}>
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") {
              setDatePickerOpen(false);
            }
            if (event.type === "set" && date) {
              setDatePickerValue(date);
              setSelectedDate(formatDate(date));
            }
          }}
        />
      </ModalWrapper>

      <ModalWrapper visible={timePickerOpen} onClose={() => setTimePickerOpen(false)}>
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
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

function ModalWrapper({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
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

const styles = StyleSheet.create({
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
  errorText: { color: colors.destructive, fontSize: 14, textAlign: "center" },
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
  modalPrimary: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalPrimaryText: { color: colors.background, fontWeight: "700" },
});
