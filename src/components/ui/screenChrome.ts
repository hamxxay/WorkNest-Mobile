import { createContext, useContext, useEffect, useRef } from "react";
import { useWindowDimensions } from "react-native";

export type StatusBarChrome = {
  /** Colour painted behind the status bar (and of the top safe-area strip). */
  color: string;
  barStyle: "light-content" | "dark-content";
};

export type ScreenChromeContextValue = {
  /** True when <Screen> already pads / paints the top safe-area inset (headers must not add it again). */
  topInsetApplied: boolean;
  /** A header registers its colour so the status bar and top strip match it. Pass null to unregister. */
  setChrome: (owner: number, chrome: StatusBarChrome | null) => void;
  /** Width of the screen's content column (the window, capped at the screen's max width on tablets). */
  columnWidth: number;
  /**
   * Distance from the column's left / right edge to the window edge (side margins on tablets and unfolded
   * foldables, plus side safe-area insets in landscape). Full-width chrome such as the header bar paints its
   * background this far past the column so it still spans the whole window. 0 on phones in portrait.
   */
  bleedLeft: number;
  bleedRight: number;
};

/** Provided by <Screen>. Headers read it to avoid a double top inset and to colour the status bar. */
export const ScreenChromeContext = createContext<ScreenChromeContextValue | null>(null);

let nextOwner = 1;

/**
 * Registers the header colour with the enclosing <Screen> (no-op outside one).
 * Returns the context so callers know whether the top inset is already handled.
 */
export function useScreenChrome(chrome: StatusBarChrome | null): ScreenChromeContextValue | null {
  const ctx = useContext(ScreenChromeContext);
  const owner = useRef(0);
  if (owner.current === 0) owner.current = nextOwner++;
  const color = chrome?.color;
  const barStyle = chrome?.barStyle;

  useEffect(() => {
    if (!ctx) return undefined;
    const id = owner.current;
    ctx.setChrome(id, color && barStyle ? { color, barStyle } : null);
    return () => ctx.setChrome(id, null);
  }, [ctx, color, barStyle]);

  return ctx;
}

/**
 * Width of the enclosing <Screen>'s content column (the window width outside a Screen). A good first guess for
 * layouts that measure themselves (grids) before their first onLayout.
 */
export function useScreenColumnWidth(): number {
  const ctx = useContext(ScreenChromeContext);
  const { width } = useWindowDimensions();
  return ctx?.columnWidth || width;
}
