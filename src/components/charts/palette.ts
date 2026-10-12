import { useMemo } from "react";
import { palette, useTheme, type Theme, type Tone } from "../../theme";

/**
 * Chart colours for the active theme. Marks use `series` (categorical, fixed order) or a tone's `solid`;
 * text never uses a series colour (labels, values and legends use the text tokens).
 *
 * `series` is the same in light and dark: teal-600, indigo-500, amber-600 were checked with the data-viz
 * palette validator against the card surface of both modes (#ffffff and #131c2e): lightness band, chroma,
 * colour-blind separation (worst adjacent pair dE 19.3) and >= 3:1 contrast all pass.
 */
export type ChartColors = {
  /** Categorical series colours in fixed order (slot 1 = brand teal). Never cycle past the end. */
  series: readonly string[];
  /** De-emphasised marks (e.g. "Lost" in a pipeline, everything except a highlight). */
  muted: string;
  /** Unfilled part of a meter, donut ring or bar track. */
  track: string;
  /** Hairline gridlines (solid, never dashed). */
  grid: string;
  /** The zero line under columns: one step stronger than the grid. */
  baseline: string;
  /** Axis and tick text. */
  axis: string;
  /** Card surface behind the chart (surface gaps and rings around dots). */
  surface: string;
  /** Primary text (values). */
  text: string;
};

const SERIES = [palette.teal[600], palette.indigo[500], palette.amber[600]] as const;

export function chartColors(theme: Theme): ChartColors {
  const { colors, tones } = theme;
  return {
    series: SERIES,
    muted: tones.neutral.solid,
    track: colors.surfaceAlt,
    grid: colors.border,
    baseline: colors.borderStrong,
    axis: colors.textMuted,
    surface: colors.surface,
    text: colors.text,
  };
}

/** Chart colours for the active light / dark theme. */
export function useChartColors(): ChartColors {
  const theme = useTheme();
  return useMemo(() => chartColors(theme), [theme]);
}

/**
 * Colour of a mark: an explicit colour wins, then a tone's solid colour, then the series slot (`index`), then
 * the first series colour.
 */
export function markColor(
  theme: Theme,
  chart: ChartColors,
  mark: { color?: string; tone?: Tone },
  index = 0,
): string {
  if (mark.color) return mark.color;
  if (mark.tone) return theme.tones[mark.tone].solid;
  return chart.series[index] ?? chart.series[0];
}
