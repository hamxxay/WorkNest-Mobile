import { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../../../theme";
import {
  columnsFor,
  estimateButtonWidth,
  itemWidthFor,
  maxWidthFor,
  textScale,
  type ContentWidthMode,
} from "../../../../utils/responsive";

// Layout decisions the customer screens share. The pure helpers are separate from the hooks so they can be unit
// tested; the hooks read the live window (useWindowDimensions), so they follow rotation and a foldable switching
// screens while the app is open.

/**
 * Width of a screen's content inside its padding: the window minus the side safe-area insets <Screen> pads, capped
 * like <Screen>'s column (720dp, or 1120 / the window for "wide" / "full"), minus `padding` on both sides.
 */
export function contentWidthFor(
  windowWidth: number,
  insetLeft = 0,
  insetRight = 0,
  mode: ContentWidthMode = "content",
  padding: number = spacing.screen,
): number {
  const inner = Math.max(0, windowWidth - insetLeft - insetRight);
  return Math.max(0, Math.min(inner, maxWidthFor(mode)) - 2 * padding);
}

/**
 * contentWidthFor for the current window. Works in a screen component itself (outside the <Screen> it renders,
 * where useScreenColumnWidth has no column to read yet).
 */
export function useContentWidth(mode: ContentWidthMode = "content", padding: number = spacing.screen): number {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return contentWidthFor(width, insets.left, insets.right, mode, padding);
}

export type ListColumnsOptions = {
  /** Narrowest a card may get at the default font size (dp). */
  minItemWidth: number;
  /** Most columns. Default 2. */
  maxColumns?: number;
  /** Gap between columns (dp). Default 12. */
  gap?: number;
  /** The <Screen width> the list sits in. Default "content". */
  mode?: ContentWidthMode;
  /** How much of a card grows with the font size (see columnsFor). Default 0.5. */
  fontWeight?: number;
};

/**
 * Columns for a card list (FlatList / AsyncList `numColumns`): one on phones, more on tablets and unfolded
 * foldables when the cards still get `minItemWidth`. A FlatList cannot change numColumns on the fly: give it
 * `key={numColumns}`, and pass `columnWrapperStyle` only when numColumns > 1.
 */
export function useListColumns({ minItemWidth, maxColumns = 2, gap = 12, mode = "content", fontWeight }: ListColumnsOptions) {
  const { fontScale } = useWindowDimensions();
  const width = useContentWidth(mode);
  const numColumns = columnsFor(width, { minItemWidth, maxColumns, gap, fontScale, fontWeight });
  return { numColumns, itemWidth: itemWidthFor(width, numColumns, gap), width };
}

/** Narrowest a booking / bill / agreement card gets in a card list (dp): two per row from ~650dp of content. */
export const LIST_CARD_MIN_WIDTH = 320;

/**
 * A card list in columns (see useListColumns), with what an AsyncList / FlatList needs for it:
 *   <AsyncList key={grid.numColumns} numColumns={grid.numColumns} columnWrapperStyle={grid.columnWrapperStyle}
 *     renderItem={({ item }) => <Card style={grid.cellStyle}>...</Card>} />
 * `cellStyle` gives each card its column width (undefined in one column, where cards fill the row as before).
 */
export function useCardGrid(options: ListColumnsOptions) {
  const gap = options.gap ?? 12;
  const { numColumns, itemWidth } = useListColumns({ ...options, gap });
  const multiColumn = numColumns > 1;
  const cellStyle = useMemo(() => (multiColumn ? { width: itemWidth } : undefined), [multiColumn, itemWidth]);
  const columnWrapperStyle = useMemo(() => (multiColumn ? [gridStyles.row, { gap }] : undefined), [multiColumn, gap]);
  return { numColumns, cellStyle, columnWrapperStyle };
}

const gridStyles = StyleSheet.create({
  // Cards of one row line up at the top (a shorter card does not stretch).
  row: { alignItems: "flex-start" },
});

/**
 * The first of `labels` that a button `available` dp wide shows in full at this font scale (Button shows one line
 * and clips the rest), else the last one. List the full wording first and shorter ones with the same meaning after
 * it; keep the full wording as the button's accessibilityLabel. `extra` covers the larger padding of lg buttons.
 */
export function fittingLabel(labels: readonly string[], available: number, fontScale = 1, icon = false, extra = 8): string {
  for (const label of labels) {
    if (estimateButtonWidth(label, fontScale, icon) + extra <= available) return label;
  }
  return labels[labels.length - 1] ?? "";
}

/**
 * True when a button beside a row's text (Remove, Unlock...) would leave the text less than `minText` dp (measured
 * at the default font size): the button then goes under the text, so names and IDs are not squeezed into a few
 * letters per line on a narrow phone, the Fold cover screen or with large text. `reserved` is the part of the row
 * that holds no text (avatar or icon, gaps).
 */
export function stackSideAction(
  rowWidth: number,
  reserved: number,
  label: string,
  fontScale = 1,
  icon = false,
  minText = 100,
): boolean {
  const room = rowWidth - reserved - estimateButtonWidth(label, fontScale, icon);
  return room / textScale(fontScale) < minText;
}
