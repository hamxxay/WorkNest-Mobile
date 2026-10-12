import { Fragment, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Card, Divider, ErrorState, KpiSkeleton, ListRow, SectionHeader, StatCard, type StatCardProps } from "../../../../components/ui";
import type { AttentionItem } from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";

// Building blocks of the staff dashboard sections.

export const money = (v: number | null | undefined) => formatMoney(v, { compact: true });

/** KPI tiles, two per row. */
export function KpiGrid({ tiles }: { tiles: StatCardProps[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <StatCard key={t.label} {...t} style={styles.tile} />
      ))}
    </View>
  );
}

/** A dashboard block: title, then loading skeleton / compact error with retry / content. */
export function Section({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  skeleton = "kpi",
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  skeleton?: "kpi" | "card";
  children: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} actionLabel={action?.label} onAction={action?.onPress} />
      {loading ? (
        skeleton === "kpi" ? <KpiSkeleton count={4} /> : <Card><KpiSkeleton count={2} columns={2} /></Card>
      ) : error ? (
        <Card>
          <ErrorState compact message={error} onRetry={onRetry} />
        </Card>
      ) : (
        children
      )}
    </View>
  );
}

/** A small label-over-value figure (next to a donut). */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

export type TableColumn = { label: string; flex?: number; align?: "left" | "right" };

/**
 * A compact table of figures under a chart, so every value stays readable as text. Each row is read as one
 * sentence by screen readers ("Oct 2026, Invoiced PKR 1.2M, Paid PKR 900K").
 */
export function FigureTable({ columns, rows }: { columns: TableColumn[]; rows: { key: string; cells: string[] }[] }) {
  const { colors } = useTheme();
  const cellStyle = (c: TableColumn) => [styles.cell, { flex: c.flex ?? 1 }, c.align === "right" ? styles.right : null];
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: colors.border }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {columns.map((c) => (
          <AppText key={c.label} variant="caption" color="textMuted" numberOfLines={1} style={cellStyle(c)}>
            {c.label}
          </AppText>
        ))}
      </View>
      {rows.map((r) => (
        <View
          key={r.key}
          style={styles.tableRow}
          accessible
          accessibilityLabel={r.cells.map((cell, i) => (i === 0 ? cell : `${columns[i]?.label ?? ""} ${cell}`)).join(", ")}
        >
          {r.cells.map((cell, i) => (
            <AppText
              key={columns[i]?.label ?? i}
              variant="bodySmall"
              color={i === 0 ? "textSecondary" : "text"}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[cellStyle(columns[i] ?? { label: "" }), styles.tabular]}
            >
              {cell}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A short list of dashboard "needs attention" rows. */
export function AttentionList({
  items,
  empty,
  dateLabel,
  onOpen,
  limit = 5,
}: {
  items: AttentionItem[];
  empty: string;
  dateLabel: string;
  onOpen?: (item: AttentionItem) => void;
  limit?: number;
}) {
  if (!items.length) {
    return (
      <AppText variant="bodySmall" color="textMuted" style={styles.empty}>
        {empty}
      </AppText>
    );
  }
  return (
    <>
      {items.slice(0, limit).map((item, i) => (
        <Fragment key={`${item.bookingId ?? item.reference ?? i}-${i}`}>
          {i > 0 ? <Divider inset={16} /> : null}
          <ListRow
            title={item.customer || item.reference || "Customer"}
            subtitle={[item.space, item.reference, item.date ? `${dateLabel} ${formatDate(item.date)}` : null].filter(Boolean).join(" · ")}
            right={item.amount != null ? <AppText variant="bodySmall">{money(item.amount)}</AppText> : undefined}
            onPress={onOpen && item.bookingId ? () => onOpen(item) : undefined}
          />
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { flexBasis: "46%", flexGrow: 1 },
  section: { gap: spacing.sm },
  fact: { gap: 2 },
  table: { gap: 2 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  tableHead: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 6, marginBottom: 2 },
  cell: { minWidth: 0 },
  right: { textAlign: "right" },
  tabular: { fontVariant: ["tabular-nums"] },
  empty: { padding: spacing.lg },
});
