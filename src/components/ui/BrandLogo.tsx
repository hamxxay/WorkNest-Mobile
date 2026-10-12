import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { palette, useTheme, type TypographyVariant } from "../../theme";

/** The silver W, tightly cropped (generated with the app icons by scripts/make-app-icons.py). */
const W_IMAGE = require("../../assets/brand/worknest-w.png");

/** Width / height of the W artwork. */
export const BRAND_W_ASPECT = 555 / 352;

/** Brand navy behind the W (app icon, splash, CMS sidebar). The same in light and dark mode. */
export const BRAND_NAVY = palette.slate[900];

export type BrandLogoProps = {
  /**
   * mark (default): the silver W on its own, for navy / dark backgrounds (splash, dashboard header).
   * tile: the W on a navy rounded square, like the app icon. Works on any background.
   */
  variant?: "mark" | "tile";
  /** Width of the W (mark) or side of the square (tile), in dp. Default 40 (mark) / 44 (tile). */
  size?: number;
  /** One-colour W in this colour (e.g. `colors.onHeader` on a teal bar). Default: the silver artwork. */
  color?: string;
  /** Show "WorkNest" next to (row) or under (column) the logo. */
  wordmark?: boolean;
  layout?: "row" | "column";
  /** Wordmark colour. Default `colors.text`. */
  wordmarkColor?: string;
  /** Wordmark type style. Default: `title` in a row (heading below 40dp), `display` in a column. */
  wordmarkVariant?: TypographyVariant;
  /** Default "WorkNest". */
  accessibilityLabel?: string;
  /** false when the logo is decorative (a visible title already says WorkNest). Default true. */
  accessible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The WorkNest logo: the silver ribbon W, optionally on the navy tile and with the "WorkNest" wordmark.
 *
 *   <BrandLogo size={108} />                               // splash, navy screens
 *   <BrandLogo variant="tile" size={44} wordmark />        // auth screens, light pages
 *   <BrandLogo size={34} color={colors.onHeader} />        // one-colour W on a coloured bar
 */
export function BrandLogo({
  variant = "mark",
  size,
  color,
  wordmark = false,
  layout = "row",
  wordmarkColor,
  wordmarkVariant,
  accessibilityLabel = "WorkNest",
  accessible = true,
  style,
  testID,
}: BrandLogoProps) {
  const { colors, typography } = useTheme();
  const tile = variant === "tile";
  const box = size ?? (tile ? 44 : 40);
  const wWidth = tile ? Math.round(box * 0.62) : box;
  const wHeight = wWidth / BRAND_W_ASPECT;

  const w = (
    <Image
      source={W_IMAGE}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={[{ width: wWidth, height: wHeight }, color ? { tintColor: color } : null]}
    />
  );

  const logo = tile ? (
    <View
      style={[
        styles.tile,
        { width: box, height: box, borderRadius: Math.round(box * 0.26), borderColor: colors.headerLine },
      ]}
    >
      {w}
    </View>
  ) : (
    w
  );

  const a11y = accessible
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: "no-hide-descendants" as const };

  if (!wordmark) {
    return (
      <View testID={testID} {...a11y} style={style}>
        {logo}
      </View>
    );
  }

  const column = layout === "column";
  const logoHeight = tile ? box : wHeight;
  const textVariant: TypographyVariant = wordmarkVariant ?? (column ? "display" : logoHeight >= 40 ? "title" : "heading");
  const gap = column ? 16 : Math.max(10, Math.round(logoHeight * 0.28));

  return (
    <View testID={testID} {...a11y} style={[column ? styles.column : styles.row, { gap }, style]}>
      {logo}
      <Text
        style={[typography[textVariant], { color: wordmarkColor ?? colors.text }]}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
      >
        WorkNest
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: BRAND_NAVY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center" },
  column: { alignItems: "center" },
});
