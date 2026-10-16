import { useCallback, useState } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";

// Screen-size and text-size rules shared by the whole app. Everything here reads the CURRENT window
// (useWindowDimensions), never a value captured at import time: the window changes on rotation, split screen and
// when a foldable (Galaxy Z Fold cover <-> inner screen) switches displays while the app is open.
// Pure helpers (columnsFor, stackActions...) are separate from the hooks so they can be unit tested.

/** Breakpoints for phones, large phones, tablets / unfolded foldables and wide tablets (in dp). */
export const BREAKPOINTS = { small: 360, tablet: 700, wide: 1000 } as const;
/** Widest the main content column gets on tablets / unfolded foldables (forms, lists, detail screens). */
export const MAX_CONTENT_WIDTH = 720;
/** Widest a dashboard column gets (more KPI / chart columns instead of stretched cards). */
export const MAX_WIDE_CONTENT_WIDTH = 1120;

/**
 * How wide a screen's content column may get:
 * - "content" (default): MAX_CONTENT_WIDTH, centred (forms, lists, details).
 * - "wide": MAX_WIDE_CONTENT_WIDTH, centred (dashboards with grids).
 * - "full": the whole window (full-bleed media such as a photo gallery).
 */
export type ContentWidthMode = "content" | "wide" | "full";

export function maxWidthFor(mode: ContentWidthMode = "content"): number {
  if (mode === "full") return Number.POSITIVE_INFINITY;
  return mode === "wide" ? MAX_WIDE_CONTENT_WIDTH : MAX_CONTENT_WIDTH;
}

/** The system font scale clamped to the range the layouts are built for (1 = default, 2 = largest). */
export function textScale(fontScale: number | null | undefined): number {
  const f = Number(fontScale);
  if (!Number.isFinite(f) || f <= 1) return 1;
  return Math.min(f, 2);
}

/**
 * The smallest width an item needs at this font scale. Only part of an item is text (icons, padding and gaps don't
 * grow), so the width grows by `weight` of the extra text size: weight 0.5 at fontScale 2 = 1.5x as wide.
 */
export function scaledMinWidth(minWidth: number, fontScale: number, weight = 0.5): number {
  return minWidth * (1 + (textScale(fontScale) - 1) * weight);
}

export type ColumnsOptions = {
  /** Narrowest an item may get at font scale 1 (dp). */
  minItemWidth: number;
  /** Gap between columns (dp). Default 12. */
  gap?: number;
  /** Most columns. Default 4. */
  maxColumns?: number;
  /** System font scale: larger text needs wider items. Default 1. */
  fontScale?: number;
  /** How much of the item grows with the text (see scaledMinWidth). Default 0.5. */
  fontWeight?: number;
  /**
   * Number of items. When given, the column count avoids a nearly empty last row (4 tiles: 4, 2 or 1 columns,
   * never 3 + 1) and never exceeds the number of items.
   */
  count?: number;
};

/** How many columns of at least `minItemWidth` fit in `width` (always >= 1). */
export function columnsFor(width: number, options: ColumnsOptions): number {
  const { minItemWidth, gap = 12, maxColumns = 4, fontScale = 1, fontWeight = 0.5, count } = options;
  const min = Math.max(1, scaledMinWidth(minItemWidth, fontScale, fontWeight));
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  let fit = Math.max(1, Math.min(maxColumns, Math.floor((w + gap) / (min + gap))));
  if (count == null) return fit;
  if (count <= 1) return 1;
  fit = Math.min(fit, count);
  // Full rows when one column less gives them (6 tiles: 3 + 3, not 4 + 2).
  for (let c = fit; c >= Math.max(2, fit - 1); c--) if (count % c === 0) return c;
  for (let c = fit; c > 1; c--) {
    const last = count % c;
    // A full last row, or one at least half full.
    if (last === 0 || last >= c / 2) return c;
  }
  return 1;
}

/** Width of one item when `columns` items and their gaps share `width` (rounded down so a row never wraps). */
export function itemWidthFor(width: number, columns: number, gap = 12): number {
  const c = Math.max(1, Math.floor(columns));
  return Math.max(0, Math.floor((width - gap * (c - 1)) / c));
}

