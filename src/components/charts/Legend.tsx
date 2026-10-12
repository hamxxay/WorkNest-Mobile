import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "../ui/AppText";

export type LegendItem = {
  label: string;
  color: string;
  /** Optional figure after the label ("72%"). */
  value?: string;
};

export type LegendProps = {
  items: readonly LegendItem[];
  /** "row" wraps items on one line (default); "column" stacks them (donut side legend). */
  direction?: "row" | "column";
  style?: StyleProp<ViewStyle>;
};

/**
 * Colour key for charts with two or more series: a swatch carries the colour, the text stays in text tokens.
 * Hidden from screen readers (the chart's own label already names every series).
 */
export function Legend({ items, direction = "row", style }: LegendProps) {
  if (!items.length) return null;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[direction === "row" ? styles.row : styles.column, style]}
    >
      {items.map(item => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <AppText variant="caption" color="textSecondary" numberOfLines={1} style={direction === "column" ? styles.flex : null}>
            {item.label}
          </AppText>
          {item.value ? (
            <AppText variant="captionStrong" numberOfLines={1}>
              {item.value}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 },
  column: { gap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  flex: { flexShrink: 1 },
});
