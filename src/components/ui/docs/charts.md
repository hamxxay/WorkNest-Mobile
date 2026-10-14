# Charts

Small, theme-aware charts drawn with `react-native-svg` and animated with Reanimated. They live in
`src/components/charts` (not in the UI kit barrel), so import them from there:

```ts
import { BarChart, Donut, HBarList, Sparkline } from "../../components/charts";
import { formatMoney } from "../../utils/format";

const money = (v: number) => formatMoney(v, { compact: true }); // "PKR 1.25M"
```

Rules every chart follows:

- **Charts add to the figures, they do not replace them.** Keep the numbers on screen as text (a label at the bar
  end, the figure in the middle of a donut, or a small table under a column chart).
- **One accessible element per chart.** The root has `accessibilityRole="image"` and an `accessibilityLabel` that
  lists every value ("Invoiced and paid by month. Sep 2026: Invoiced PKR 1.2M, Paid PKR 900K. ..."). Pass `label`
  to name the chart (the values are appended) or `accessibilityLabel` to replace the summary.
- **Drill-down charts are the exception.** With `onPressItem` (`BarChart`, `HBarList`) each column / row is a button
  named by its values (plus `itemAccessibilityHint`, default "Opens the breakdown") and the chart is no longer one
  image. The CEO dashboard uses this to open its breakdown and records screens.
- **Theme-aware.** Colours come from the active light / dark theme (`useChartColors()`); never pass hex codes from a
  screen. Use `tone` (a `Tone` such as `"neutral"`) or leave the default series colour.
- **Animated in on mount, once.** Columns grow, rings sweep, lines draw on (about 650 ms, ease-out). With the system
  reduce-motion setting on (`AccessibilityInfo.isReduceMotionEnabled`, Android "Remove animations") the chart is
  drawn complete with no animation. New data after the first render (pull to refresh, another period) is drawn
  straight away.
- **Empty and zero data are handled.** An empty or all-zero `BarChart` shows `emptyText` inside its frame (no
  layout jump); a `Donut` with nothing to show draws its empty track; `HBarList` shows zero-length bars with their
  "0" labels, or `emptyText` when there are no items; a `Sparkline` with fewer than two points renders nothing.
  Missing, negative and non-numeric values are drawn as 0.
- **Money in PKR** through the app formatters: pass `formatValue={money}` (compact `formatMoney`). Axis ticks use
  `formatCompactNumber` (0, 500K, 1M) unless you pass `formatTick`.

## Colours

`useChartColors()` returns the palette for the active mode:

| Key | Use | Light / dark source |
| --- | --- | --- |
| `series` | categorical marks in fixed order: teal-600, indigo-500, amber-600 | same in both modes |
| `muted` | de-emphasised marks ("Lost" in the pipeline) | `tones.neutral.solid` |
| `track` | empty part of a meter, donut ring or bar | `surfaceAlt` |
| `grid` | hairline gridlines (solid, never dashed) | `border` |
| `baseline` | the zero line under columns | `borderStrong` |
| `axis` | tick text | `textMuted` |
| `surface` | surface gaps and dot rings | `surface` |

The three series colours were checked against the card surface of both modes (`#ffffff`, `#131c2e`) with the
data-viz palette validator: lightness band, chroma, colour-blind separation (worst adjacent pair dE 19.3) and 3:1
contrast all pass. Do not add a fourth by cycling; fold extra series into "Other" or use a table.

Text never takes a series colour: values, labels and legends use the text tokens; a swatch or the mark itself
carries the colour. A chart with two or more series always has a legend.

## Donut

Part-to-whole at a glance, up to about six segments. With `total` larger than the sum, the rest of the ring stays
empty, which makes a meter (occupancy, conversion).

