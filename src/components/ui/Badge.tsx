import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type Tone } from "../../theme";

export type BadgeProps = {
  /** Number to show. Hidden when 0 / undefined unless `dot`. */
  count?: number;
  /** Above this shows "99+". Default 99. */
  max?: number;
  /** Small dot without a number. */
  dot?: boolean;
  /** Default "danger" (notification red). */
  tone?: Extract<Tone, "danger" | "primary" | "neutral" | "warning" | "success" | "info">;
  /** Ring colour that separates the badge from what it overlaps (usually the surface below). */
  ring?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Count / dot badge, e.g. unread notifications on a bell icon. */
export function Badge({ count, max = 99, dot = false, tone = "danger", ring, accessibilityLabel, style }: BadgeProps) {
  const { tones, colors } = useTheme();
  const n = count ?? 0;
  if (!dot && n <= 0) return null;
  const bg = tone === "danger" ? colors.dangerStrong : tone === "primary" ? colors.primaryStrong : tones[tone].solid;
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;

  if (dot) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.dot, { backgroundColor: bg }, ringStyle, style]}
      />
    );
  }
  const text = n > max ? `${max}+` : String(n);
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${n} new`}
      style={[styles.badge, { backgroundColor: bg }, ringStyle, style]}
    >
      <Text style={styles.text} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#ffffff", fontSize: 11, lineHeight: 13, fontWeight: "700", includeFontPadding: false },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
