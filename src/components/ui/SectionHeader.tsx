import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { textScale } from "../../utils/responsive";

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Text link on the right, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  /** Ionicons name after the action label. Default chevron-forward. */
  actionIcon?: string;
  /** Small uppercase style (for grouped settings lists) instead of a heading. */
  variant?: "heading" | "overline";
  style?: StyleProp<ViewStyle>;
};

/** Title row above a group of content, with an optional "See all" style action. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon = "chevron-forward",
  variant = "heading",
  style,
}: SectionHeaderProps) {
  const { colors, typography } = useTheme();
  // Large text: the title may take two lines rather than being cut beside the action.
  const { fontScale } = useWindowDimensions();
  const titleLines = textScale(fontScale) >= 1.3 ? 2 : 1;
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titles}>
        <Text
          accessibilityRole="header"
          style={[variant === "overline" ? typography.overline : typography.subheading, {
            color: variant === "overline" ? colors.textMuted : colors.text,
          }]}
          numberOfLines={titleLines}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        >
          <Text style={[typography.label, { color: colors.link }]}>{actionLabel}</Text>
          {actionIcon ? <Ionicons name={actionIcon} size={16} color={colors.link} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32 },
  titles: { flex: 1, gap: 2 },
  action: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 36, justifyContent: "center" },
});
