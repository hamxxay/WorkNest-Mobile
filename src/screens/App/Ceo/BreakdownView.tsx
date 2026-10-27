import { Fragment } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { BarChart } from "../../../components/charts";
import { AppHeader, AppText, Card, Divider, EmptyState, ListRow, ListSkeleton, Screen } from "../../../components/ui";
import { ceoErrorView, isMonthKey, monthShort, type CeoBreakdown, type CeoBreakdownRow } from "../../../services/ceo";
import { spacing } from "../../../theme";
import { useRefreshColors } from "../Staff/shared/refresh";
import { Breadcrumb, CeoErrorState, ChartSkeleton, StaleBanner, useCeoQuery, type DescribeError } from "./parts";

// Drill level 2 of a read-only dashboard (CEO: GET api/ceo/breakdown, Sales Manager: GET api/sales-manager/breakdown):
// one dashboard element split by location, space type or month, as a small column chart and a list. Tapping a
// column or a row opens its records (level 3). The screens (CeoBreakdownScreen, SalesManagerBreakdownScreen) pass
// what differs: how to load, format and describe rows, and which records a row opens.

export type BreakdownViewProps<R> = {
  /** Header title until the breakdown has loaded (the server's title wins). */
  fallbackTitle: string;
  trail: readonly string[];
  scopeLabel?: string;
  /** Loads the breakdown; called again when it changes. Keep it stable (useCallback). */
  load: () => Promise<CeoBreakdown>;
  /** Values as text (money or counts). */
  format: (value: number) => string;
  /**
   * Draw `value2` next to `value` in the chart (default true when the breakdown has a second value). False when the
   * two are in different units (e.g. leases and their monthly PKR value): the list still shows both.
   */
  plotValue2?: boolean;
  /** Second line of a row, e.g. "Invoiced PKR 1.2M · Collected PKR 900K". */
  rowDetail: (breakdown: CeoBreakdown, row: CeoBreakdownRow) => string;
  /** Right-hand figure of a row (default the formatted value); undefined shows none. */
  rowMeta?: (row: CeoBreakdownRow) => string | undefined;
  /** The records a row opens, or null when it opens none (not tappable). */
  recordsFor: (row: CeoBreakdownRow) => R | null;
  /**
   * A second list a row offers (e.g. the leases ending that month next to its bookings), shown as a link under the
   * row; null for none.
   */
  secondaryRecordsFor?: (row: CeoBreakdownRow) => { title: string; subtitle?: string; records: R } | null;
  /** Opens the records of a row. */
  onOpenRecords: (row: CeoBreakdownRow, records: R) => void;
  /** Spoken after a row or column that opens something. Default "Opens the list". */
  rowAccessibilityHint?: string;
  /** Error wording (default the CEO's). */
  describeError?: DescribeError;
};

export function BreakdownView<R>({
  fallbackTitle,
  trail,
  scopeLabel,
  load,
  format,
  plotValue2 = true,
  rowDetail,
  rowMeta = (row) => format(row.value),
  recordsFor,
  secondaryRecordsFor,
  onOpenRecords,
  rowAccessibilityHint = "Opens the list",
  describeError = ceoErrorView,
}: BreakdownViewProps<R>) {
  const refreshColors = useRefreshColors();
  const q = useCeoQuery(load);
  const b = q.data;

  const openRow = (row: CeoBreakdownRow) => {
    const records = recordsFor(row);
    if (records) onOpenRecords(row, records);
  };

  const rows = b?.rows ?? [];
  const chartRows = rows.slice(0, 12);
  const value2Series = plotValue2 && b?.value2Label ? b.value2Label : null;

  return (
    <Screen>
      <AppHeader title={b?.title ?? fallbackTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} {...refreshColors} />}
      >
        <Breadcrumb trail={trail} scopeLabel={scopeLabel} />
        {b?.subtitle ? (
          <AppText variant="bodySmall" color="textSecondary">
            {b.subtitle}
          </AppText>
        ) : null}
        {b && q.error && !q.refreshing ? <StaleBanner error={q.error} describe={describeError} /> : null}

        {q.loading ? (
          <>
            <ChartSkeleton height={120} />
            <ListSkeleton rows={4} avatar={false} />
          </>
        ) : !b && q.error ? (
          <CeoErrorState error={q.error} onRetry={q.reload} describe={describeError} />
        ) : !rows.length ? (
          <Card>
            <EmptyState compact icon="bar-chart-outline" title="Nothing to break down" message="There are no figures for this choice in the period." />
          </Card>
        ) : b ? (
          <>
            <Card>
              <BarChart
                height={120}
                label={b.title}
                series={value2Series ? [{ label: b.valueLabel }, { label: value2Series }] : [{ label: b.valueLabel }]}
                data={chartRows.map((r) => ({
                  label: isMonthKey(r.key) ? monthShort(r.key) : r.label,
                  title: r.label,
                  values: value2Series ? [r.value, r.value2 ?? 0] : [r.value],
                }))}
                formatValue={format}
                emptyText="Nothing to show for this choice."
                itemAccessibilityHint={rowAccessibilityHint}
                onPressItem={(i) => openRow(chartRows[i])}
              />
              {rows.length > chartRows.length ? (
                <AppText variant="caption" color="textMuted" style={styles.note}>
                  The chart shows the first {chartRows.length}; every row is listed below.
                </AppText>
              ) : null}
            </Card>
            <Card padding={0}>
              {rows.map((row, i) => {
                const records = recordsFor(row);
                const secondary = secondaryRecordsFor?.(row) ?? null;
                return (
                  <Fragment key={`${row.key || row.label}-${i}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={row.label}
                      subtitle={rowDetail(b, row)}
                      meta={rowMeta(row)}
                      metaVariant="amount"
                      accessibilityHint={records ? rowAccessibilityHint : undefined}
                      onPress={records ? () => openRow(row) : undefined}
                    />
                    {secondary ? (
                      <ListRow
                        leftIcon="list-outline"
                        title={secondary.title}
                        subtitle={secondary.subtitle}
                        accessibilityLabel={[row.label, secondary.title, secondary.subtitle].filter(Boolean).join(", ")}
                        accessibilityHint="Opens the list"
                        onPress={() => onOpenRecords(row, secondary.records)}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  note: { marginTop: spacing.sm },
});
