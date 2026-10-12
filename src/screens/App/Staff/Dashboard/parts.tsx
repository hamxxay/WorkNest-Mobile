import { Fragment, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Card, Divider, ErrorState, KpiSkeleton, ListRow, SectionHeader, StatCard, type StatCardProps } from "../../../../components/ui";
import type { AttentionItem } from "../../../../services/staff";
import { spacing, useTheme, type Tone } from "../../../../theme";
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

/** Horizontal bar with a label and value (pipeline stages, monthly amounts). */
export function BarRow({ label, value, pct, tone = "primary" }: { label: string; value: string; pct: number; tone?: Tone }) {
  const { colors, tones } = useTheme();
  const width = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.barTop}>
        <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="captionStrong">{value}</AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${width}%`, backgroundColor: tones[tone].solid }]} />
      </View>
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
  bar: { gap: 4 },
  barTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  empty: { padding: spacing.lg },
});
