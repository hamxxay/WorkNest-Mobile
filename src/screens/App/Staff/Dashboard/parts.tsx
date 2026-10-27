import { Fragment, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  AppText,
  Card,
  Divider,
  ErrorState,
  KpiSkeleton,
  ListRow,
  ResponsiveGrid,
  SectionHeader,
  STAT_CARD_MIN_WIDTH,
  StatCard,
  type StatCardProps,
} from "../../../../components/ui";
import type { AttentionItem } from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { textScale, useMeasuredWidth } from "../../../../utils/responsive";

// Building blocks of the staff dashboard sections.

export const money = (v: number | null | undefined) => formatMoney(v, { compact: true });

/**
 * KPI tiles in as many columns as fit: two per row on phones, four on tablets and unfolded foldables, one on a
 * narrow phone with large text.
 */
export function KpiGrid({ tiles }: { tiles: StatCardProps[] }) {
  return (
    <ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH} gap={spacing.md}>
      {tiles.map((t) => (
        <StatCard key={t.label} {...t} />
      ))}
    </ResponsiveGrid>
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
      <AppText variant="bodyStrong" numberOfLines={2} style={styles.tabular}>
        {value}
      </AppText>
    </View>
  );
}

export type TableColumn = { label: string; flex?: number; align?: "left" | "right" };

/** Width one table column of flex 1 needs at the default font size, before the table scrolls sideways (dp). */
const TABLE_COLUMN_MIN = 64;

/**
 * A compact table of figures under a chart, so every value stays readable as text. Each row is read as one
 * sentence by screen readers ("Oct 2026, Invoiced PKR 1.2M, Paid PKR 900K").
 */
export function FigureTable({ columns, rows }: { columns: TableColumn[]; rows: { key: string; cells: string[] }[] }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [available, onLayout] = useMeasuredWidth(0);
  // Too narrow for every column at this text size (320dp phone, large text): the table keeps a readable width
  // and scrolls sideways inside its card instead of cutting the figures.
  const needed = Math.ceil(columns.reduce((sum, c) => sum + (c.flex ?? 1), 0) * TABLE_COLUMN_MIN * textScale(fontScale));
  const scrolls = available > 0 && needed > available;
  const cellStyle = (c: TableColumn) => [styles.cell, { flex: c.flex ?? 1 }, c.align === "right" ? styles.right : null];
  const table = (
    <View style={[styles.table, scrolls && { width: needed }]}>
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
  return (
    <View onLayout={onLayout}>
      {scrolls ? (
        <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
          {table}
        </ScrollView>
      ) : (
        table
      )}
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
