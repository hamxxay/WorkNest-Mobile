import { StyleSheet } from "react-native";
import { palette, type AppColors, type Theme } from "../../../theme";

/** Branded splash: navy (headerBg) in both modes, teal logo tile, white wordmark. */
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
    logoTile: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: colors.primaryStrong,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.14)",
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadows.lg,
      shadowColor: "#000000",
    },
    logo: { width: 52, height: 52, tintColor: colors.onHeader },
    copyBlock: { alignItems: "center", marginTop: 22, gap: 6 },
    wordmark: { ...theme.typography.display, color: colors.onHeader },
    tagline: { ...theme.typography.body, color: colors.onHeaderMuted },
    loaderWrap: { position: "absolute", bottom: 72, width: 72 },
    loaderTrack: { height: 3, width: "100%", overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.16)" },
    loaderFill: { height: "100%", width: "100%", borderRadius: 999, backgroundColor: palette.teal[400], transformOrigin: "left" },
  });

export type SplashStyles = ReturnType<typeof createSplashStyles>;
