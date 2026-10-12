import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "../../theme";
import { formatDate, formatDateTime, formatTime, parseDate } from "../../utils/format";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { FieldShell, fieldA11yLabel, fieldBoxColors, fieldStyles, type FieldBaseProps } from "./Field";

export type DateFieldMode = "date" | "time" | "datetime";

export type DateFieldProps = FieldBaseProps & {
  /** Date, ISO string ("2026-10-12" is read as a local date) or null. */
  value: Date | string | null | undefined;
  onChange: (date: Date) => void;
  /** Default "date". "datetime" opens the date dialog, then the time dialog. */
  mode?: DateFieldMode;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  /** Custom display text. Default: formatDate / formatTime / formatDateTime. */
  format?: (date: Date) => string;
  /** Shows an x to clear the value. */
  onClear?: () => void;
  /** Ionicons name. Default calendar-outline (time-outline for mode "time"). */
  leftIcon?: string;
  /** Material 3 dialog title on Android. */
  pickerTitle?: string;
  accessibilityLabel?: string;
};

function merge(datePart: Date, timePart: Date): Date {
  const d = new Date(datePart);
  d.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return d;
}

/**
 * Date / time field. On Android it opens the native Material 3 dialog (DateTimePickerAndroid.open), which follows
 * the app's light/dark choice (ThemeProvider sets Android night mode).
 *
 *   <DateField label="Start date" required value={start} onChange={setStart} minimumDate={new Date()} />
 */
export function DateField({
  label,
  required,
  helperText,
  error,
  disabled = false,
  containerStyle,
  value,
  onChange,
  mode = "date",
  minimumDate,
  maximumDate,
  placeholder,
  format,
  onClear,
  leftIcon,
  pickerTitle,
  accessibilityLabel,
}: DateFieldProps) {
  const { colors, typography, isDark } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const date = parseDate(value);

  const display = date
    ? format
      ? format(date)
      : mode === "time"
        ? formatTime(date)
        : mode === "datetime"
          ? formatDateTime(date)
          : formatDate(date, { weekday: true })
    : null;
  const hint = placeholder ?? (mode === "time" ? "Select a time" : "Select a date");

  // Material 3 dialogs, like the existing booking screens. Their colours come from the Android theme
  // (res/values*/colors.xml picker_*), which follows the app's light/dark choice via ThemeProvider.
  const androidCommon = {
    design: "material" as const,
    positiveButton: { label: "OK", textColor: colors.primary },
    negativeButton: { label: "Cancel", textColor: colors.textMuted },
  };

  const openAndroid = () => {
    const initial = date ?? minimumDate ?? new Date();
    const pickTime = (base: Date) =>
      DateTimePickerAndroid.open({
        value: base,
        mode: "time",
        is24Hour: false,
        title: pickerTitle,
        ...androidCommon,
        onChange: (event: DateTimePickerEvent, picked?: Date) => {
          if (event.type === "set" && picked) onChange(mode === "datetime" ? merge(base, picked) : picked);
        },
      });

    if (mode === "time") {
      pickTime(initial);
      return;
    }
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      minimumDate,
      maximumDate,
      title: pickerTitle,
      ...androidCommon,
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type !== "set" || !picked) return;
        if (mode === "datetime") {
          pickTime(merge(picked, date ?? initial));
        } else {
          onChange(picked);
        }
      },
    });
  };

  const open = () => {
    if (disabled) return;
    if (Platform.OS === "android") {
      openAndroid();
    } else {
      setIosDraft(date ?? minimumDate ?? new Date());
      setIosOpen(true);
    }
  };

  const box = fieldBoxColors(colors, { error: !!error, disabled, focused: iosOpen });
  const spoken = accessibilityLabel ?? fieldA11yLabel(label, required) ?? hint;
  const icon = leftIcon ?? (mode === "time" ? "time-outline" : "calendar-outline");

  return (
    <FieldShell label={label} required={required} helperText={helperText} error={error} disabled={disabled} containerStyle={containerStyle}>
      <View style={[fieldStyles.box, box, styles.clip]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${spoken}: ${display ?? "not set"}`}
          accessibilityHint={error ? `Error: ${error}` : mode === "time" ? "Opens a time picker" : "Opens a calendar"}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={open}
          style={styles.trigger}
        >
          <Ionicons name={icon} size={20} color={error ? colors.danger : colors.textMuted} />
          <Text
            numberOfLines={1}
            style={[typography.body, styles.flex, { color: display ? (disabled ? colors.textMuted : colors.text) : colors.placeholder }]}
          >
            {display ?? hint}
          </Text>
        </Pressable>
        {onClear && date && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label ?? "date"}`}
            onPress={onClear}
            hitSlop={6}
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {Platform.OS !== "android" ? (
        <BottomSheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={pickerTitle ?? label ?? hint}
          footer={
            <>
              <Button title="Cancel" variant="outline" onPress={() => setIosOpen(false)} style={styles.flex} />
              <Button
                title="Done"
                onPress={() => {
                  onChange(iosDraft);
                  setIosOpen(false);
                }}
                style={styles.flex}
              />
            </>
          }
        >
          <DateTimePicker
            value={iosDraft}
            mode={mode}
            display={mode === "date" ? "inline" : "spinner"}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={colors.primary}
            themeVariant={isDark ? "dark" : "light"}
            onChange={(_e: DateTimePickerEvent, picked?: Date) => {
              if (picked) setIosDraft(picked);
            }}
          />
        </BottomSheet>
      ) : null}
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: "hidden", paddingHorizontal: 0 },
  trigger: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  clear: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