```tsx
<Donut
  segments={[{ label: "Occupied", value: 72.4 }]}
  total={100}
  centerLabel="72.4%"
  centerCaption="occupied"
  accessibilityLabel="Occupancy 72.4%: 18 of 25 spaces in use."
/>

<Donut
  label="Quotations"
  segments={[
    { label: "Converted", value: 12 },
    { label: "Open", value: 19 },
    { label: "Lost", value: 3, tone: "neutral" },
  ]}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `segments` | | `{ label, value, tone?, color? }[]`; zero / negative values are not drawn |
| `total` | sum | the whole; larger than the sum leaves the rest of the ring empty |
| `size` / `thickness` | 120 / 12 | dp |
| `centerLabel` / `centerCaption` | | figure in the middle ("72%") and the small text under it |
| `legend` | 2+ segments | column legend with values under the ring |
| `label` / `accessibilityLabel` / `formatValue` | | see the rules above |

Segments are separated by a 2 dp surface gap. Prefer a bar list for comparing close values.

## BarChart

Vertical columns; grouped when there is more than one series. Max 24 dp per column, 4 dp rounded top, square at the
baseline, 2 dp gap inside a group, solid hairline gridlines with compact ticks. Tapping a column shows its values in
a line above the plot (the latest column is shown first); set `selectable={false}` when the figures are already
listed next to the chart.

```tsx
<BarChart
  label="Invoiced and paid by month"
  series={[{ label: "Invoiced" }, { label: "Paid" }]}
  data={months.map(m => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.invoiced, m.paid] }))}
  formatValue={money}
  emptyText="Nothing invoiced in these months."
/>
```

| Prop | Default | |
| --- | --- | --- |
| `data` | | `{ label, title?, values }[]`: `label` under the column ("Oct"), `title` for the readout and screen readers ("Oct 2026"), one value per series |
| `series` | | `{ label, tone?, color? }[]`, 1 to 3 (stacked: up to 6, each with its own `color` / `tone`) |
| `stacked` | false | one column per item with the series stacked bottom to top (parts of a whole); the axis covers the totals and the readout / column buttons start with the total |
| `height` | 160 | plot height in dp (the label band under it is extra) |
| `formatValue` / `formatTick` | grouped digits / compact | readout + summary / y-axis |
| `tickCount` | 4 | about how many gridline intervals |
| `legend` | 2+ series | |
| `selectable` | true | tap-to-read line above the plot |
| `emptyText` | "Nothing to show for this period." | shown when every value is 0 |
| `onPressItem` | | `(index) => void`: tap a column to open it (drill-down); each column becomes a button |
| `itemAccessibilityHint` | "Opens the breakdown" | spoken after a column's values when `onPressItem` is set |

Stacked columns (the Sales Manager's tour inquiries by Type per month) take their colours from the theme, never hex
codes from a screen: `color: colorOf("Website")` with `useInquiryTypeColors()`. Only the top part has rounded corners;
parts are separated by a 1 dp gap.

```tsx
<BarChart
  stacked
  label="Tour inquiries by type, last 12 months"
  series={INQUIRY_TYPES.map(t => ({ label: INQUIRY_TYPE_LABELS[t], color: colorOf(t) }))}
  data={months.map(m => ({ label: monthShort(m.month), title: monthLabel(m.month), values: INQUIRY_TYPES.map(t => m.counts[t]) }))}
/>
```

`label` is the short axis text ("Oct"), `title` the full name ("Oct 2026"); the dashboard builds them from the API's
`yyyy-MM` months. Category labels thin out automatically when they would collide (every 2nd, 3rd... label, always
keeping the latest).

## HBarList

Labelled horizontal bars, one per row, each with its value as text at the end: pipeline stages, locations compared.
One colour for every bar unless a bar has a reason to differ (de-emphasise with `tone: "neutral"`).

```tsx
<HBarList
  label="Pipeline this month"
  items={[
    { label: "Sent", value: 10 },
    { label: "Converted", value: 12 },
    { label: "Lost", value: 3, tone: "neutral" },
  ]}
/>

<HBarList
  label="Occupancy by space type"
  max={100}
  items={types.map(t => ({ label: t.name, value: t.pct, valueLabel: `${t.pct}% · ${t.occupied}/${t.total}` }))}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `items` | | `{ key?, label, value, valueLabel?, detail?, tone?, color? }[]` |
| `max` | largest value | value of a full bar (100 for percentages) |
| `formatValue` | grouped digits | value text when an item has no `valueLabel` |
| `barHeight` | 8 | dp |
| `emptyText` | "Nothing to show." | shown when there are no items |
| `onPressItem` | | `(item, index) => void`: tap a row to open it (drill-down); rows become buttons with a chevron |
| `itemAccessibilityHint` | "Opens the breakdown" | spoken after a row's values when `onPressItem` is set |

