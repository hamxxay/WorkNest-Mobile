import { createContext, useContext, useEffect, useRef } from "react";

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
