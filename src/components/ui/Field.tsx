import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme, type AppColors } from "../../theme";

/** Shared props of every form field (TextField, SelectField, DateField). */
export type FieldBaseProps = {
  label?: string;
  /** Adds a red asterisk (read as "required" by screen readers). */
  required?: boolean;
  /** Grey hint under the field. Hidden while an error is shown. */
  helperText?: string;
  /** Inline error under the field; also turns the border red. Falsy = no error. */
  error?: string | null | false;
  disabled?: boolean;
  /** Style of the outer wrapper (label + box + message). */
  containerStyle?: StyleProp<ViewStyle>;
};

export function fieldA11yLabel(label?: string, required?: boolean): string | undefined {
  if (!label) return undefined;
  return required ? `${label}, required` : label;
}

export function FieldLabel({ label, required, disabled }: { label?: string; required?: boolean; disabled?: boolean }) {
  const { colors, typography } = useTheme();
  if (!label) return null;
  return (
    <Text
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[typography.label, { color: disabled ? colors.textMuted : colors.textSecondary }]}
    >
      {label}
      {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

export function FieldMessage({ error, helperText }: { error?: string | null | false; helperText?: string }) {
  const { colors, typography } = useTheme();
  if (error) {
    return (
      <View style={styles.msgRow} accessibilityLiveRegion="polite">
        <Ionicons name="alert-circle" size={14} color={colors.danger} style={styles.msgIcon} />
        <Text style={[typography.caption, styles.msgText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }
  if (helperText) {
    return <Text style={[typography.caption, { color: colors.textMuted }]}>{helperText}</Text>;
  }
  return null;
}

/** Border / background colours of the field box for its state. */
export function fieldBoxColors(
  colors: AppColors,
  state: { focused?: boolean; error?: boolean; disabled?: boolean },
): { borderColor: string; backgroundColor: string } {
  if (state.disabled) return { borderColor: colors.border, backgroundColor: colors.surfaceAlt };
  if (state.error) return { borderColor: colors.danger, backgroundColor: colors.surface };
  if (state.focused) return { borderColor: colors.focus, backgroundColor: colors.surface };
  return { borderColor: colors.inputBorder, backgroundColor: colors.surface };
}

/** Label + children + helper/error message, with consistent spacing. */
export function FieldShell({
  label,
  required,
  helperText,
  error,
  disabled,
  containerStyle,
  children,
}: FieldBaseProps & { children: ReactNode }) {
  return (
    <View style={[styles.shell, containerStyle]}>
      <FieldLabel label={label} required={required} disabled={disabled} />
      {children}
      <FieldMessage error={error} helperText={helperText} />
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  box: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
});

const styles = StyleSheet.create({
  shell: { gap: 6 },
  msgRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  msgIcon: { marginTop: 1 },
  msgText: { flex: 1 },
});
