/**
 * WorkNest charts (react-native-svg + Reanimated), theme-aware and accessible.
 *   import { Donut, BarChart, Sparkline, HBarList } from "../../components/charts";
 * Usage guide: ../ui/docs/charts.md
 */
export { Donut, type DonutProps, type DonutSegment } from "./Donut";
export { BarChart, type BarChartProps, type BarDatum, type BarSeries } from "./BarChart";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { HBarList, type HBarListProps, type HBarItem } from "./HBarList";
export { Legend, type LegendProps, type LegendItem } from "./Legend";
export { useChartColors, chartColors, type ChartColors } from "./palette";
export { useReduceMotion, useMountProgress, useLayoutWidth, type MountProgressOptions } from "./motion";
export {
  bandLayout,
  compactLabel,
  extent,
  labelStep,
  linearScale,
  niceDomain,
  niceStep,
  niceTicks,
  percentOf,
  trendDirection,
  type BandLayout,
  type NiceDomain,
  type TrendDirection,
} from "./scale";
export { describeTrend, type ValueFormatter } from "./summary";
