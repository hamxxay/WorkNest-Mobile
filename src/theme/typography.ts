import { Platform, type TextStyle } from "react-native";

/**
 * Type scale in Inter, the web CMS font. Weights 400-700 only; 800/900 are retired.
 * Every size is >= 12 except `overline` (11, uppercase, tracked).
 *
 * Fonts: android/app/src/main/assets/fonts (see src/components/ui/docs/font.md). Android cannot pick a weight
 * from one family name for asset fonts, so every style sets BOTH fontFamily and fontWeight through `fontFor()`.
 * Never write `fontWeight` alone in a style: spread `...fontFor("600")` (or a `typography.*` variant) instead.
 */

export type FontWeight = "400" | "500" | "600" | "700";

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const satisfies Record<string, FontWeight>;

/**
 * Inter family name per weight (Android asset file in brackets). React Native looks fonts up as
 * `assets/fonts/<family>.ttf`, plus `<family>_bold.ttf` when fontWeight >= 700, so 400 and 700 share "Inter"
 * and 500 / 600 have their own names. These are also the fonts' iOS names (family "Inter", PostScript
 * "Inter-Medium" / "Inter-SemiBold"), so the same styles work there once the files are linked.
 */
export const fontFamilies = {
  /** 400 [Inter.ttf] */
  regular: "Inter",
  /** 500 [Inter-Medium.ttf] */
  medium: "Inter-Medium",
  /** 600 [Inter-SemiBold.ttf] */
  semibold: "Inter-SemiBold",
  /** 700 [Inter_bold.ttf, picked by fontWeight "700"] */
  bold: "Inter",
} as const;

const FAMILY_BY_WEIGHT: Record<FontWeight, string> = {
  "400": fontFamilies.regular,
  "500": fontFamilies.medium,
  "600": fontFamilies.semibold,
  "700": fontFamilies.bold,
};

const BRAND_FAMILIES = new Set<string>(Object.values(fontFamilies));

/**
 * Platforms whose native project bundles Inter. Android only for now; iOS keeps the system font until the TTFs
 * are added to the Xcode project (UIAppFonts), then add "ios" here.
 */
const BRAND_FONT_PLATFORMS: ReadonlyArray<string> = ["android"];

export function hasBrandFont(os: string = Platform.OS): boolean {
  return BRAND_FONT_PLATFORMS.includes(os);
}

/** Any React Native fontWeight ("bold", 600, "semibold", "800") to the nearest shipped weight (400-700). */
export function normalizeFontWeight(weight: TextStyle["fontWeight"] | null): FontWeight {
  if (weight == null || weight === "normal") return "400";
  if (weight === "bold") return "700";
  const n = typeof weight === "number" ? weight : Number(weight);
  if (Number.isNaN(n)) {
    if (weight === "medium") return "500";
    if (weight === "semibold") return "600";
    if (weight === "heavy" || weight === "black" || weight === "condensedBold") return "700";
    return "400";
  }
  if (n >= 700) return "700";
  if (n >= 600) return "600";
  if (n >= 500) return "500";
  return "400";
}

export type FontStyle = { fontFamily?: string; fontWeight: FontWeight };

/**
 * `{ fontFamily, fontWeight }` for a weight. Spread it into Text / TextInput styles instead of a bare fontWeight:
 *
 *   label: { ...typography.body, ...fontFor("600") }     // Inter SemiBold on Android
 *
 * Without the brand font (iOS for now) it returns only the weight, so the system font is used.
 */
export function fontFor(weight: TextStyle["fontWeight"] = "400", os: string = Platform.OS): FontStyle {
  const w = normalizeFontWeight(weight);
  return hasBrandFont(os) ? { fontFamily: FAMILY_BY_WEIGHT[w], fontWeight: w } : { fontWeight: w };
}

/**
 * Re-pick the Inter family for a flattened style's final fontWeight (e.g. `typography.body` + `fontWeight: "600"`
 * would otherwise stay on the regular file). Styles with another family (cursive, icon fonts) are left alone.
 */
