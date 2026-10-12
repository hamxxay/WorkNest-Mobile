/**
 * WorkNest design tokens + theme hooks.
 *
 *   import { useThemeColors, useThemedStyles, useTheme, useThemeMode, radii, spacing, typography } from "../theme";
 *
 * Light and dark palettes share the same keys (see ./colors.ts). `useThemeColors()` / `useThemedStyles()` return the
 * ACTIVE palette and re-render when the user switches mode.
 *
 * NOTE: the static `colors` export below is the LIGHT palette and never changes. A screen that styles itself with
 * the static `colors` object (instead of the hooks) stays light in dark mode. Migrate such screens to the hooks.
 */
import { lightColors } from "./colors";
import * as palette from "./palette";

export { lightColors, darkColors, lightTones, darkTones } from "./colors";
export type { AppColors, Tone, ToneColors } from "./colors";
export {
  typography,
  fontWeights,
  fontFamilies,
  fontFor,
  withBrandFont,
  tabularNums,
  normalizeFontWeight,
  hasBrandFont,
} from "./typography";
export type { TypographyVariant, FontWeight, FontStyle } from "./typography";
export { spacing, radii, shadows, getShadows, touchTarget, iconSizes } from "./tokens";
export type { ShadowScale } from "./tokens";
export { statusTone, statusLabel, normalizeStatus } from "./status";
export {
  ThemeProvider,
  useTheme,
  useThemeMode,
  useThemeColors,
  useThemedStyles,
  useTones,
  useNavigationTheme,
  getThemeColors,
  THEME_MODE_STORAGE_KEY,
} from "./ThemeProvider";
export type { Theme, ThemeMode, ColorScheme } from "./ThemeProvider";
/** Raw colour ramps (teal, slate, emerald, amber, red, sky, indigo, night). Prefer semantic colours. */
export { palette };

/** Static LIGHT palette (legacy). Does not follow dark mode — use `useThemeColors()` in components. */
export const colors = lightColors;
