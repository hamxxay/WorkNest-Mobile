import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { AppText } from "../ui/AppText";
import { columnPath } from "./geometry";
import { Legend } from "./Legend";
import { useLayoutWidth, useMountProgress } from "./motion";
import { markColor, useChartColors } from "./palette";
import { bandLayout, compactLabel, isAllZero, labelStep, linearScale, niceDomain, toFinite } from "./scale";
import { defaultFormat, summarizeBars, type ValueFormatter } from "./summary";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Space above the top gridline so its tick label is not cut off. */
const PLOT_TOP = 8;
/** Height of the category label band under the plot. */
const X_BAND = 22;
/** Rough width of one character of caption text, for sizing the y-axis and thinning x labels. */
const CHAR_W = 7;
/** Each later column starts this share of the animation after the previous one. */
const STAGGER = 0.06;

export type BarSeries = {
  label: string;
  /** Colour family (tone `solid`). Default: the series colours in order (teal, indigo, amber). */
  tone?: Tone;
  /** Explicit colour (wins over `tone`). */
  color?: string;
};

export type BarDatum = {
  /** Short category label under the columns ("Oct"). */
  label: string;
  /** Longer name for the readout and screen readers ("Oct 2026"). Default `label`. */
  title?: string;
  /** One value per series, in series order. Negative / missing values are drawn as 0. */
  values: readonly number[];
};

