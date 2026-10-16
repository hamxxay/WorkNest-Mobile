import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { spacing } from "../../theme";
import { columnsFor, itemWidthFor, useMeasuredWidth } from "../../utils/responsive";
import { useScreenColumnWidth } from "./screenChrome";

export type ResponsiveGridProps = {
  children?: ReactNode;
  /** Narrowest an item may get at the default font size (dp). It grows with the system font size. Default 150. */
  minItemWidth?: number;
  /** Most columns. Default 4. */
  maxColumns?: number;
  /** Fixed number of columns (skips the measuring). */
  columns?: number;
  /** Gap between items, both ways. Default 12. */
  gap?: number;
  /** How much of an item grows with the font size (0 = none, 1 = all of it). Default 0.5. */
  fontWeight?: number;
  /** Pick a column count that leaves no nearly empty last row (4 items: 4, 2 or 1 columns). Default true. */
  balanced?: boolean;
  /** Items in a short last row grow to fill it. Default true. */
  stretchLastRow?: boolean;
  /** Width to assume before the first layout. Default: the screen's content column minus the screen padding. */
  estimatedWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** Style of each item's cell (it already has the computed width). */
  itemStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Cards / tiles in as many columns as fit: 1 on a narrow phone or with very large text, 2 on phones, up to 4 on
 * tablets and unfolded foldables. Measures its own width, so it follows rotation and a foldable switching screens,
 * and works inside cards and sheets too. Items in one row get the same height (give the item `flex: 1` or
 * `flexGrow: 1` to fill it).
 *
 *   <ResponsiveGrid minItemWidth={150}>
 *     {tiles.map(t => <StatCard key={t.label} {...t} />)}
 *   </ResponsiveGrid>
 */
export function ResponsiveGrid({
  children,
  minItemWidth = 150,
  maxColumns = 4,
  columns,
  gap = 12,
  fontWeight = 0.5,
  balanced = true,
  stretchLastRow = true,
  estimatedWidth,
  style,
  itemStyle,
  testID,
}: ResponsiveGridProps) {
  const { fontScale } = useWindowDimensions();
  const columnWidth = useScreenColumnWidth();
  const [width, onLayout] = useMeasuredWidth(estimatedWidth ?? columnWidth - 2 * spacing.screen);
  const items = Children.toArray(children).filter(isValidElement);
  const count = items.length;
  const cols = Math.max(
    1,
    Math.floor(
      columns ??
        columnsFor(width, { minItemWidth, gap, maxColumns, fontScale, fontWeight, count: balanced ? count : undefined }),
    ),
  );
  const cellWidth = itemWidthFor(width, cols, gap);
  const lastRowStart = count - (count % cols || cols);

  return (
    <View testID={testID} onLayout={onLayout} style={[styles.grid, { gap }, style]}>
      {items.map((child, i) => (
        <View
          key={child.key ?? i}
          style={[{ width: cellWidth }, stretchLastRow && i >= lastRowStart && styles.grow, itemStyle]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  grow: { flexGrow: 1 },
});
