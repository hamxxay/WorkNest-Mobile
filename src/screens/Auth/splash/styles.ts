import { StyleSheet } from "react-native";
import { palette, type AppColors, type Theme } from "../../../theme";

/**
 * Width of the silver W on the splash: the same size as the Android 12+ system splash icon
 * (scripts/make-app-icons.py, SPLASH_W_RADIUS_DP), so the hand-over from the system splash does not jump.
 */
export const SPLASH_LOGO_WIDTH = 108;

/** Branded splash: navy (headerBg) in both modes, the silver W, white wordmark. */
export const createSplashStyles = (colors: AppColors, theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.headerBg },
    glowTop: {
      position: "absolute",
      width: 520,
      height: 520,
      borderRadius: 260,
      top: -300,
      right: -160,
      backgroundColor: palette.teal[600],
      opacity: 0.16,
    },
    glowBottom: {
      position: "absolute",
      width: 380,
      height: 380,
      borderRadius: 190,
      bottom: -220,
      left: -140,
      backgroundColor: palette.teal[400],
      opacity: 0.08,
    },
    brandBlock: { alignItems: "center" },
    copyBlock: { alignItems: "center", marginTop: 28, gap: 6 },
    wordmark: { ...theme.typography.display, color: colors.onHeader },
    tagline: { ...theme.typography.body, color: colors.onHeaderMuted },
    loaderWrap: { position: "absolute", bottom: 72, width: 72 },
    loaderTrack: { height: 3, width: "100%", overflow: "hidden", borderRadius: 999, backgroundColor: colors.headerLine },
    loaderFill: { height: "100%", width: "100%", borderRadius: 999, backgroundColor: palette.teal[400], transformOrigin: "left" },
  });

export type SplashStyles = ReturnType<typeof createSplashStyles>;
