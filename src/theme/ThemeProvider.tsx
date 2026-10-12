import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Theme as NavigationTheme } from "@react-navigation/native";
import { darkColors, darkTones, lightColors, lightTones, type AppColors, type Tone, type ToneColors } from "./colors";
import { fontFamilies, hasBrandFont, typography } from "./typography";
import { getShadows, iconSizes, radii, spacing, touchTarget, type ShadowScale } from "./tokens";

export type ThemeMode = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

export type Theme = {
  /** The user's choice: follow the phone, or force light / dark. */
  mode: ThemeMode;
  /** What is actually showing. */
  scheme: ColorScheme;
  isDark: boolean;
  colors: AppColors;
  tones: Record<Tone, ToneColors>;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: ShadowScale;
  iconSizes: typeof iconSizes;
  touchTarget: number;
};

type ThemeContextValue = Theme & {
  setMode: (mode: ThemeMode) => void;
  /** false until the saved preference has been read from storage. */
  hydrated: boolean;
};

export const THEME_MODE_STORAGE_KEY = "@worknest/theme-mode";

function buildTheme(mode: ThemeMode, scheme: ColorScheme): Theme {
  const isDark = scheme === "dark";
  return {
    mode,
    scheme,
    isDark,
    colors: isDark ? darkColors : lightColors,
    tones: isDark ? darkTones : lightTones,
    typography,
    spacing,
    radii,
    shadows: getShadows(isDark),
    iconSizes,
    touchTarget,
  };
}

const LIGHT_THEME = buildTheme("system", "light");

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Tells Android which night mode to use (AppCompatDelegate), so native UI the app does not draw itself
 * — the date/time picker dialogs, Alert dialogs, the Picker dropdown — matches the chosen mode.
 * With "system" the override is cleared and the phone setting applies again.
 */
function applyNativeScheme(mode: ThemeMode) {
  try {
    if (typeof Appearance?.setColorScheme === "function") {
      Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
    }
  } catch {
    // Older runtimes / tests without the native module: the JS palette still switches.
  }
}

type ThemeProviderProps = {
  children: ReactNode;
  /** Mode to use before the saved preference loads (tests / previews). Defaults to "system". */
  initialMode?: ThemeMode;
  /** Set false in tests or previews to skip reading/writing AsyncStorage. */
  persist?: boolean;
};

export function ThemeProvider({ children, initialMode = "system", persist = true }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [hydrated, setHydrated] = useState(!persist);
  // When an override is active, useColorScheme() reports the override; with "system" it reports the phone.
  const deviceScheme = useColorScheme();

  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then(saved => {
        if (!cancelled && isThemeMode(saved)) setModeState(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [persist]);

  // Only touch the native night mode once the user has forced light/dark (and again to undo it), so a
  // "system" user never triggers a configuration change.
  const nativeOverridden = useRef(false);
  useEffect(() => {
    if (mode === "system" && !nativeOverridden.current) return;
    nativeOverridden.current = mode !== "system";
    applyNativeScheme(mode);
  }, [mode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      if (persist) AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, next).catch(() => {});
    },
    [persist],
  );

  const scheme: ColorScheme = mode === "system" ? (deviceScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(mode, scheme), setMode, hydrated }),
    [mode, scheme, setMode, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The full active theme: colors, tones, typography, spacing, radii, mode-aware shadows. */
export function useTheme(): Theme {
  return useContext(ThemeContext) ?? LIGHT_THEME;
}

/** The user's appearance preference. `setMode` persists it. */
export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void; isDark: boolean; scheme: ColorScheme } {
  const ctx = useContext(ThemeContext);
  return {
    mode: ctx?.mode ?? "system",
    setMode: ctx?.setMode ?? noopSetMode,
    isDark: ctx?.isDark ?? false,
    scheme: ctx?.scheme ?? "light",
  };
}

function noopSetMode() {
  if (__DEV__) console.warn("useThemeMode().setMode called outside <ThemeProvider>");
}

/** The ACTIVE palette (light or dark). Components re-render when the mode changes. */
export function useThemeColors(): AppColors {
  return useTheme().colors;
}

/**
 * Builds styles from the active palette and memoises them per palette.
 * Pass a module-level factory (`const createStyles = (c: AppColors, t: Theme) => StyleSheet.create({...})`)
 * so the memo hits; an inline arrow recomputes every render (it still works).
 */
export function useThemedStyles<T>(factory: (colors: AppColors, theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme.colors, theme), [factory, theme]);
}

/** Tone colours (fg / bg / border / solid) for the active mode. */
export function useTones(): Record<Tone, ToneColors> {
  return useTheme().tones;
}

// Inter where the app bundles it (tab labels, badges, native headers); elsewhere the font set React Navigation's
// DefaultTheme uses. Built here (instead of importing DefaultTheme) so the theme module has no runtime dependency on
// @react-navigation (keeps unit tests of plain components simple).
const NAV_FONTS: NavigationTheme["fonts"] = hasBrandFont()
  ? {
      regular: { fontFamily: fontFamilies.regular, fontWeight: "400" },
      medium: { fontFamily: fontFamilies.medium, fontWeight: "500" },
      bold: { fontFamily: fontFamilies.semibold, fontWeight: "600" },
      heavy: { fontFamily: fontFamilies.bold, fontWeight: "700" },
    }
  : Platform.OS === "ios"
    ? {
        regular: { fontFamily: "System", fontWeight: "400" },
        medium: { fontFamily: "System", fontWeight: "500" },
        bold: { fontFamily: "System", fontWeight: "600" },
        heavy: { fontFamily: "System", fontWeight: "700" },
      }
    : {
        regular: { fontFamily: "sans-serif", fontWeight: "normal" },
        medium: { fontFamily: "sans-serif-medium", fontWeight: "normal" },
        bold: { fontFamily: "sans-serif", fontWeight: "600" },
        heavy: { fontFamily: "sans-serif", fontWeight: "700" },
      };

/** A React Navigation theme matching the active palette. Pass it to every <NavigationContainer theme={...}>. */
export function useNavigationTheme(): NavigationTheme {
  const { isDark, colors } = useTheme();
  return useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.dangerStrong,
      },
      fonts: NAV_FONTS,
    }),
    [isDark, colors],
  );
}

/**
 * Palette for a colour scheme. Kept for compatibility: previously always returned the light palette.
 * Prefer `useThemeColors()` inside components.
 */
export function getThemeColors(colorScheme?: string | null): AppColors {
  return colorScheme === "dark" ? darkColors : lightColors;
}
