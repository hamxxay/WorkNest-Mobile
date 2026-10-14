/**
 * Raw colour ramps (Tailwind-compatible values, the same ones the staff web CMS uses).
 * Screens should NOT import these directly; use the semantic colours from `useThemeColors()`.
 */
export const teal = {
  50: "#f0fdfa",
  100: "#ccfbf1",
  200: "#99f6e4",
  300: "#5eead4",
  400: "#2dd4bf",
  500: "#14b8a6",
  600: "#0d9488", // web --accent (brand teal)
  700: "#0f766e", // web --accent-hover (accessible teal on white, 5.5:1)
  800: "#115e59", // web --accent-dark
  900: "#134e4a",
  950: "#042f2e",
} as const;

export const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a", // navy: CMS sidebar / dark headers
  950: "#020617",
} as const;

export const emerald = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
} as const;

export const amber = {
  50: "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
} as const;

export const red = {
  50: "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
} as const;

export const sky = {
  50: "#f0f9ff",
  100: "#e0f2fe",
  200: "#bae6fd",
  300: "#7dd3fc",
  400: "#38bdf8",
  500: "#0ea5e9",
  600: "#0284c7",
  700: "#0369a1",
} as const;

export const indigo = {
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  700: "#4338ca",
} as const;

/** Blue, orange and violet: inquiry Type colours (Website, Walk-In, Reference), as the CMS uses them. */
export const blue = {
  300: "#93c5fd",
  400: "#60a5fa",
  700: "#1d4ed8",
} as const;

export const orange = {
  300: "#fdba74",
  400: "#fb923c",
  700: "#c2410c",
} as const;

export const violet = {
  300: "#c4b5fd",
  400: "#a78bfa",
  700: "#6d28d9",
} as const;

/** Dark-mode surfaces (navy family, a step below slate-900 so cards can sit above the page). */
export const night = {
  background: "#0b1220",
  surface: "#131c2e",
  surfaceAlt: "#1b263b",
  raised: "#18233a",
  border: "#253149",
  header: "#0f1a2e",
} as const;
