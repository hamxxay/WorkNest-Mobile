import type { TextStyle } from "react-native";

/**
 * Type scale (system font: Roboto on Android). Weights 400-700 only; 800/900 are retired.
 * Every size is >= 12 except `overline` (11, uppercase, tracked).
 */
export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const typography = {
  /** Hero numbers and page heroes. 28/34 bold. */
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  /** Screen titles. 22/28 bold. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2 },
  /** Card titles, sheet titles, header titles. 18/24 semibold. */
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600" },
  /** Section titles, list row titles that need emphasis. 16/22 semibold. */
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  /** Default reading text. 15/22 regular. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  /** Emphasised body text, list row titles, values. 15/22 semibold. */
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  /** Dense secondary text (subtitles, table cells). 14/20 regular. */
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  /** Form labels, chip and small-button text. 14/20 semibold. */
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  /** Button text (md / lg). 16/20 semibold. */
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600" },
  /** Helper text, timestamps, meta. 12/16 regular. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  /** Emphasised caption (pill text, badge text). 12/16 semibold. */
  captionStrong: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  /** Eyebrow labels above titles. 11/14 semibold, uppercase, tracked. The only size below 12. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  /** KPI values. 24/30 bold, tabular figures. */
  kpi: { fontSize: 24, lineHeight: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
