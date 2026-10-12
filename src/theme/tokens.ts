import type { ViewStyle } from "react-native";

/** Spacing scale (dp). Legacy keys xs..xxl keep their values. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  /** Horizontal padding of a screen's content. */
  screen: 16,
} as const;

/** Corner radii. Legacy keys sm..pill keep their values; new code should prefer the semantic ones. */
export const radii = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
  /** Buttons, inputs, selects. */
  control: 10,
  /** Cards, list groups. */
  card: 14,
  /** Bottom sheet top corners, dialogs. */
  sheet: 20,
} as const;

/** Minimum touch target (dp). Every pressable in the kit is at least this tall/wide. */
export const touchTarget = 44;

/** Standard icon sizes. */
export const iconSizes = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

type Shadow = Pick<ViewStyle, "shadowColor" | "shadowOpacity" | "shadowRadius" | "shadowOffset" | "elevation">;
export type ShadowScale = { none: Shadow; sm: Shadow; md: Shadow; lg: Shadow };

const none: Shadow = {
  shadowColor: "transparent",
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

/**
 * Light-mode shadows. This is the legacy static export (`...shadows.md`), so it never changes with the mode.
 * Theme-aware code should use `useTheme().shadows` or `getShadows(isDark)`.
 */
export const shadows = {
  sm: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

/**
 * Dark mode: shadows are nearly invisible on a dark page, so elevation is mostly carried by lighter surfaces
 * (surface / surfaceRaised) and borders. We keep a small elevation so Android still layers correctly.
 */
const darkShadows: ShadowScale = {
  none,
  sm: { shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  lg: { shadowColor: "#000000", shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

const lightShadows: ShadowScale = { none, ...shadows };

export function getShadows(isDark: boolean): ShadowScale {
  return isDark ? darkShadows : lightShadows;
}
