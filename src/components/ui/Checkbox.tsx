import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { FieldMessage } from "./Field";

export type CheckboxProps = {
  /** Text next to the box (also the spoken label). Pass a node for rich text and set accessibilityLabel. */
  label: string | ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Inline error under the row; also turns the box red. */
  error?: string | null | false;
  /** Grey second line under the label. */
  description?: string;
  /** Required when `label` is not a string. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tick box with a label. The whole row (min 44dp) toggles it; screen readers hear a checkbox with its state.
 *
 *   <Checkbox checked={accepted} onChange={setAccepted} label="I agree to the terms" error={termsError} />
 */
export function Checkbox({ label, checked, onChange, disabled = false, error, description, accessibilityLabel, style }: CheckboxProps) {
  const { colors, typography } = useTheme();
  const borderColor = error ? colors.danger : checked ? colors.primaryStrong : colors.inputBorder;
  const spoken = accessibilityLabel ?? (typeof label === "string" ? label : undefined);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={spoken}
        accessibilityHint={error ? `Error: ${error}` : description}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        hitSlop={4}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <View
          style={[
            styles.box,
            { borderColor, backgroundColor: checked ? colors.primaryStrong : colors.surface },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </View>
        <View style={styles.texts}>
          {typeof label === "string" ? (
            <Text style={[typography.bodySmall, { color: disabled ? colors.textMuted : colors.text }]}>{label}</Text>
          ) : (
            label
          )}
          {description ? <Text style={[typography.caption, { color: colors.textMuted }]}>{description}</Text> : null}
        </View>
      </Pressable>
      {error ? (
        <View style={styles.message}>
          <FieldMessage error={error} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: -1 },
  texts: { flex: 1, gap: 2 },
  message: { paddingLeft: 36 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
