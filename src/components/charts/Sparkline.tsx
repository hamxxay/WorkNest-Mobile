import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme, type Tone } from "../../theme";
import { areaPath, linePath, polylineLength, sparkPoints } from "./geometry";
import { useLayoutWidth, useMountProgress } from "./motion";
import { markColor, useChartColors } from "./palette";
import { describeTrend, sentences, type ValueFormatter } from "./summary";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const STROKE = 2;
const DOT_R = 3;
/** Room for the end dot and its 2px surface ring. */
const PAD = DOT_R + 2;
const AREA_OPACITY = 0.12;

export type SparklineProps = {
  /** Values oldest first. Fewer than two points draws nothing. */
  data: readonly number[];
  /** Height in dp. Default 32. */
  height?: number;
  /** Fixed width in dp. Default: the width of the parent. */
  width?: number;
  /** Colour family of the line (tone `solid`). Default "primary". */
  tone?: Tone;
  /** Explicit line colour (wins over `tone`). */
  color?: string;
  /** Soft wash under the line. Default true. */
  area?: boolean;
  /** Dot on the latest value. Default true. */
  endDot?: boolean;
  /** What is plotted, for screen readers ("Occupancy"). The trend summary is appended. */
  label?: string;
  /** Replaces the generated screen-reader summary. */
  accessibilityLabel?: string;
  /** Formats values in the summary. Default compact numbers (12.5K). */
  formatValue?: ValueFormatter;
  /** Hidden from screen readers (the parent describes the trend, e.g. StatCard). */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A small trend line (no axes): 2px line, soft area wash and a dot on the latest value. Drawn on with the mount
 * animation unless reduce motion is on.
 */
export function Sparkline({
  data,
  height = 32,
  width,
  tone = "primary",
  color,
  area = true,
  endDot = true,
  label,
  accessibilityLabel,
  formatValue,
  decorative = false,
  style,
}: SparklineProps) {
  const theme = useTheme();
  const chart = useChartColors();
  const [measured, onLayout] = useLayoutWidth();
  const w = width ?? measured;
  const points = useMemo(() => sparkPoints(data, w, height, PAD), [data, w, height]);
  const drawable = points.length > 1;
  const progress = useMountProgress({ ready: drawable });
  const stroke = markColor(theme, chart, { color, tone });

  const line = useMemo(() => linePath(points), [points]);
  const wash = useMemo(() => areaPath(points, height), [points, height]);
  const length = useMemo(() => Math.max(1, polylineLength(points)), [points]);
  const last = points[points.length - 1];

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: AREA_OPACITY * progress.value }));
  const dotProps = useAnimatedProps(() => ({ opacity: Math.max(0, Math.min(1, (progress.value - 0.85) / 0.15)) }));

  if (data.length < 2) return null;

  const a11y = decorative
    ? { accessible: false, importantForAccessibility: "no-hide-descendants" as const, accessibilityElementsHidden: true }
    : {
        accessible: true,
        accessibilityRole: "image" as const,
        accessibilityLabel: accessibilityLabel ?? sentences([label, describeTrend([...data], formatValue)]),
      };

  return (
    <View {...a11y} onLayout={width == null ? onLayout : undefined} style={[{ height, width }, style]}>
      {drawable ? (
        <Svg width={w} height={height}>
          {area ? <AnimatedPath d={wash} fill={stroke} animatedProps={areaProps} /> : null}
          <AnimatedPath
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[length, length]}
            animatedProps={lineProps}
          />
          {endDot && last ? (
            <AnimatedCircle
              cx={last.x}
              cy={last.y}
              r={DOT_R}
              fill={stroke}
              stroke={chart.surface}
              strokeWidth={2}
              animatedProps={dotProps}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