A non-zero value is never drawn thinner than 4 dp, so it reads differently from zero.

## Sparkline

A small trend line without axes: 2 dp line, a soft wash under it and a dot on the latest value. It scales between
the series' own min and max (it shows shape, not size), so keep the figure next to it.

```tsx
<Sparkline data={months.map(m => m.occupancyPct)} label="Occupancy" />
<Sparkline data={series} tone="warning" height={24} decorative />   // the parent describes the trend
```

Props: `data` (oldest first; 2+ points), `height` (32), `width` (default: the parent's width), `tone` / `color`,
`area` (true), `endDot` (true), `label`, `accessibilityLabel`, `formatValue` (compact numbers), `decorative`
(hidden from screen readers), `style`.

### On StatCard (`trendSeries`)

`StatCard` / `KpiCard` takes an optional `trendSeries?: number[]`. Two or more values draw a decorative sparkline in
the card's tone at the bottom of the card, and the card's accessibility label gains "trend rising over 6 periods,
from 62 to 71, low 58, high 71".

```tsx
<StatCard label="Occupancy" value="72%" sub="18 of 25 spaces in use" icon="business-outline"
  trendSeries={overview.months.slice(-12).map(m => m.occupancyPct)} />
```

## Scale helpers (`src/components/charts/scale.ts`)

Pure functions, unit tested (`__tests__/scale.test.ts`), usable outside the charts:

```ts
niceDomain(0, 1_234_567)        // { min: 0, max: 1_500_000, step: 500_000, ticks: [0, 500K, 1M, 1.5M] }
niceDomain(0, 0)                // { min: 0, max: 1, step: 1, ticks: [0, 1] }  (nothing to show)
niceTicks(62, 71, { includeZero: false })
niceStep(100, 4)                // 25   (1, 2, 2.5 or 5 x 10^n)
linearScale([0, 100], [150, 10])(50)   // 80  (domain -> pixels; SVG y is inverted)
compactLabel(1_250_000)         // "1.25M"     compactLabel(1_250_000, { currency: "PKR" }) -> "PKR 1.25M"
percentOf(18, 25)               // 72  (clamped 0..100; 0 for a zero total)
extent([3, -2, 9])              // [-2, 9]
bandLayout({ count: 6, groupSize: 2, width: 264 })  // slot, barWidth (<= 24), group and bar x positions
labelStep(12, 240, 36)          // 2: show every 2nd category label
trendDirection([62, 65, 71])    // "up" (changes under 2% of the range are "flat")
```

`geometry.ts` holds the SVG path builders (columns, pills, arcs, lines, sparkline points; tested in
`__tests__/geometry.test.ts`) and `summary.ts` the screen-reader summaries (`__tests__/summary.test.ts`).
`motion.ts` exports `useReduceMotion()` and `useMountProgress()` for any new chart.

## Where the staff dashboard uses them

| Section | Role | Chart | Data |
| --- | --- | --- | --- |
| Overview KPI tiles | admin, super admin | `StatCard trendSeries` on Occupancy and Invoiced | `dashboard/overview` `months` (last 12) |
| Overview, Occupancy card | admin, super admin | `Donut` meter + `HBarList` by space type | `occupancyPct`, `occupiedSpaces / totalSpaces`, `spaceTypes` |
| Overview, Invoiced and paid | admin, super admin | grouped `BarChart` + figure table | `months` (last 6): invoiced, paid, occupancy |
| My sales, Pipeline | sales executive | `Donut` (conversion) + `HBarList` (stages) | `dashboard/role` `sales` |
| Next 3 months | all | `BarChart` of expected rent + per-month figures | `dashboard/forecast` `totals` / per location |
| Locations | super admin | `HBarList`, compare by occupancy / invoiced / outstanding | `dashboard/role` `locations` |

## Adding a chart

- Build marks with `react-native-svg`, text with `AppText` (it follows the type scale and the theme).
- Drive the entry animation from one `useMountProgress()` value through `useAnimatedProps`; anything computed per
  frame must be a `"worklet"` function (see `geometry.ts`).
- Give the root `accessible`, `accessibilityRole="image"` and a summary label; hide touch-only helpers from screen
  readers.
- Size from `onLayout` (`useLayoutWidth()`), reserve the final height up front so nothing jumps, and include the
  axis label band in that height.