export type BarChartProps = {
  data: readonly BarDatum[];
  /** One entry per bar in a group (1 to 3). */
  series: readonly BarSeries[];
  /** Height of the plot in dp, without the label band. Default 160. */
  height?: number;
  /** Values in the readout and the screen-reader summary. Default grouped digits. */
  formatValue?: ValueFormatter;
  /** Y-axis tick text. Default compact numbers (0, 500K, 1M). */
  formatTick?: ValueFormatter;
  /** About how many gridline intervals. Default 4. */
  tickCount?: number;
  /** Legend above the plot. Default: two or more series. */
  legend?: boolean;
  /** Tap a column to read its values in a line above the plot (default true; the latest column shows first). */
  selectable?: boolean;
  /** What the chart shows, for screen readers ("Invoiced and paid by month"). The values are appended. */
  label?: string;
  /** Replaces the generated screen-reader summary. */
  accessibilityLabel?: string;
  /** Shown instead of bars when every value is zero. Default "Nothing to show for this period." */
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Vertical columns, grouped when there are several series (invoiced vs paid by month). Columns grow from the
 * baseline on mount (none with reduce motion). Thin marks (max 24 dp, 4 dp rounded top, 2 dp gap inside a group),
 * solid hairline gridlines with compact tick labels.
 */
export function BarChart({
  data,
  series,
  height = 160,
  formatValue = defaultFormat,
  formatTick = compactLabel,
  tickCount = 4,
  legend,
  selectable = true,
  label,
  accessibilityLabel,
  emptyText = "Nothing to show for this period.",
  style,
}: BarChartProps) {
  const theme = useTheme();
  const chart = useChartColors();
  const [width, onLayout] = useLayoutWidth();
  const [picked, setPicked] = useState<number | null>(null);
  // A pick from an earlier, longer data set (period switched) is dropped.
  const selected = picked != null && picked < data.length ? picked : null;

  const values = useMemo(() => data.map(d => series.map((_, j) => Math.max(0, toFinite(d.values[j])))), [data, series]);
  const flat = useMemo(() => values.flat(), [values]);
  const empty = !data.length || !series.length || isAllZero(flat);
  const domain = useMemo(() => niceDomain(0, Math.max(0, ...flat), { count: tickCount }), [flat, tickCount]);
  const tickLabels = domain.ticks.map(t => formatTick(t));
  const axisWidth = Math.max(...tickLabels.map(t => t.length), 1) * CHAR_W + 8;
  const plotWidth = Math.max(0, width - axisWidth);
  const baseY = height - 1;
  const y = linearScale([domain.min, domain.max], [baseY, PLOT_TOP]);
  const layout = useMemo(
    () => bandLayout({ count: data.length, groupSize: series.length, width: plotWidth }),
    [data.length, series.length, plotWidth],
  );
  const maxLabel = Math.max(...data.map(d => d.label.length), 1);
  const labelWidth = Math.max(layout.slot, maxLabel * CHAR_W + 8);
  const step = labelStep(data.length, plotWidth, maxLabel * CHAR_W + 8);
  const labelLeft = (center: number) =>
    Math.max(axisWidth - 4, Math.min(width - labelWidth, axisWidth + center - labelWidth / 2));
  const colors = series.map((s, i) => markColor(theme, chart, s, i));
  const progress = useMountProgress({ ready: width > 0 && !empty });

  const shown = selected ?? data.length - 1;
  const readout =
    selectable && !empty && data[shown]
      ? `${data[shown].title || data[shown].label}: ${series
          .map((s, j) => (series.length > 1 ? `${s.label} ${formatValue(values[shown][j])}` : formatValue(values[shown][j])))
          .join(" · ")}`
      : null;

  const summary = accessibilityLabel ?? summarizeBars({ label, data, series, format: formatValue, emptyText });
  const showLegend = (legend ?? series.length > 1) && !empty;

  return (
    <View style={[styles.root, style]} accessible accessibilityRole="image" accessibilityLabel={summary}>
      {showLegend ? <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} /> : null}
      {readout ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.readout}>
          {readout}
        </AppText>
      ) : null}
      <View onLayout={onLayout} style={{ height: height + X_BAND }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              {selected != null && layout.groups[selected] ? (
                <Rect
                  x={axisWidth + selected * layout.slot + 2}
                  y={PLOT_TOP - 4}
                  width={Math.max(0, layout.slot - 4)}
                  height={baseY - PLOT_TOP + 4}
                  rx={6}
                  fill={chart.track}
                />
              ) : null}
              {domain.ticks.map(t => (
                <Line
                  key={`grid-${t}`}
                  x1={axisWidth}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? chart.baseline : chart.grid}
                  strokeWidth={1}
                />
              ))}
              {!empty
                ? layout.groups.map((g, i) =>
                    g.bars.map((x, j) => (
                      <Column
                        key={`${i}-${j}`}
                        x={axisWidth + x}
                        baseY={baseY}
                        width={layout.barWidth}
                        height={baseY - y(values[i][j])}
                        color={colors[j]}
                        delay={i * STAGGER}
                        stretch={1 + STAGGER * Math.max(0, data.length - 1)}
                        progress={progress}
                      />
                    )),
                  )
                : null}
            </Svg>
            {domain.ticks.map((t, i) => (
              <AppText
                key={`tick-${t}`}
                variant="caption"
                color="textMuted"
                align="right"
                numberOfLines={1}
                style={[styles.tick, { top: y(t) - 8, width: axisWidth - 6 }]}
              >
                {tickLabels[i]}
              </AppText>
            ))}
            {layout.groups.map((g, i) =>
              (data.length - 1 - i) % step === 0 ? (
                <AppText
                  key={`x-${i}`}
                  variant="caption"
                  color={selected === i ? "text" : "textMuted"}
                  align="center"
                  numberOfLines={1}
                  style={[styles.xLabel, { top: height + 4, left: labelLeft(g.center), width: labelWidth }]}
                >
                  {data[i].label}
                </AppText>
              ) : null,
            )}
            {selectable && !empty ? (
              // Touch only: screen readers get every value from the chart's own label.
              <View
                style={[styles.hits, { left: axisWidth }]}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                {data.map((d, i) => (
                  <Pressable
                    key={`hit-${i}`}
                    style={styles.hit}
                    onPress={() => setPicked(prev => (prev === i ? null : i))}
                    accessibilityLabel={d.title || d.label}
                  />
                ))}
              </View>
            ) : null}
            {empty ? (
              <View style={[styles.empty, { left: axisWidth, height }]} pointerEvents="none">
                <AppText variant="bodySmall" color="textMuted" align="center">
                  {emptyText}
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function Column({
  x,
  baseY,
  width,
  height,
  color,
  delay,
  stretch,
  progress,
}: {
  x: number;
  baseY: number;
  width: number;
  height: number;
  color: string;
  /** Start of this column's part of the progress (0..1 of the first column's run). */
  delay: number;
  /** Total progress span including every column's delay. */
  stretch: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, progress.value * stretch - delay));
    return { d: columnPath(x, baseY, width, height * t, 4) };
  });
  return <AnimatedPath d={columnPath(x, baseY, width, height, 4)} fill={color} animatedProps={animatedProps} />;
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  readout: { minHeight: 16 },
  tick: { position: "absolute", left: 0, fontVariant: ["tabular-nums"] },
  xLabel: { position: "absolute" },
  hits: { position: "absolute", top: 0, right: 0, bottom: 0, flexDirection: "row" },
  hit: { flex: 1 },
  empty: { position: "absolute", top: 0, right: 0, alignItems: "center", justifyContent: "center", padding: 12 },
});
