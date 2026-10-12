import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { touchTarget, useTheme, type AppColors } from "../../theme";
import { Badge } from "./Badge";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  /** Visible label (also the default accessibilityLabel). */
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Ionicons name shown before the label (replaced by a spinner while loading). */
  leftIcon?: string;
  /** Ionicons name shown after the label. */
  rightIcon?: string;
  /** Stretch to the parent's width. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const SIZES: Record<ButtonSize, { height: number; padX: number; font: number; icon: number; radius: number }> = {
  // sm is 36dp tall visually; hitSlop extends its touch target to 44dp.
  sm: { height: 36, padX: 14, font: 14, icon: 16, radius: 8 },
  md: { height: 48, padX: 18, font: 16, icon: 18, radius: 10 },
  lg: { height: 54, padX: 22, font: 16, icon: 20, radius: 12 },
};

type VariantColors = { bg: string; bgPressed: string; fg: string; border: string; ripple: string };

function variantColors(variant: ButtonVariant, c: AppColors): VariantColors {
  switch (variant) {
    case "secondary":
      return { bg: c.primarySoft, bgPressed: c.primarySoft, fg: c.onPrimarySoft, border: "transparent", ripple: c.ripple };
    case "outline":
      return { bg: "transparent", bgPressed: c.surfaceAlt, fg: c.text, border: c.borderStrong, ripple: c.ripple };
    case "ghost":
      return { bg: "transparent", bgPressed: c.surfaceAlt, fg: c.link, border: "transparent", ripple: c.ripple };
    case "danger":
      return { bg: c.dangerStrong, bgPressed: c.dangerPressed, fg: "#ffffff", border: "transparent", ripple: c.rippleOnPrimary };
    case "primary":
    default:
      return { bg: c.primaryStrong, bgPressed: c.primaryPressed, fg: c.onPrimary, border: "transparent", ripple: c.rippleOnPrimary };
  }
}

/**
 * Themed button. Variants: primary | secondary | outline | ghost | danger. Sizes: sm (36) | md (48) | lg (54).
 * Every size has a >= 44dp touch target, android_ripple, a pressed state and button accessibility.
 */
export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  hitSlop,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const v = useMemo(() => variantColors(variant, colors), [variant, colors]);
  const s = SIZES[size];
  const inactive = disabled || loading;
  const slop = Math.max(0, Math.ceil((touchTarget - s.height) / 2));

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={hitSlop ?? (slop ? { top: slop, bottom: slop } : undefined)}
      android_ripple={{ color: v.ripple }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: s.height,
          paddingHorizontal: s.padX,
          borderRadius: s.radius,
          backgroundColor: pressed ? v.bgPressed : v.bg,
          borderColor: v.border,
          borderWidth: variant === "outline" ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        inactive && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : leftIcon ? (
          <Ionicons name={leftIcon} size={s.icon} color={v.fg} />
        ) : null}
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
          style={[styles.label, { color: v.fg, fontSize: s.font }, textStyle]}
        >
          {title}
        </Text>
        {rightIcon && !loading ? <Ionicons name={rightIcon} size={s.icon} color={v.fg} /> : null}
      </View>
    </Pressable>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

export type IconButtonVariant = "plain" | "tonal" | "outline" | "onDark" | "primary";

export type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  /** Ionicons name. */
  icon: string;
  /** Required: icon-only buttons need a spoken label. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  /** Visual size of the circle (touch target is always >= 44). Default 44. */
  size?: number;
  iconSize?: number;
  /** Overrides the icon colour. */
  color?: string;
  /** Count badge in the top-right corner (hidden at 0). */
  badge?: number;
  /** Small dot badge instead of a count. */
  dot?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Round 44dp icon button (header actions, card actions). */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = "plain",
  size = touchTarget,
  iconSize = 22,
  color,
  badge,
  dot,
  disabled = false,
  style,
  hitSlop,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  const palette: Record<IconButtonVariant, { bg: string; fg: string; border: string; ripple: string }> = {
    plain: { bg: "transparent", fg: colors.text, border: "transparent", ripple: colors.ripple },
    tonal: { bg: colors.surfaceAlt, fg: colors.text, border: "transparent", ripple: colors.ripple },
    outline: { bg: colors.surface, fg: colors.text, border: colors.border, ripple: colors.ripple },
    onDark: { bg: colors.onHeaderFill, fg: colors.onHeader, border: colors.headerLine, ripple: colors.rippleOnPrimary },
    primary: { bg: colors.primaryStrong, fg: colors.onPrimary, border: "transparent", ripple: colors.rippleOnPrimary },
  };
  const p = palette[variant];
  const slop = Math.max(0, Math.ceil((touchTarget - size) / 2));
  const label = badge && badge > 0 ? `${accessibilityLabel}, ${badge} new` : accessibilityLabel;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop ?? (slop ? slop : undefined)}
      android_ripple={{ color: p.ripple, borderless: variant === "plain", radius: size / 2 + 2 }}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: p.border === "transparent" ? 0 : 1,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color ?? p.fg} />
      {badge || dot ? (
        <View style={styles.badgeSlot} pointerEvents="none">
          <Badge count={badge} dot={dot && !badge} ring={variant === "onDark" ? colors.headerBg : colors.surface} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  label: { fontWeight: "600", includeFontPadding: false, textAlign: "center" },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.5 },
  iconBtn: { alignItems: "center", justifyContent: "center" },
  badgeSlot: { position: "absolute", top: 2, right: 2 },
});
