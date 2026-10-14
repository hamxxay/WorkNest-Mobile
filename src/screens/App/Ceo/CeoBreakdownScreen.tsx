import { Fragment, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BarChart } from "../../../components/charts";
import { AppHeader, AppText, Banner, Card, Divider, EmptyState, ListRow, ListSkeleton, Screen } from "../../../components/ui";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import {
  BREAKDOWN_ROOTS,
  ceoErrorView,
  count,
  getCeoBreakdown,
  isMonthKey,
  metricUnit,
  money,
  monthShort,
  pct,
  recordsForBreakdownRow,
  shareOf,
  type CeoBreakdown,
  type CeoBreakdownQuery,
  type CeoBreakdownRow,
} from "../../../services/ceo";
import { spacing } from "../../../theme";
import { useRefreshColors } from "../Staff/shared/refresh";
import { Breadcrumb, CeoErrorState, ChartSkeleton, useCeoQuery } from "./parts";

type Nav = NativeStackNavigationProp<CeoStackParamList, "CeoBreakdown">;
type Route = RouteProp<CeoStackParamList, "CeoBreakdown">;

/** Occupancy breakdowns show occupied of total spaces. */
const isOccupancy = (query: CeoBreakdownQuery) => query.metric === "occupancy-type" || query.metric === "occupancy-location";

/** "Invoiced PKR 1.2M · Collected PKR 900K · 4 invoices" (occupancy: "72% · 18 of 25 spaces"). */
function rowDetail(query: CeoBreakdownQuery, b: CeoBreakdown, row: CeoBreakdownRow, format: (v: number) => string): string {
  if (isOccupancy(query) && row.value2 != null) {
    return `${pct(shareOf(row.value, row.value2))} · ${count(row.value)} of ${count(row.value2)} spaces in use`;
  }
  const parts = [`${b.valueLabel} ${format(row.value)}`];
  if (row.value2 != null && b.value2Label) parts.push(`${b.value2Label} ${format(row.value2)}`);
  if (row.count != null) parts.push(`${count(row.count)} ${metricUnit(query.metric) === "money" ? (row.count === 1 ? "invoice" : "invoices") : "in total"}`);
  return parts.join(" · ");
}

/**
 * Drill level 2 (GET api/ceo/breakdown): one dashboard element split by location, space type or month, as a small
 * column chart and a list. Tapping a column or a row opens its records (level 3). Read-only.
 */
export default function CeoBreakdownScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel } = params;
  const refreshColors = useRefreshColors();
  const load = useCallback(() => getCeoBreakdown(query), [query]);
  const q = useCeoQuery(load);
  const b = q.data;
  const format = metricUnit(query.metric) === "money" ? money : (v: number) => count(v);

  const openRow = (row: CeoBreakdownRow) => {
    const records = recordsForBreakdownRow(query, row);
    if (records) navigation.push("CeoRecords", { query: records, trail: [...trail, row.label], scopeLabel });
  };

  const rows = b?.rows ?? [];
  const chartRows = rows.slice(0, 12);

  return (
    <Screen>
      <AppHeader title={b?.title ?? BREAKDOWN_ROOTS[query.metric]} />
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
        {b && q.error && !q.refreshing ? (
          <Banner tone="warning" title={ceoErrorView(q.error).title} message={`${ceoErrorView(q.error).message} The figures below are from the last update.`} />
        ) : null}

        {q.loading ? (
          <>
            <ChartSkeleton height={120} />
            <ListSkeleton rows={4} avatar={false} />
          </>
        ) : !b && q.error ? (
          <CeoErrorState error={q.error} onRetry={q.reload} />
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
                series={b.value2Label ? [{ label: b.valueLabel }, { label: b.value2Label }] : [{ label: b.valueLabel }]}
                data={chartRows.map((r) => ({
                  label: isMonthKey(r.key) ? monthShort(r.key) : r.label,
                  title: r.label,
                  values: b.value2Label ? [r.value, r.value2 ?? 0] : [r.value],
                }))}
                formatValue={format}
                emptyText="Nothing to show for this choice."
                itemAccessibilityHint="Opens the list"
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
                const records = recordsForBreakdownRow(query, row);
                return (
                  <Fragment key={`${row.key || row.label}-${i}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={row.label}
                      subtitle={rowDetail(query, b, row, format)}
                      meta={isOccupancy(query) ? undefined : format(row.value)}
                      accessibilityHint={records ? "Opens the list" : undefined}
                      onPress={records ? () => openRow(row) : undefined}
                    />
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
