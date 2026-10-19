import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ScalePressable } from "../../../../components/motion/ScalePressable";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import { haptics } from "../../../../utils/haptics";

export type ChoiceTileProps = {
  title: string;
  /** Second line: the room's seats and location, or why a time can't be chosen. */
  subtitle?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Spoken instead of title + subtitle. */
  accessibilityLabel?: string;
};

/**
 * One choice of a single-choice group (a meeting room, a start time): a bordered tile, teal when chosen, grey with
 * its reason when it can't be chosen. Role radio, at least 44dp tall; its group gives the radiogroup label.
 */
export function ChoiceTile({ title, subtitle, selected, disabled = false, onPress, accessibilityLabel }: ChoiceTileProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const fg = disabled ? colors.textMuted : selected ? colors.onPrimarySoft : colors.text;
  const sub = disabled ? colors.textMuted : selected ? colors.onPrimarySoft : colors.textSecondary;
  return (
    <ScalePressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (selected) return;
        haptics.selection();
        onPress();
      }}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        styles.tile,
        selected ? styles.selected : disabled ? styles.disabled : styles.idle,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text maxFontSizeMultiplier={1.6} style={[styles.title, { color: fg }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text maxFontSizeMultiplier={1.6} style={[styles.subtitle, { color: sub }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
      </View>
    </ScalePressable>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    tile: {
      minHeight: t.touchTarget,
      borderRadius: t.radii.control,
      borderWidth: 1,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      justifyContent: "center",
      flexGrow: 1,
    },
    idle: { backgroundColor: c.surface, borderColor: c.borderStrong },
    selected: { backgroundColor: c.primarySoft, borderColor: c.primary, borderWidth: 2 },
    disabled: { backgroundColor: c.surfaceAlt, borderColor: c.border },
    pressed: { opacity: 0.85 },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
    title: { ...t.typography.label },
    subtitle: { ...t.typography.caption },
  });
