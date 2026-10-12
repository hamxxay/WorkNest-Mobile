import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { haptics } from "../../utils/haptics";
import { PRESS_SCALE, ScalePressable } from "../motion/ScalePressable";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Ionicons name before the label. */
  icon?: string;
  /** Count after the label, e.g. "Pending 3". */
  count?: number;
  /** Shows an x button; called when it is pressed. */
  onRemove?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Filter / choice chip. 36dp tall with a 44dp touch target; shrinks a little while pressed (not when removable). */
export function Chip({ label, selected = false, onPress, icon, count, onRemove, disabled = false, accessibilityLabel, style }: ChipProps) {
  const { colors, typography } = useTheme();
  const fg = selected ? colors.onPrimary : colors.text;
  const bg = selected ? colors.primaryStrong : colors.surface;
  const border = selected ? colors.primaryStrong : colors.borderStrong;
  const spoken = accessibilityLabel ?? (count !== undefined ? `${label}, ${count}` : label);

  return (
    <View style={[styles.wrap, style]}>
      <ScalePressable
        // A removable chip is joined to its remove button: scaling one half alone would break the seam.
        pressScale={onRemove ? 1 : PRESS_SCALE}
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={spoken}
        accessibilityState={{ selected, disabled }}
        disabled={disabled || !onPress}
        onPress={onPress}
        hitSlop={{ top: 4, bottom: 4 }}
        android_ripple={{ color: selected ? colors.rippleOnPrimary : colors.ripple }}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: bg, borderColor: border },
          onRemove && styles.withRemove,
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.5 },
        ]}
      >
        {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[typography.label, { color: fg }]}>
          {label}
        </Text>
        {count !== undefined ? (
          <View style={[styles.count, selected ? styles.countOnFill : { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[typography.captionStrong, { color: fg }]}>{count}</Text>
          </View>
        ) : null}
      </ScalePressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={8}
          style={[styles.remove, { backgroundColor: bg, borderColor: border }]}
        >
          <Ionicons name="close" size={16} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type FilterOption<T extends string | number> = { label: string; value: T; count?: number; icon?: string };

type FilterChipsBase<T extends string | number> = {
  options: ReadonlyArray<FilterOption<T>>;
  /** Horizontal scroll (default) or wrap onto several lines. */
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export type FilterChipsProps<T extends string | number> =
  | (FilterChipsBase<T> & { multiple?: false; value: T; onChange: (value: T) => void })
  | (FilterChipsBase<T> & { multiple: true; value: T[]; onChange: (value: T[]) => void });

/** A row of chips for filtering a list (single choice by default, `multiple` for multi-select). A change ticks a selection haptic. */
export function FilterChips<T extends string | number>(props: FilterChipsProps<T>) {
  const { options, scrollable = true, style, contentContainerStyle, accessibilityLabel } = props;

  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multiple) {
      const next = props.value.includes(v) ? props.value.filter(x => x !== v) : [...props.value, v];
      haptics.selection();
      props.onChange(next);
    } else if (props.value !== v) {
      haptics.selection();
      props.onChange(v);
    }
  };

  const chips = options.map(opt => (
    <Chip
      key={String(opt.value)}
      label={opt.label}
      icon={opt.icon}
      count={opt.count}
      selected={isSelected(opt.value)}
      onPress={() => toggle(opt.value)}
    />
  ));

  if (!scrollable) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={[styles.wrapRow, style, contentContainerStyle]}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      style={style}
      contentContainerStyle={[styles.scrollRow, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  withRemove: { borderTopRightRadius: 0, borderBottomRightRadius: 0, paddingRight: 8 },
  remove: {
    minHeight: 36,
    paddingHorizontal: 8,
    justifyContent: "center",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  count: { minWidth: 20, paddingHorizontal: 6, borderRadius: 999, alignItems: "center" },
  // Count bubble on the teal fill of a selected chip.
  countOnFill: { backgroundColor: "rgba(255, 255, 255, 0.22)" },
  scrollRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
