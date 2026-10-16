import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { AppText } from "../ui/AppText";
import { columnPath } from "./geometry";
import { Legend } from "./Legend";
import { useLayoutWidth, useMountProgress } from "./motion";
import { markColor, useChartColors } from "./palette";
import { bandLayout, compactLabel, isAllZero, labelStep, linearScale, niceDomain, stackSegments, toFinite } from "./scale";
import { defaultFormat, summarizeBars, type ValueFormatter } from "./summary";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Line height of caption text (axis labels) at font scale 1. */
const CAPTION_LINE = 16;
/** Rough width of one character of caption text at font scale 1, for sizing x labels and thinning them. */
const CHAR_W = 7.5;
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
  /** One entry per bar in a group (1 to 3); with `stacked`, one per part of the column (up to 6, each with a colour). */
  series: readonly BarSeries[];
  /**
   * One column per item with the series stacked in it, bottom to top in series order (parts of a whole, e.g.
   * inquiries by Type per month). The axis covers the totals; the readout and screen readers add the total.
   * Default false (grouped bars).
   */
  stacked?: boolean;
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
  /**
   * Tap a column to open it (drill-down). The column is also picked (its values show in the readout). With this
   * set, every column is a button for screen readers, named by its values, instead of one image for the chart.
   */
  onPressItem?: (index: number) => void;
  /** Spoken after a column's values when `onPressItem` is set. Default "Opens the breakdown". */
  itemAccessibilityHint?: string;
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
  stacked = false,
  height = 160,
  formatValue = defaultFormat,
  formatTick = compactLabel,
  tickCount = 4,
  legend,
  selectable = true,
  label,
  accessibilityLabel,
  emptyText = "Nothing to show for this period.",
  onPressItem,
  itemAccessibilityHint = "Opens the breakdown",
  style,
}: BarChartProps) {
  const theme = useTheme();
  const chart = useChartColors();
  // Live font scale (re-renders when the system font size changes while the app is open).
  const { fontScale: systemFontScale } = useWindowDimensions();
  const [width, onLayout] = useLayoutWidth();
  const [picked, setPicked] = useState<number | null>(null);
  // A pick from an earlier, longer data set (period switched) is dropped.
  const selected = picked != null && picked < data.length ? picked : null;

  const values = useMemo(() => data.map(d => series.map((_, j) => Math.max(0, toFinite(d.values[j])))), [data, series]);
  const flat = useMemo(() => values.flat(), [values]);
  /** Column totals (stacked): what the axis has to reach. */
  const totals = useMemo(() => values.map(v => v.reduce((sum, x) => sum + x, 0)), [values]);
  const empty = !data.length || !series.length || isAllZero(flat);
  const domain = useMemo(
    () => niceDomain(0, Math.max(0, ...(stacked ? totals : flat)), { count: tickCount }),
    [stacked, totals, flat, tickCount],
  );
  // Nothing to show: keep only the baseline (a "1" tick on an empty money axis would mean nothing).
  const ticks = empty ? [0] : domain.ticks;
  const tickLabels = ticks.map(t => formatTick(t));
  // Axis text follows the system font size, so the axis band and label widths scale with it.
  const fontScale = systemFontScale || 1;
  const lineHeight = CAPTION_LINE * fontScale;
  const charWidth = CHAR_W * fontScale;
  const plotTop = Math.ceil(lineHeight / 2);
  const xBand = Math.ceil(lineHeight + 6);
  const axisWidth = Math.ceil(Math.max(...tickLabels.map(t => t.length), 1) * charWidth + 10);
  const plotWidth = Math.max(0, width - axisWidth);
  const baseY = height - 1;
  const y = linearScale([domain.min, domain.max], [baseY, plotTop]);
  const layout = useMemo(
    () => bandLayout({ count: data.length, groupSize: stacked ? 1 : series.length, width: plotWidth }),
    [data.length, series.length, stacked, plotWidth],
  );
  const maxLabel = Math.max(...data.map(d => d.label.length), 1);
  const labelWidth = Math.max(layout.slot, maxLabel * charWidth + 8);
  const step = labelStep(data.length, plotWidth, maxLabel * charWidth + 8);
  const labelLeft = (center: number) =>
    Math.max(axisWidth - 4, Math.min(width - labelWidth, axisWidth + center - labelWidth / 2));
  const colors = series.map((s, i) => markColor(theme, chart, s, i));
  const progress = useMountProgress({ ready: width > 0 && !empty });

  const interactive = !!onPressItem && !empty;
  /** "Oct 2026: Invoiced PKR 1.2M · Collected PKR 900K" (stacked: "Oct 2026: 20 in total · Website 8 · ..."). */
  const columnText = (i: number, sep = " · ") =>
    stacked
      ? `${data[i].title || data[i].label}: ${[
          `${formatValue(totals[i])} in total`,
          ...series.map((s, j) => (values[i][j] > 0 ? `${s.label} ${formatValue(values[i][j])}` : null)),
        ]
          .filter(Boolean)
          .join(sep)}`
      : `${data[i].title || data[i].label}: ${series
          .map((s, j) => (series.length > 1 ? `${s.label} ${formatValue(values[i][j])}` : formatValue(values[i][j])))
          .join(sep)}`;
  const shown = selected ?? data.length - 1;
  const readout = (selectable || interactive) && !empty && data[shown] ? columnText(shown) : null;

  const summary = accessibilityLabel ?? summarizeBars({ label, data, series, format: formatValue, emptyText });
  const showLegend = (legend ?? series.length > 1) && !empty;
  /** Axis text is drawn for sighted users only (the summary or the column buttons carry every value). */
  const hiddenText = { importantForAccessibility: "no" as const, accessibilityElementsHidden: true };

  return (
    <View
      style={[styles.root, style]}
      // Interactive: the columns are the accessible elements (buttons); otherwise one image with every value.
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : "image"}
      accessibilityLabel={interactive ? undefined : summary}
    >
      {showLegend ? <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} /> : null}
      {readout ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.readout}>
          {readout}
        </AppText>
      ) : null}
      <View onLayout={onLayout} style={{ height: height + xBand }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              {selected != null && layout.groups[selected] ? (
                <Rect
                  x={axisWidth + selected * layout.slot + 2}
                  y={plotTop - 4}
                  width={Math.max(0, layout.slot - 4)}
                  height={baseY - plotTop + 4}
                  rx={6}
                  fill={chart.track}
                />
              ) : null}
              {ticks.map(t => (
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
              {!empty && stacked
                ? layout.groups.map((g, i) =>
                    stackSegments(values[i]).map(seg => {
                      const bottom = baseY - y(seg.start);
                      const full = baseY - y(seg.start + seg.value);
                      return (
                        <Column
                          key={`${i}-${seg.index}`}
                          x={axisWidth + g.bars[0]}
                          baseY={baseY}
                          offset={bottom}
                          width={layout.barWidth}
                          // A 1 dp surface gap between parts; only the top part has rounded corners.
                          height={seg.top ? full - bottom : Math.max(0, full - bottom - 1)}
                          radius={seg.top ? 4 : 0}
                          color={colors[seg.index]}
                          delay={i * STAGGER}
                          stretch={1 + STAGGER * Math.max(0, data.length - 1)}
                          progress={progress}
                        />
                      );
                    }),
                  )
                : null}
              {!empty && !stacked
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
            {ticks.map((t, i) => (
              <AppText
                key={`tick-${t}`}
                variant="caption"
                color="textMuted"
                align="right"
                numberOfLines={1}
                {...hiddenText}
                // Anchored by its right edge and sized by its text, so a long tick never truncates.
                style={[styles.tick, { top: y(t) - lineHeight / 2, right: width - axisWidth + 6 }]}
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
                  {...hiddenText}
                  style={[styles.xLabel, { top: height + 4, left: labelLeft(g.center), width: labelWidth }]}
                >
                  {data[i].label}
                </AppText>
              ) : null,
            )}
            {interactive ? (
              // Drill-down: each column is a button named by its values.
              <View style={[styles.hits, { left: axisWidth }]}>
                {data.map((d, i) => (
                  <Pressable
                    key={`hit-${i}`}
                    style={styles.hit}
                    onPress={() => {
                      setPicked(i);
                      onPressItem?.(i);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={columnText(i, ", ")}
                    accessibilityHint={itemAccessibilityHint}
                  />
                ))}
              </View>
            ) : selectable && !empty ? (
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
  offset = 0,
  width,
  height,
  radius = 4,
  color,
  delay,
  stretch,
  progress,
}: {
  x: number;
  baseY: number;
  /** Stacked parts: how far above the baseline this part starts (grows with the column). */
  offset?: number;
  width: number;
  height: number;
  /** Top corner radius (0 for a stacked part under another). */
  radius?: number;
  color: string;
  /** Start of this column's part of the progress (0..1 of the first column's run). */
  delay: number;
  /** Total progress span including every column's delay. */
  stretch: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, progress.value * stretch - delay));
    return { d: columnPath(x, baseY - offset * t, width, height * t, radius) };
  });
  return <AnimatedPath d={columnPath(x, baseY - offset, width, height, radius)} fill={color} animatedProps={animatedProps} />;
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  readout: { minHeight: 16 },
  tick: { position: "absolute", fontVariant: ["tabular-nums"] },
  xLabel: { position: "absolute" },
  hits: { position: "absolute", top: 0, right: 0, bottom: 0, flexDirection: "row" },
  hit: { flex: 1 },
  empty: { position: "absolute", top: 0, right: 0, alignItems: "center", justifyContent: "center", padding: 12 },
});
