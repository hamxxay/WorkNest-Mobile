import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  DateField,
  FieldLabel,
  StatusPill,
  SwitchRow,
  TextField,
} from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  attendanceErrorMessage,
  clockText,
  crossesMidnight,
  dateToTime,
  parseMinutes,
  saveAttendanceShift,
  SHIFT_NAME_MAX_LENGTH,
  timeToDate,
  validateShift,
  WEEK_DAYS,
  type AttendanceShift,
  type AttendanceShiftInput,
  type WeekDay,
} from "../../../../services/attendanceService";

type ShiftSheetProps = {
  /** null: a new shift. */
  shift: AttendanceShift | null;
  onClose: () => void;
  /** Saved: the API's message (if any). */
  onSaved: (message: string | null) => void;
};

/**
 * Add / edit a shift: name, start and end time (an end at or before the start is a night shift that ends the next
 * day), grace minutes, optional half-day minutes, work days and "default shift" (for employees without their own).
 * Stays open with the API's reason when it refuses.
 */
export function ShiftSheet({ shift, onClose, onSaved }: ShiftSheetProps) {
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(shift?.name ?? "");
  const [startTime, setStartTime] = useState(shift?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(shift?.endTime ?? "18:00");
  const [grace, setGrace] = useState(String(shift?.graceMinutes ?? 15));
  const [halfDay, setHalfDay] = useState(shift?.halfDayMinutes ? String(shift.halfDayMinutes) : "");
  const [workDays, setWorkDays] = useState<WeekDay[]>(shift?.workDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [isDefault, setIsDefault] = useState(shift?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set at once: a double tap must not save twice.
  const busyRef = useRef(false);

  const close = () => {
    if (!busyRef.current) onClose();
  };

  const toggleDay = (day: WeekDay) =>
    setWorkDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : WEEK_DAYS.filter((d) => d === day || days.includes(d))));

  const save = async () => {
    if (busyRef.current) return;
    const graceMinutes = parseMinutes(grace);
    const input: AttendanceShiftInput = {
      name,
      startTime,
      endTime,
      graceMinutes: graceMinutes ?? 0,
      halfDayMinutes: parseMinutes(halfDay),
      workDays,
      isDefault,
    };
    const invalid = validateShift(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError("");
    try {
      const message = await saveAttendanceShift(shift?.id ?? null, input);
      busyRef.current = false;
      onSaved(message);
    } catch (err) {
      busyRef.current = false;
      setSaving(false);
      setError(attendanceErrorMessage(err, "The shift could not be saved."));
    }
  };

  const night = crossesMidnight(startTime, endTime);
  const formatClock = (d: Date) => clockText(dateToTime(d));

  return (
    <BottomSheet
      visible
      onClose={close}
      dismissible={!saving}
      title={shift ? "Edit shift" : "Add shift"}
      scrollable
      error={error}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={close} disabled={saving} style={styles.flex} />
          <Button title="Save shift" onPress={save} loading={saving} disabled={saving} haptic style={styles.flex} />
        </>
      }
    >
      <View style={styles.body}>
        <TextField
          label="Name"
          required
          value={name}
          onChangeText={setName}
          maxLength={SHIFT_NAME_MAX_LENGTH}
          placeholder="For example: Day shift"
          disabled={saving}
        />
        <View style={styles.row}>
          <DateField
            label="Start"
            mode="time"
            value={timeToDate(startTime)}
            onChange={(d) => setStartTime(dateToTime(d))}
            format={formatClock}
            disabled={saving}
            containerStyle={styles.flex}
          />
          <DateField
            label="End"
            mode="time"
            value={timeToDate(endTime)}
            onChange={(d) => setEndTime(dateToTime(d))}
            format={formatClock}
            disabled={saving}
            containerStyle={styles.flex}
          />
        </View>
        {night ? (
          <View style={styles.night}>
            <StatusPill tone="indigo" label="Night shift" icon="moon-outline" />
            <AppText variant="caption" color="textMuted" style={styles.flex}>
              Ends the next day. The day counts as the date the shift starts.
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <TextField
            label="Grace (minutes)"
            value={grace}
            onChangeText={setGrace}
            keyboardType="number-pad"
            maxLength={3}
            disabled={saving}
            containerStyle={styles.flex}
          />
          <TextField
            label="Half day under (min)"
            value={halfDay}
            onChangeText={setHalfDay}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="Optional"
            disabled={saving}
            containerStyle={styles.flex}
          />
        </View>
        <View style={styles.group}>
          <FieldLabel label="Work days" />
          <View style={styles.chips}>
            {WEEK_DAYS.map((d) => (
              <Chip key={d} label={d} selected={workDays.includes(d)} onPress={() => toggleDay(d)} disabled={saving} />
            ))}
          </View>
        </View>
        <SwitchRow
          label="Default shift"
          description="Used for employees without a shift of their own."
          value={isDefault}
          onValueChange={setIsDefault}
          disabled={saving}
          style={styles.switchRow}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { gap: t.spacing.md },
    row: { flexDirection: "row", gap: t.spacing.md },
    group: { gap: t.spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    night: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    switchRow: { paddingHorizontal: 0 },
  });
