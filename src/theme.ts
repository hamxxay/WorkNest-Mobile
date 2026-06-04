import { useMemo } from "react";
import { useColorScheme } from "react-native";

const lightColors = {
  // Surfaces
  background: "#EFF3FA", // page background — soft cool tint so white cards lift off it
  card: "#FFFFFF", // elevated surfaces (cards, sheets, inputs)
  // Text
  foreground: "#101828",
  mutedForeground: "#5A6B85",
  // Brand
  primary: "#2F54EB",
  secondary: "#1D39C4",
  primaryMuted: "#E7ECFE", // tinted brand fill for chips / icon wells
  // Neutrals
  muted: "#EEF2FB",
  border: "#E4E9F2",
  // Accents
  accent: "#F5A524",
  accentMuted: "#FFF3DC",
  // Status
  success: "#1FA971",
  successMuted: "#E6F6EF",
  danger: "#E5484D",
  dangerMuted: "#FCEBEC",
  // Utility
  overlay: "rgba(16, 24, 40, 0.55)",
  shadow: "#0B1B3A",
  white: "#FFFFFF",
};

const darkColors: typeof lightColors = {
  background: "#0B1220",
  card: "#151E32",
  foreground: "#F8FAFC",
  mutedForeground: "#9AA8C2",
  primary: "#5B7BFF",
  secondary: "#93B0FF",
  primaryMuted: "#1C2747",
  muted: "#1C2740",
  border: "#27324A",
  accent: "#FFB74D",
  accentMuted: "#3A2E15",
  success: "#34D399",
  successMuted: "#123026",
  danger: "#F87171",
  dangerMuted: "#3A1D1F",
  overlay: "rgba(0, 0, 0, 0.6)",
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
    shadowColor: "#0B1B3A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: "#0B1B3A",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  lg: {
    shadowColor: "#0B1B3A",
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
} as const;
