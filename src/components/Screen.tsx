import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { maxWidthFor, type ContentWidthMode } from "../utils/responsive";
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
  /**
   * How wide the content column may get on tablets and unfolded foldables: "content" (default, 720dp: forms,
   * lists, details), "wide" (1120dp: dashboards with more grid columns) or "full" (edge to edge).
   */
  width?: ContentWidthMode;
}>;

/**
 * Root of every screen: page background, safe areas, tablet column and the status bar.
 *
 * Wide windows (tablets, an unfolded foldable, phones in landscape): the content sits in a centred column at most
 * 720dp wide (`width="wide"`: 1120dp for dashboards), so lines and cards don't stretch edge to edge. The header
 * bar still spans the whole window (AppHeader paints past the column, see ScreenChromeContext bleed*).
 *
 * Edge-to-edge (Android): the status and navigation bars are transparent and the app draws behind them. Screen
 * paints the strip under the status bar itself (a View of the top-inset height) and pads the other edges with the
 * safe-area insets, so nothing is drawn under the status bar, the gesture bar or a side cutout.
 *
 * Status-bar policy: the strip takes the colour of whatever sits under it — the header (AppHeader registers its
 * colour automatically) or the page background — with light or dark icons to match. The icon style only applies
 * while the screen is focused, so tabs do not fight over it.
 */
export function Screen({
  children,
  style,
  edges = ALL_EDGES,
  backgroundColor,
  statusBarColor,
  statusBarStyle,
  width = "content",
}: ScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
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
  // The content column: the window minus the padded side insets, capped at the max width and centred. Read from
  // the live window size, so it follows rotation and a foldable switching screens without a remount.
  const padLeft = edges.includes("left") ? insets.left : 0;
  const padRight = edges.includes("right") ? insets.right : 0;
  const inner = Math.max(0, windowWidth - padLeft - padRight);
  const maxWidth = maxWidthFor(width);
  const columnWidth = Math.min(inner, maxWidth);
  const side = Math.max(0, (inner - columnWidth) / 2);
  const bleedLeft = Math.round(side + padLeft);
  const bleedRight = Math.round(side + padRight);
  const ctx = useMemo(
    () => ({ topInsetApplied: applyTop, setChrome, columnWidth, bleedLeft, bleedRight }),
    [applyTop, setChrome, columnWidth, bleedLeft, bleedRight],
  );

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
          {/* Always the same wrapper (only its max width changes), so a size change never remounts the screen's
              content: text typed into a form and scroll positions survive unfolding a foldable. */}
          <View style={[styles.column, Number.isFinite(maxWidth) && { maxWidth }]}>{children}</View>
        </SafeAreaView>
      </View>
    </ScreenChromeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Tablets / unfolded phones: a centred column instead of content stretched edge to edge (no-op on phones).
  column: { flex: 1, width: "100%", alignSelf: "center" },
});
