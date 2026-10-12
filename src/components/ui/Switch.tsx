import { Pressable, Switch as RNSwitch, StyleSheet, Text, View, type StyleProp, type SwitchProps as RNSwitchProps, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";

export type SwitchProps = Omit<RNSwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & {
  /** Required unless the switch sits inside a SwitchRow (which labels it). */
  accessibilityLabel?: string;
};

/** RN Switch in theme colours: teal track when on, a visible (>= 3:1) grey track when off, white thumb. */
export function Switch({ value, disabled, ...rest }: SwitchProps) {
  const { colors } = useTheme();
  return (
    <RNSwitch
      {...rest}
      value={value}
      disabled={disabled}
      trackColor={{ false: colors.inputBorder, true: colors.primaryStrong }}
      thumbColor="#ffffff"
      ios_backgroundColor={colors.inputBorder}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
    />
  );
}

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Ionicons name on the left. */
  icon?: string;
  style?: StyleProp<ViewStyle>;
};

/** Label (+ description) with a Switch on the right; the whole row toggles. Min height 56. */
export function SwitchRow({ label, description, value, onValueChange, disabled = false, icon, style }: SwitchRowProps) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }, disabled && styles.disabled, style]}
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} /> : null}
      <View style={styles.texts}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
        {description ? <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{description}</Text> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  texts: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
});
