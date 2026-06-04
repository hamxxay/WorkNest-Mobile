import { useMemo } from "react";
import { useColorScheme } from "react-native";

const lightColors = {
  // Surfaces
  background: "#F0F4FF",
  card: "#FFFFFF",
  // Text
  foreground: "#0A1628",
  mutedForeground: "#4E637F",
  // Brand
  primary: "#4F46E5",
  secondary: "#7C3AED",
  primaryMuted: "#EDE9FE",
  // Neutrals
  muted: "#EEF2FF",
  border: "#DDE3F5",
  // Accents
  accent: "#F97316",
  accentMuted: "#FFF0E6",
  // Status
  success: "#059669",
  successMuted: "#D1FAE5",
  danger: "#DC2626",
  dangerMuted: "#FEE2E2",
  // Utility
  overlay: "rgba(10, 22, 40, 0.55)",
  shadow: "#1E1B4B",
  white: "#FFFFFF",
};

const darkColors: typeof lightColors = {
  background: "#060B18",
  card: "#0F1829",
  foreground: "#EEF2FF",
  mutedForeground: "#7A8BAA",
  primary: "#818CF8",
  secondary: "#A78BFA",
  primaryMuted: "#1E1B4B",
  muted: "#111827",
  border: "#1E2D45",
  accent: "#FB923C",
  accentMuted: "#431407",
  success: "#34D399",
  successMuted: "#064E3B",
  danger: "#F87171",
  dangerMuted: "#450A0A",
  overlay: "rgba(0, 0, 0, 0.7)",
  shadow: "#000000",
  white: "#FFFFFF",
};

export type AppColors = typeof lightColors;

export const colors = lightColors;

export function getThemeColors(colorScheme?: string | null): AppColors {
  return colorScheme === "dark" ? darkColors : lightColors;
}

export function useThemeColors(): AppColors {
  const colorScheme = useColorScheme();
  return useMemo(() => getThemeColors(colorScheme), [colorScheme]);
}

export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  const themeColors = useThemeColors();
  return useMemo(() => factory(themeColors), [factory, themeColors]);
}

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * Consistent elevation presets. Spread into a style to give a surface depth
 * that reads the same across the app instead of ad-hoc shadow values.
 */
export const shadows = {
  sm: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  md: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
} as const;
