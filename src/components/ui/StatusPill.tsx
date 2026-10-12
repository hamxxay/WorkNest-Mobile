import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { statusLabel, statusTone, useTheme, type Tone } from "../../theme";

export type StatusPillProps = {
  /** Raw API status ("Confirmed", "AgreementSent", "in_progress", ...). Sets tone and label automatically. */
  status?: string | null;
  /** Override the label (e.g. a translated or shortened text). */
  label?: string;
  /** Override the tone (or use without `status`). */
  tone?: Tone;
  /** Ionicons name instead of the dot. Pass `false` to hide the dot. */
  icon?: string | false;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

/** Coloured status badge consistent with the CMS. `<StatusPill status={booking.bookingStatus} />` */
export function StatusPill({ status, label, tone, icon, size = "sm", style }: StatusPillProps) {
  const { tones } = useTheme();
  const t = tones[tone ?? statusTone(status)];
  const text = label ?? statusLabel(status);
  const md = size === "md";

  return (
    <View
      accessible
      accessibilityLabel={`Status: ${text}`}
      style={[
        styles.pill,
        md ? styles.md : styles.sm,
        { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={md ? 14 : 12} color={t.fg} />
      ) : icon === false ? null : (
        <View style={[styles.dot, { backgroundColor: t.solid }]} />
      )}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[styles.text, { color: t.fg, fontSize: md ? 13 : 12 }]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2, minHeight: 22 },
  md: { paddingHorizontal: 12, paddingVertical: 4, minHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontWeight: "600", includeFontPadding: false },
});
