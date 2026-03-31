import { useMemo } from "react";
import { useColorScheme } from "react-native";

const lightColors = {
  background: "#F5F8FF",
  foreground: "#1F2A44",
  primary: "#4A7DFF",
  secondary: "#365CC0",
  muted: "#EEF3FF",
  mutedForeground: "#66748A",
  border: "#DFE7F8",
  accent: "#FFA726",
  danger: "#dc2626",
};

const darkColors = {
  background: "#0F172A",
  foreground: "#F8FAFC",
  primary: "#6E96FF",
  secondary: "#93B0FF",
  muted: "#1E293B",
  mutedForeground: "#94A3B8",
  border: "#334155",
  accent: "#FFB74D",
  danger: "#F87171",
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
};
