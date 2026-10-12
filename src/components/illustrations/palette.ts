import type { AppColors } from "../../theme/colors";

/**
 * The eight colours every illustration is drawn with. All come from the active theme, so the drawings follow
 * light / dark mode and any change to the brand tokens.
 */
export type IllustrationPalette = {
  /** Soft teal disc behind every drawing (primarySoft). */
  backdrop: string;
  /** Body of the main object: paper, card, door frame (surfaceRaised). */
  surface: string;
  /** Outlines and small solid details: navy in light mode, light slate in dark mode. */
  ink: string;
  /** Brand teal fills: headers, highlights, badges (brand). */
  accent: string;
  /** Soft teal tint inside objects (primarySoft). */
  accentSoft: string;
  /** Marks drawn on an accent fill (white in both modes). */
  onAccent: string;
  /** Placeholder bars, text lines and ghost content (borderStrong). */
  muted: string;
  /** The error mark on cloud-off (danger). */
  alert: string;
};

/** Builds the illustration palette from the active theme colours. */
export function illustrationPalette(colors: AppColors, isDark: boolean): IllustrationPalette {
  return {
    backdrop: colors.primarySoft,
    surface: colors.surfaceRaised,
    // Light: navy text colour. Dark: slate-300, softer than the near-white body text.
    ink: isDark ? colors.textSecondary : colors.text,
    accent: colors.brand,
    accentSoft: colors.primarySoft,
    onAccent: colors.white,
    muted: colors.borderStrong,
    alert: colors.danger,
  };
}
