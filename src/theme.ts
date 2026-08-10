import { useMemo } from "react";

export const colors = {
  // Surfaces
  background: "#ffffff",
  card: "#ffffff",
  // Text
  foreground: "#0A1628",
  mutedForeground: "#4E637F",
  // Brand
  primary: "#0d9488",
  secondary: "#0f766e",
  primaryMuted: "rgba(13, 148, 136, 0.05)",
  // Neutrals
  muted: "#F0FAF9",
  border: "#d1faf4",
  // Accents
  accent: "#115e59",
  accentMuted: "rgba(13, 148, 136, 0.08)",
  // Status
  success: "#059669",
  successMuted: "#D1FAE5",
  danger: "#DC2626",
  dangerMuted: "#FEE2E2",
  // Utility
  overlay: "rgba(10, 22, 40, 0.55)",
  shadow: "#c8d8d6",
  white: "#FFFFFF",
};

export type AppColors = typeof colors;

export function getThemeColors(_colorScheme?: string | null): AppColors {
  return colors;
}

export function useThemeColors(): AppColors {
  return useMemo(() => colors, []);
}

export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  return useMemo(() => factory(colors), [factory]);
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

export const shadows = {
  sm: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#0D1526",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
} as const;