/** Narrowest a KPI / stat tile gets at the default font size (dp): StatCard grids and their skeletons. */
export const STAT_CARD_MIN_WIDTH = 148;

/** Narrowest a button in a row of buttons may get before the row is stacked (font scale 1, dp). */
export const MIN_ACTION_WIDTH = 120;
/** Buttons cap their text at this font scale (Button maxFontSizeMultiplier), so wider is never needed. */
const ACTION_TEXT_CAP = 1.4;
/** Average width of one character of button text (Inter SemiBold 16, mixed case with spaces) as a share of the font size. */
const BUTTON_CHAR_EM = 0.55;

/** A button in a row of actions: its label (and whether an icon sits before it). */
export type ActionLabel = string | { title: string; icon?: boolean };

/** Rough width a md / lg Button needs to show `title` in full at this font scale (dp). */
export function estimateButtonWidth(title: string, fontScale = 1, icon = false): number {
  const scale = Math.min(textScale(fontScale), ACTION_TEXT_CAP);
  const text = title.length * BUTTON_CHAR_EM * 16 * scale;
  return Math.ceil(text + 2 * 18 + (icon ? 18 + 8 : 0));
}

/**
 * True when buttons side by side in `available` dp would be too narrow: stack them full width instead (small
 * phones, the Fold cover screen, large text). `actions` is the number of buttons, or their labels for a better
 * guess ("Delete account" needs more room than "OK").
 */
export function stackActions(available: number, fontScale = 1, actions: number | readonly ActionLabel[] = 2, gap = 12): boolean {
  const count = typeof actions === "number" ? actions : actions.length;
  if (count <= 1) return false;
  const each = (available - gap * (count - 1)) / count;
  // Labels unknown: a fixed minimum per button. Known: what each label needs (never below a comfortable 88dp).
  if (typeof actions === "number") return each < MIN_ACTION_WIDTH * Math.min(textScale(fontScale), ACTION_TEXT_CAP);
  if (each < 88) return true;
  return actions.some(a => {
    const label = typeof a === "string" ? { title: a, icon: false } : a;
    return estimateButtonWidth(label.title, fontScale, !!label.icon) > each;
  });
}

/**
 * True when a label / value row should put the value under the label: the window, measured in "text widths"
 * (width / font scale), is too narrow for both side by side with large text.
 */
export function stackLabelValue(width: number, fontScale = 1): boolean {
  const f = textScale(fontScale);
  return f >= 1.3 && width / f < 320;
}

/**
 * Current window size and layout hints. Uses useWindowDimensions, so it updates on rotation, split screen and
 * foldables (a module-level Dimensions.get() is read once and goes stale).
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const isSmall = width < BREAKPOINTS.small;
  const isTablet = width >= BREAKPOINTS.tablet;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const scaleText = textScale(fontScale);
  return {
    width,
    height,
    fontScale,
    /** fontScale clamped to 1..2 (see textScale). */
    textScale: scaleText,
    /** The user picked a large system font (130% or more). */
    isLargeText: scaleText >= 1.3,
    isSmall,
    isTablet,
    isWide: width >= BREAKPOINTS.wide,
    isLandscape: width > height,
    /** Width available to the content column (capped on tablets). */
    contentWidth,
    /** Columns for card grids: 1 on small phones, 2 on phones, 3 on tablets. */
    gridColumns: isTablet ? 3 : isSmall ? 1 : 2,
    /** A size that grows a little on bigger screens: scale(16) ≈ 16 on a 390-wide phone. */
    scale: (size: number) => Math.round(size * Math.min(Math.max(contentWidth / 390, 0.88), 1.2)),
  };
}

/**
 * Width of a view from its layout, with `estimate` until the first layout (so the first frame already uses a
 * sensible column count). Re-renders only when the width changes, e.g. when a foldable is opened.
 */
export function useMeasuredWidth(estimate: number): [number, (event: LayoutChangeEvent) => void] {
  const [measured, setMeasured] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setMeasured(prev => (prev === next ? prev : next));
  }, []);
  return [measured > 0 ? measured : Math.max(0, Math.floor(estimate)), onLayout];
}