export function withBrandFont<T extends TextStyle>(style: T, os: string = Platform.OS): T {
  if (!hasBrandFont(os)) return style;
  if (style.fontFamily && !BRAND_FAMILIES.has(style.fontFamily)) return style;
  return { ...style, ...fontFor(style.fontWeight, os) };
}

/**
 * Font props for react-native-svg `<Text>` / `<TSpan>` (chart labels). On Android react-native-svg opens
 * `assets/fonts/<fontFamily>.ttf` itself and ignores the `_bold` rule, so 700 must name the bold file directly
 * (`fontFor("700")` there would draw the regular file). Elsewhere it is the same as `fontFor`.
 *
 *   <SvgText {...svgFontFor("600")} fontSize={12} fill={c.textMuted}>Jan</SvgText>
 */
export function svgFontFor(weight: TextStyle["fontWeight"] = "400", os: string = Platform.OS): FontStyle {
  const font = fontFor(weight, os);
  return font.fontFamily && font.fontWeight === "700" ? { ...font, fontFamily: "Inter_bold" } : font;
}

/** Equal-width digits (Inter `tnum`): money, counts and times that line up or change in place. */
export const tabularNums = { fontVariant: ["tabular-nums"] } satisfies TextStyle;

/** The type scale for a platform (`typography` below is the one for this device). */
export function createTypography(os: string = Platform.OS) {
  const f = (weight: FontWeight) => fontFor(weight, os);
  return {
    /** Hero numbers and page heroes. 28/34 bold. */
    display: { fontSize: 28, lineHeight: 34, ...f("700"), letterSpacing: -0.4 },
    /** Screen titles. 22/28 bold. */
    title: { fontSize: 22, lineHeight: 28, ...f("700"), letterSpacing: -0.2 },
    /** Card titles, sheet titles, header titles. 18/24 semibold. */
    heading: { fontSize: 18, lineHeight: 24, ...f("600") },
    /** Section titles, list row titles that need emphasis. 16/22 semibold. */
    subheading: { fontSize: 16, lineHeight: 22, ...f("600") },
    /** Default reading text. 15/22 regular. */
    body: { fontSize: 15, lineHeight: 22, ...f("400") },
    /** Emphasised body text, list row titles, values. 15/22 semibold. */
    bodyStrong: { fontSize: 15, lineHeight: 22, ...f("600") },
    /** Dense secondary text (subtitles, table cells). 14/20 regular. */
    bodySmall: { fontSize: 14, lineHeight: 20, ...f("400") },
    /** Form labels, chip and small-button text. 14/20 semibold. */
    label: { fontSize: 14, lineHeight: 20, ...f("600") },
    /** Button text (md / lg). 16/20 semibold. */
    button: { fontSize: 16, lineHeight: 20, ...f("600") },
    /** Helper text, timestamps, meta. 12/16 regular. */
    caption: { fontSize: 12, lineHeight: 16, ...f("400") },
    /** Emphasised caption (pill text, badge text). 12/16 semibold. */
    captionStrong: { fontSize: 12, lineHeight: 16, ...f("600") },
    /** Eyebrow labels above titles. 11/14 semibold, uppercase, tracked. The only size below 12. */
    overline: { fontSize: 11, lineHeight: 14, ...f("600"), letterSpacing: 0.8, textTransform: "uppercase" },
    /** Money in rows and lists (bodyStrong with tabular figures). 15/22 semibold. */
    amount: { fontSize: 15, lineHeight: 22, ...f("600"), ...tabularNums },
    /** KPI values. 24/30 bold, tabular figures. */
    kpi: { fontSize: 24, lineHeight: 30, ...f("700"), ...tabularNums },
  } satisfies Record<string, TextStyle>;
}

export const typography = createTypography();

export type TypographyVariant = keyof typeof typography;
