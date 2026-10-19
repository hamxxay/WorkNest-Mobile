import type { ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme, type Tone } from "../../theme";
import { PRESS_SCALE_LARGE, ScalePressable } from "../motion/ScalePressable";
import { stackLabelValue, textScale } from "../../utils/responsive";
import { Avatar } from "./Avatar";

export type ListRowProps = {
  title: string;
  subtitle?: string | null;
  /** Small text on the right (date, amount, count). */
  meta?: string | null;
  /**
   * How `meta` looks. "caption" (default): small muted text (dates, counts). "amount": a figure in a list of figures
   * (dashboard lists): text colour, semibold, tabular digits, right-aligned so the column of figures lines up.
   */
  metaVariant?: "caption" | "amount";
  /** Ionicons name shown in a tinted circle on the left. */
  leftIcon?: string;
  /** Tint of the left icon circle. Default "primary". */
  leftIconTone?: Tone;
  /** Shows an initials/photo avatar on the left. */
  avatar?: { name?: string | null; uri?: string | null };
  /** Any custom left element (overrides leftIcon / avatar). */
  left?: ReactNode;
  /** Any custom right element (e.g. <StatusPill/>, <Switch/>). Rendered after meta. */
  right?: ReactNode;
  /** Show a chevron. Default: true when onPress is set. */
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Red title (e.g. "Delete account", "Log out"). */
  destructive?: boolean;
  /** Max lines for title / subtitle. Default 1 / 2 (title 2 with large system text). */
  titleLines?: number;
  subtitleLines?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Standard list row: [icon/avatar] title + subtitle ... meta [right] [chevron]. Min height 56. */
export function ListRow({
  title,
  subtitle,
  meta,
  metaVariant = "caption",
  leftIcon,
  leftIconTone = "primary",
  avatar,
  left,
  right,
  chevron,
  onPress,
  onLongPress,
  disabled = false,
  destructive = false,
  titleLines,
  subtitleLines = 2,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors, tones, typography } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  // Large text on a phone: the meta (date, amount, "12 quotes · 3 won") and the right element (status pill, badge)
  // go under the subtitle instead of squeezing the title to a few letters.
  const below = stackLabelValue(width, fontScale);
  const metaBelow = !!meta && below;
  const titleMax = titleLines ?? (textScale(fontScale) >= 1.3 ? 2 : 1);
  const rightBelow = right != null && right !== false && below;
  const pressable = !!(onPress || onLongPress);
  const showChevron = chevron ?? !!onPress;
  const tone = destructive ? tones.danger : tones[leftIconTone];
  const amount = metaVariant === "amount";

  const leading =
    left ??
    (avatar ? (
      <Avatar name={avatar.name} uri={avatar.uri} size={40} />
    ) : leftIcon ? (
      <View style={[styles.iconWell, { backgroundColor: tone.bg }]}>
        <Ionicons name={leftIcon} size={20} color={tone.fg} />
      </View>
    ) : null);

  const content = (
    <>
      {leading}
      <View style={styles.body}>
        <Text
          numberOfLines={titleMax}
          style={[typography.bodyStrong, { color: destructive ? colors.danger : colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={subtitleLines} style={[typography.bodySmall, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
        {metaBelow ? (
          <Text
            numberOfLines={2}
            style={amount ? [typography.amount, { color: colors.text }] : [typography.caption, { color: colors.textMuted }]}
          >
            {meta}
          </Text>
        ) : null}
        {rightBelow ? <View style={styles.rightBelow}>{right}</View> : null}
      </View>
      {meta && !metaBelow ? (
        <Text
          numberOfLines={1}
          style={
            amount
              ? [typography.amount, styles.meta, styles.metaAmount, { color: colors.text }]
              : [typography.caption, styles.meta, { color: colors.textMuted }]
          }
        >
          {meta}
        </Text>
      ) : null}
      {rightBelow ? null : right}
      {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );

  const label = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(", ");

  if (!pressable) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.row, style]}>
        {content}
      </View>
    );
  }
  return (
    <ScalePressable
      pressScale={PRESS_SCALE_LARGE}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }, disabled && styles.disabled, style]}
    >
      {content}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  body: { flex: 1, gap: 2 },
  iconWell: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  meta: { maxWidth: "35%", flexShrink: 1, textAlign: "right" },
  metaAmount: { maxWidth: "42%" },
  rightBelow: { alignSelf: "flex-start", marginTop: 2 },
  disabled: { opacity: 0.5 },
});
