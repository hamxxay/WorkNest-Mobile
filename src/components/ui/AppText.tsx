import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme, type AppColors, type TypographyVariant } from "../../theme";

/** Semantic text colours; any other string is used as a raw colour. */
export type TextColor =
  | "text"
  | "textSecondary"
  | "textMuted"
  | "textDisabled"
  | "primary"
  | "link"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "onPrimary"
  | "onHeader"
  | "onHeaderMuted";

export type AppTextProps = TextProps & {
  /** Type-scale step. Default "body". */
  variant?: TypographyVariant;
  /** Semantic colour key (default "text") or a raw colour string. */
  color?: TextColor | (string & {});
  align?: TextStyle["textAlign"];
  /** Override the variant's weight (400-700). */
  weight?: "400" | "500" | "600" | "700";
};

export function resolveColor(colors: AppColors, color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return (colors as Record<string, string>)[color] ?? color;
}

/** Text that follows the type scale and the active palette. */
export function AppText({ variant = "body", color, align, weight, style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: resolveColor(colors, color, colors.text) },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}
