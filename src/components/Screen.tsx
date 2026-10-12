import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { MAX_CONTENT_WIDTH, useResponsive } from "../utils/responsive";
import { FocusAwareStatusBar, barStyleFor } from "./ui/FocusAwareStatusBar";
import { ScreenChromeContext, type StatusBarChrome } from "./ui/screenChrome";

const ALL_EDGES: Edge[] = ["top", "left", "right", "bottom"];

type ScreenProps = PropsWithChildren<{
  /** Applied to the content area (below the top safe-area strip). */
  style?: StyleProp<ViewStyle>;
  /**
   * Safe-area edges to pad. Default all four. Leave out "bottom" only when something below the screen already
   * covers the bottom inset (the tab bar); never leave out "top" unless the screen paints under the status bar
   * on purpose.
   */
  edges?: Edge[];
  /** Page background. Default theme `background`. */
  backgroundColor?: string;
  /** Force the status-bar / top-strip colour. Default: the header's colour if an AppHeader is inside, else the page background. */
  statusBarColor?: string;
  /** Force the status-bar icon style. Default: derived from the status-bar colour. */
  statusBarStyle?: "light-content" | "dark-content";
}>;

/**
 * Root of every screen: page background, safe areas, tablet column and the status bar.
 *
 * Edge-to-edge (Android): the status and navigation bars are transparent and the app draws behind them. Screen
 * paints the strip under the status bar itself (a View of the top-inset height) and pads the other edges with the
 * safe-area insets, so nothing is drawn under the status bar, the gesture bar or a side cutout.
 *
 * Status-bar policy: the strip takes the colour of whatever sits under it — the header (AppHeader registers its
 * colour automatically) or the page background — with light or dark icons to match. The icon style only applies
 * while the screen is focused, so tabs do not fight over it.
 */
export function Screen({ children, style, edges = ALL_EDGES, backgroundColor, statusBarColor, statusBarStyle }: ScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const [chromes, setChromes] = useState<Array<[number, StatusBarChrome]>>([]);

  const setChrome = useCallback((owner: number, chrome: StatusBarChrome | null) => {
    setChromes(prev => {
      const existing = prev.find(([id]) => id === owner)?.[1];
      if (chrome && existing && existing.color === chrome.color && existing.barStyle === chrome.barStyle) return prev;
      if (!chrome && !existing) return prev;
      const without = prev.filter(([id]) => id !== owner);
      return chrome ? [...without, [owner, chrome]] : without;
    });
  }, []);

  const applyTop = edges.includes("top");
  const ctx = useMemo(() => ({ topInsetApplied: applyTop, setChrome }), [applyTop, setChrome]);

  const bg = backgroundColor ?? colors.background;
  const header = chromes.length ? chromes[chromes.length - 1][1] : null;
  const topColor = statusBarColor ?? header?.color ?? bg;
  const barStyle =
    statusBarStyle ??
    (statusBarColor ? barStyleFor(statusBarColor) : header?.barStyle) ??
    (backgroundColor ? barStyleFor(backgroundColor) : isDark ? "light-content" : "dark-content");
  const innerEdges = useMemo(() => edges.filter(e => e !== "top"), [edges]);

  return (
    <ScreenChromeContext.Provider value={ctx}>
      <View style={[styles.root, { backgroundColor: bg }]}>
        <FocusAwareStatusBar barStyle={barStyle} />
        {applyTop && insets.top > 0 ? <View style={{ height: insets.top, backgroundColor: topColor }} /> : null}
        <SafeAreaView edges={innerEdges} style={[styles.root, { backgroundColor: bg }, style]}>
          {isTablet ? <View style={styles.column}>{children}</View> : children}
        </SafeAreaView>
      </View>
    </ScreenChromeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Tablets / unfolded phones: a centred column instead of content stretched edge to edge.
  column: { flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" },
});
