import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

export type CardVariant = "elevated" | "outlined" | "filled";

export type CardProps = Omit<ViewProps, "style"> & {
  children?: ReactNode;
  /** elevated (default): surface + hairline border + soft shadow. outlined: border only. filled: surfaceAlt, no border. */
  variant?: CardVariant;
  /** Inner padding in dp. Default 16. */
  padding?: number;
  /** Makes the whole card pressable (ripple + pressed state, accessibilityRole "button"). */
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Content container on the page background. */
export function Card({
  children,
  variant = "elevated",
  padding = 16,
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const { colors, radii, shadows } = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === "filled" ? colors.surfaceAlt : colors.surface,
    borderRadius: radii.card,
    borderWidth: variant === "filled" ? 0 : 1,
    borderColor: colors.border,
    padding,
    ...(variant === "elevated" ? shadows.sm : null),
  };

  if (onPress || onLongPress) {
    return (
      <Pressable
        {...rest}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        android_ripple={{ color: colors.ripple, foreground: true }}
        style={({ pressed }) => [base, { overflow: "hidden" }, pressed && { opacity: 0.92 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {children}
    </View>
  );
}
