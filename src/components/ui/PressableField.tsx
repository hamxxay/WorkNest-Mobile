import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { FieldShell, fieldA11yLabel, fieldBoxColors, fieldStyles, type FieldBaseProps } from "./Field";

export type PressableFieldProps = FieldBaseProps & {
  /** Main text (the chosen value). Empty shows the placeholder. */
  value?: string | null;
  /** Optional grey second line under the value (e.g. a customer's email and phone). */
  subtitle?: string | null;
  placeholder?: string;
  /** Ionicons name on the left. */
  leftIcon?: string;
  /** Ionicons name on the right. Default "chevron-down". Pass null to hide. */
  rightIcon?: string | null;
  onPress: () => void;
  /** Spinner instead of the right icon. */
  loading?: boolean;
  /** Draws the focused border (e.g. while its sheet is open). */
  active?: boolean;
  /** Spoken name; default the label. The value is appended automatically. */
  accessibilityLabel?: string;
  /** Default "Opens a list". */
  accessibilityHint?: string;
};

/**
 * A field-shaped button that opens a picker, sheet or search screen (same box as TextField / SelectField).
 *
 *   <PressableField label="Customer" required value={customer?.fullName} subtitle={customer?.email}
 *     placeholder="Search customers" leftIcon="person-outline" onPress={() => setOpen(true)} active={open} />
 */
export function PressableField({
  label,
  required,
  helperText,
  error,
  disabled = false,
  containerStyle,
  value,
  subtitle,
  placeholder = "Select",
  leftIcon,
  rightIcon = "chevron-down",
  onPress,
  loading = false,
  active = false,
  accessibilityLabel,
  accessibilityHint,
}: PressableFieldProps) {
  const { colors, typography } = useTheme();
  const box = fieldBoxColors(colors, { focused: active, error: !!error, disabled });
  const spoken = accessibilityLabel ?? fieldA11yLabel(label, required) ?? placeholder;
  const hasValue = !!(value && String(value).trim());

  return (
    <FieldShell label={label} required={required} helperText={helperText} error={error} disabled={disabled} containerStyle={containerStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${spoken}: ${hasValue ? value : "not selected"}`}
        accessibilityHint={error ? `Error: ${error}` : accessibilityHint ?? "Opens a list"}
        accessibilityState={{ disabled, expanded: active }}
        disabled={disabled}
        onPress={onPress}
        android_ripple={{ color: colors.ripple }}
        style={[fieldStyles.box, box, styles.box]}
      >
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={error ? colors.danger : colors.textMuted} /> : null}
        <View style={styles.texts}>
          <Text
            numberOfLines={1}
            style={[typography.body, { color: hasValue ? (disabled ? colors.textMuted : colors.text) : colors.placeholder }]}
          >
            {hasValue ? value : placeholder}
          </Text>
          {hasValue && subtitle ? (
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : rightIcon ? (
          <Ionicons name={rightIcon} size={18} color={colors.textMuted} />
        ) : null}
      </Pressable>
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", paddingVertical: 6 },
  texts: { flex: 1 },
});
