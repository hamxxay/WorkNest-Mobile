import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";

export type SegmentOption<T extends string | number> = {
  label: string;
  value: T;
  /** Ionicons name before the label. */
  icon?: string;
  accessibilityLabel?: string;
};

export type SegmentedControlProps<T extends string | number> = {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Spoken name of the whole group, e.g. "Appearance". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** 2-4 mutually exclusive options in a pill track (tabs like Upcoming / History, or System / Light / Dark). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { colors, isDark, shadows, typography } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}
    >
      {options.map((opt, index) => {
        const selected = opt.value === value;
        const fg = selected ? colors.primary : colors.textSecondary;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected, checked: selected, disabled }}
            accessibilityHint={`${index + 1} of ${options.length}`}
            disabled={disabled}
            onPress={() => {
              if (!selected) onChange(opt.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && [
                styles.selected,
                { backgroundColor: isDark ? colors.surfaceRaised : colors.surface, borderColor: isDark ? colors.borderStrong : colors.border },
                !isDark && shadows.sm,
              ],
              pressed && !selected && { opacity: 0.7 },
              disabled && { opacity: 0.5 },
            ]}
          >
            {opt.icon ? <Ionicons name={opt.icon} size={16} color={fg} /> : null}
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[typography.label, { color: fg }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selected: {},
});
