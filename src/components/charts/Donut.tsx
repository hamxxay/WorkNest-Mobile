import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { AppText } from "../ui/AppText";
import { arcPath, donutSpans, visibleSweep } from "./geometry";
import { Legend } from "./Legend";
import { useMountProgress } from "./motion";
import { markColor, useChartColors } from "./palette";
import { defaultFormat, summarizeDonut, type ValueFormatter } from "./summary";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Surface gap between neighbouring segments, in dp along the ring. */
const GAP = 2;

export type DonutSegment = {
  label: string;
  value: number;
  /** Colour family (tone `solid`). Default: the series colours in order. */
  tone?: Tone;
  /** Explicit colour (wins over `tone`). */
  color?: string;
};

export type DonutProps = {
  /** Parts of the whole, at most about 6. Zero / negative values are not drawn. */
  segments: readonly DonutSegment[];
  /**
   * The whole. When larger than the sum of the segments the rest of the ring stays empty, which makes a meter:
   * `segments={[{ label: "Occupied", value: 72 }]} total={100}`. Default: the sum.
   */
  total?: number;
  /** Diameter in dp. Default 120. */
  size?: number;
  /** Ring thickness in dp. Default 12. */
  thickness?: number;
  /** Figure in the middle, e.g. "72%". */
  centerLabel?: string;
  /** Small text under the figure, e.g. "occupied". */
  centerCaption?: string;
  /** Show a legend under the ring (with values). Default: two or more segments. */
  legend?: boolean;
  /** What the chart shows, for screen readers ("Occupancy"). The values are appended. */
  label?: string;
  /** Replaces the generated screen-reader summary. */
  accessibilityLabel?: string;
  /** Formats values in the legend and the summary. Default grouped digits. */
  formatValue?: ValueFormatter;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ring chart for part-to-whole at a glance (occupancy, conversion). The ring sweeps in clockwise from 12 o'clock
 * on mount (none with reduce motion). Nothing to show (all zero) draws the empty track.
 */
export function Donut({
  segments,
  total,
  size = 120,
  thickness = 12,
  centerLabel,
  centerCaption,
  legend,
  label,
  accessibilityLabel,
  formatValue = defaultFormat,
  style,
}: DonutProps) {
  const theme = useTheme();
  const chart = useChartColors();
  const progress = useMountProgress();
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const gapDeg = radius > 0 ? (GAP / (2 * Math.PI * radius)) * 360 : 0;
  const values = useMemo(() => segments.map(s => s.value), [segments]);
  const spans = useMemo(() => donutSpans(values, total, gapDeg), [values, total, gapDeg]);
  const colors = segments.map((s, i) => markColor(theme, chart, s, i));
  const showLegend = legend ?? segments.length > 1;
  const big = size >= 104;

  const summary =
    accessibilityLabel ??
    summarizeDonut({ label, center: centerLabel, centerCaption, segments, total, format: formatValue });

  return (
    <View style={[styles.root, style]} accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke={chart.track} strokeWidth={thickness} fill="none" />
          {spans.map((span, i) =>
            span.sweep > 0 ? (
              <DonutArc
                key={`${segments[i].label}-${i}`}
                center={center}
                radius={radius}
                start={span.start}
                sweep={span.sweep}
                color={colors[i]}
                thickness={thickness}
                progress={progress}
              />
            ) : null,
          )}
        </Svg>
        {centerLabel || centerCaption ? (
          <View style={[StyleSheet.absoluteFill, styles.center, { padding: thickness + 6 }]} pointerEvents="none">
            {centerLabel ? (
              <AppText
                variant={big ? "title" : "subheading"}
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {centerLabel}
              </AppText>
            ) : null}
            {centerCaption ? (
              <AppText variant="caption" color="textMuted" align="center" numberOfLines={2}>
                {centerCaption}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      {showLegend ? (
        <Legend
          direction="column"
          style={styles.legend}
          items={segments.map((s, i) => ({ label: s.label, color: colors[i], value: formatValue(s.value) }))}
        />
      ) : null}
    </View>
  );
}

function DonutArc({
  center,
  radius,
  start,
  sweep,
  color,
  thickness,
  progress,
}: {
  center: number;
  radius: number;
  start: number;
  sweep: number;
  color: string;
  thickness: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    d: arcPath(center, center, radius, start, visibleSweep(progress.value, start, sweep)),
  }));
  return (
    <AnimatedPath
      d={arcPath(center, center, radius, start, sweep)}
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap="butt"
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: 12 },
  center: { alignItems: "center", justifyContent: "center" },
  legend: { alignSelf: "stretch" },
});
