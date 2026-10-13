import { useMemo } from "react";
import { useThemeColors } from "../../../../theme";

/**
 * Theme colours for a pull-to-refresh spinner, the same as AsyncList's: the spinner in the brand colour on a
 * surface-coloured disc (Android draws a white disc by default, which glares in dark mode).
 * Use as <RefreshControl refreshing={...} onRefresh={...} {...refreshColors} />.
 */
export function useRefreshColors() {
  const colors = useThemeColors();
  return useMemo(
    () => ({ colors: [colors.primary], tintColor: colors.primary, progressBackgroundColor: colors.surfaceRaised }),
    [colors.primary, colors.surfaceRaised],
  );
}
