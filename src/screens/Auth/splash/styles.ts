import { StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme";

export const createSplashStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  background: { ...StyleSheet.absoluteFill },
  bgCircle1: { position: "absolute", width: 520, height: 520, borderRadius: 260, backgroundColor: colors.primaryMuted, top: -260, left: -80 },
  bgCircle2: { position: "absolute", width: 360, height: 360, borderRadius: 180, backgroundColor: colors.primary, bottom: -185, right: -95, opacity: 0.08 },
  brandBlock: { alignItems: "center" },
  logoWell: { width: 108, height: 108, borderRadius: 34, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.42, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  logoGlow: { position: "absolute", width: "100%", height: "100%", borderRadius: 34, backgroundColor: colors.secondary, opacity: 0.34 },
  logo: { width: 64, height: 64 },
  copyBlock: { alignItems: "center", marginTop: 20 },
  brand: { color: colors.foreground, fontSize: 30, fontWeight: "800", letterSpacing: 2.2 },
  subtitle: { color: colors.mutedForeground, fontSize: 14, fontWeight: "600", marginTop: 9, letterSpacing: 0.15 },
  loaderWrap: { position: "absolute", bottom: 66, width: 74 },
  loaderTrack: { height: 3, width: "100%", overflow: "hidden", borderRadius: 999, backgroundColor: colors.border },
  loaderFill: { height: "100%", width: "100%", borderRadius: 999, backgroundColor: colors.primary, transformOrigin: "left" },
});

export type SplashStyles = ReturnType<typeof createSplashStyles>;
