// Geometry of the floating tab bar (./TabBar.tsx). Plain numbers and worklet-safe helpers, no React, so the
// bar, useTabBarSpace() and the unit tests share one source of truth.

/** Height of the pill: one row of tab items plus the padding around them. */
export const TAB_BAR_HEIGHT = 64;
/** Padding inside the pill, around the row of items. */
export const TAB_BAR_PADDING = 5;
/** Height of one tab item (above the 44dp touch target). */
export const TAB_ITEM_HEIGHT = TAB_BAR_HEIGHT - 2 * TAB_BAR_PADDING;
/** Gap between the pill and the bottom inset (gesture handle / 3-button navigation bar). */
export const TAB_BAR_BOTTOM_GAP = 8;
/** Gap used when the device reports no bottom inset, so the pill never sits on the screen edge. */
export const TAB_BAR_BOTTOM_GAP_NO_INSET = 12;
/** Left / right margin of the pill (added to the side insets in landscape). */
export const TAB_BAR_SIDE_MARGIN = 16;
/** Widest the pill gets (tablets, landscape); it is centred above that. */
export const TAB_BAR_MAX_WIDTH = 520;
/** The active tab is this much wider than an inactive one, in tab widths (active = 1.5, inactive = 1). */
export const ACTIVE_TAB_EXTRA = 0.5;

/** Distance from the bottom of the window to the bottom of the pill. */
export function tabBarBottomOffset(insetBottom: number): number {
  const inset = Math.max(0, insetBottom || 0);
  return inset + (inset > 0 ? TAB_BAR_BOTTOM_GAP : TAB_BAR_BOTTOM_GAP_NO_INSET);
}

/**
 * Height the floating bar covers at the bottom of a tab screen: bar + gap + bottom inset. Content that scrolls
 * under the bar adds this to its own bottom padding (see useTabBarSpace()).
 */
export function tabBarSpace(insetBottom: number): number {
  return tabBarBottomOffset(insetBottom) + TAB_BAR_HEIGHT;
}

/** Keeps the animated position inside the row (springs may overshoot the first / last tab slightly). */
export function clampTabPosition(position: number, count: number): number {
  "worklet";
  return Math.min(Math.max(position, 0), Math.max(count - 1, 0));
}

/**
 * How selected tab `index` is (0..1) while the indicator sits at `position` (a fractional tab index that the
 * indicator animates through). 1 = fully selected, 0 = not selected; at most two neighbours are in between and
 * their values always add up to 1.
 */
export function tabActiveness(position: number, index: number): number {
  "worklet";
  return Math.max(0, 1 - Math.abs(position - index));
}

/** Width of one inactive tab in a row `rowWidth` wide holding `count` tabs (the active one is 1 + extra wide). */
export function tabUnitWidth(rowWidth: number, count: number): number {
  "worklet";
  return count > 0 && rowWidth > 0 ? rowWidth / (count + ACTIVE_TAB_EXTRA) : 0;
}
