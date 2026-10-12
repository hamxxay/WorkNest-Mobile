import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { AppText } from "../ui/AppText";
import { pillPath } from "./geometry";
import { useLayoutWidth, useMountProgress } from "./motion";
import { markColor, useChartColors } from "./palette";
import { toFinite } from "./scale";
import { defaultFormat, summarizeList, type ValueFormatter } from "./summary";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A non-zero value is never drawn thinner than this, so it reads differently from zero. */
const MIN_FILL = 4;
const STAGGER = 0.08;

export type HBarItem = {
  /** Stable key (default: the label). */
  key?: string | number;
  label: string;
  value: number;
  /** Text at the bar end (default `formatValue(value)`), e.g. "72% · 18/25". */
  valueLabel?: string;
  /** Optional caption under the bar. */
  detail?: string;
  /** Colour family (tone `solid`). Default: series slot 1 (brand teal) for every bar. */
  tone?: Tone;
  /** Explicit colour (wins over `tone`). */
  color?: string;
};

export type HBarListProps = {
  items: readonly HBarItem[];
  /** Value of a full bar (e.g. 100 for percentages). Default: the largest value. */
  max?: number;
  /** Value text when an item has no valueLabel, and in the summary. Default grouped digits. */
  formatValue?: ValueFormatter;
  /** Bar thickness in dp. Default 8. */
  barHeight?: number;
  /** What the list shows, for screen readers ("Pipeline this month"). The values are appended. */
  label?: string;
  /** Replaces the generated screen-reader summary. */
  accessibilityLabel?: string;
  /** Shown when there are no items. Default "Nothing to show." */
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Labelled horizontal bars, one per row (pipeline stages, locations compared). Every row shows its value as
 * text, the bar shows the size. Bars grow from the left on mount (none with reduce motion).
 */
export function HBarList({
  items,
  max,
  formatValue = defaultFormat,
  barHeight = 8,
  label,
  accessibilityLabel,
  emptyText = "Nothing to show.",
  style,
}: HBarListProps) {
  const theme = useTheme();
  const chart = useChartColors();
  const [width, onLayout] = useLayoutWidth();
  const progress = useMountProgress({ ready: width > 0 && items.length > 0 });
  const values = items.map(it => Math.max(0, toFinite(it.value)));
  const full = Math.max(toFinite(max), ...values, 0);
  const stretch = 1 + STAGGER * Math.max(0, items.length - 1);

  const summary =
    accessibilityLabel ??
    summarizeList({
      label,
      items: items.map(it => ({ label: it.label, value: it.value, valueLabel: it.valueLabel })),
      format: formatValue,
      emptyText,
    });

  if (!items.length) {
    return (
      <View style={style} accessible accessibilityLabel={summary}>
        <AppText variant="bodySmall" color="textMuted">
          {emptyText}
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]} accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={onLayout}>
      {items.map((it, i) => {
        const fill = full > 0 && values[i] > 0 ? Math.max(MIN_FILL, (values[i] / full) * width) : 0;
        return (
          <View key={it.key ?? it.label} style={styles.row}>
            <View style={styles.top}>
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.label}>
                {it.label}
              </AppText>
              <AppText variant="captionStrong" numberOfLines={1} style={styles.value}>
                {it.valueLabel ?? formatValue(it.value)}
              </AppText>
            </View>
            <View style={{ height: barHeight }}>
              {width > 0 ? (
                <Svg width={width} height={barHeight}>
                  <Path d={pillPath(0, 0, width, barHeight)} fill={chart.track} />
                  {fill > 0 ? (
                    <Fill
                      width={Math.min(width, fill)}
                      height={barHeight}
                      color={markColor(theme, chart, it)}
                      delay={i * STAGGER}
                      stretch={stretch}
                      progress={progress}
                    />
                  ) : null}
                </Svg>
              ) : null}
            </View>
            {it.detail ? (
              <AppText variant="caption" color="textMuted">
                {it.detail}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Fill({
  width,
  height,
  color,
  delay,
  stretch,
  progress,
}: {
  width: number;
  height: number;
  color: string;
  delay: number;
  stretch: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, progress.value * stretch - delay));
    return { d: pillPath(0, 0, width * t, height) };
  });
  return <AnimatedPath d={pillPath(0, 0, width, height)} fill={color} animatedProps={animatedProps} />;
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  row: { gap: 4 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1 },
  value: { flexShrink: 0, maxWidth: "60%" },
});
