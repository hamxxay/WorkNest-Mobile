import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BarChart, useChartColors } from "../../../components/charts";
import { AppText, Card, Divider, KpiSkeleton, ListRow, SectionHeader, StatusPill, type StatCardProps } from "../../../components/ui";
import { count, monthLabel, monthShort, pct, periodWords, shareOf } from "../../../services/ceo";
import {
  SM_COMPLAINT_STATUSES,
  SM_COMPLAINT_STATUS_LABELS,
  avgResolutionText,
  complaintAgeText,
  complaintAgeTone,
  complaintStatusTone,
  countOf,
  salesManagerComplaintsErrorView,
  smComplaintRecords,
  smShowsComplaintBranches,
  type SmActiveComplaint,
  type SmComplaintFilter,
  type SmComplaintStatus,
  type SmComplaints,
} from "../../../services/salesManager";
import { dashboardTrend } from "../../../services/staff/dashboard";
import { spacing, useComplaintStatusColors, useTheme } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { CeoErrorState, ChartCard, ChartGrid, ChartSkeleton, InlineEmpty, SectionEmpty, StaleBanner, type CeoQuery } from "../Ceo/parts";
import { KpiGrid } from "../Staff/Dashboard/parts";
import type { SmDrill } from "./sections";

// The Complaints section of the Sales Manager dashboard (GET api/sales-manager/complaints), last on the screen and
// loaded on its own: when it fails, only this section shows the error (503: "needs the database update SM_03") and
// the rest of the dashboard keeps working. Read-only: cards, the status bar, categories, branches and months open the
// complaints behind them (records/complaints). No money, no emojis; colours follow the light / dark theme.

/** The scope note when the dashboard sends none (a manager who can pick a location). */
const SCOPE_NOTE = "Complaints without a branch (WhatsApp) show under All my locations";

/** "Resolved" waits for the customer's reply: the status bar says so. */
const STATUS_DETAIL: Partial<Record<SmComplaintStatus, string>> = { resolved: "awaiting customer" };

/** Records list titles per status filter. */
const STATUS_TITLES: Record<SmComplaintStatus, string> = {
  open: "Open complaints",
  in_progress: "Complaints in progress",
  resolved: "Resolved, awaiting customer",
  closed: "Closed complaints",
};

/** Nothing at all to show: no complaints now, none in the period and none in the last 12 months. */
export function isEmptyComplaints(c: SmComplaints): boolean {
  const s = c.status;
  return (
    s.open + s.inProgress + s.resolved + s.closed === 0 &&
    c.newInPeriod === 0 &&
    c.resolvedInPeriod === 0 &&
    !c.byCategory.length &&
    !c.oldestActive.length &&
    c.months.every((m) => !m.created && !m.resolved)
  );
}

/**
 * The whole section: heading, the scope note, then skeletons while loading, an error with "Try again" (or
 * "Check again" for the database update), the empty state, or the figures. Figures kept after a failed refresh
 * get a warning above them.
 */
export function ComplaintsBlock({
  query,
  drill,
  periodLabel,
  oneLocation,
  scopeNote = SCOPE_NOTE,
}: {
  query: CeoQuery<SmComplaints>;
  drill: SmDrill;
  /** "October 2026" (the dashboard's while the section loads). */
  periodLabel?: string;
  /** True when the dashboard shows one location (empty-state wording). */
  oneLocation: boolean;
  /** The note under the heading: what the complaints include (smScopeNotes). */
  scopeNote?: string;
}) {
  const { colors } = useTheme();
  const c = query.data;
  const label = c?.periodLabel || periodLabel;
  let body;
  if (query.loading) {
    body = (
      <>
        <KpiSkeleton count={4} />
        <ChartSkeleton />
      </>
    );
  } else if (!c) {
    body = (
      <Card>
        <CeoErrorState compact error={query.error} onRetry={query.reload} describe={salesManagerComplaintsErrorView} />
      </Card>
    );
  } else if (isEmptyComplaints(c)) {
    body = <SectionEmpty title="No complaints" message={oneLocation ? "No complaints for this location yet." : "No complaints at your locations yet."} />;
  } else {
    body = <ComplaintsContent complaints={c} drill={drill} />;
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Complaints" subtitle={["Customer complaints at your locations", label].filter(Boolean).join(" · ")} />
      <View style={styles.note} accessible accessibilityLabel={`Note: ${scopeNote}.`}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <AppText variant="caption" color="textMuted" style={styles.flexShrink}>
          {scopeNote}
        </AppText>
      </View>
      {c && query.error && !query.refreshing ? (
        <StaleBanner error={query.error} describe={salesManagerComplaintsErrorView} what="The complaints below are" />
      ) : null}
      {body}
    </View>
  );
}

/** Cards, status bar, categories, months and the oldest open complaints. */
export function ComplaintsContent({ complaints: c, drill }: { complaints: SmComplaints; drill: SmDrill }) {
  const words = periodWords(drill.scope.period);
  const colorOf = useComplaintStatusColors();
  const recent = c.months.slice(-12);
  const open = (filter: SmComplaintFilter, trail: string[], title: string) =>
    drill.records(smComplaintRecords(filter, drill.scope), ["Complaints", ...trail], title);
  const openStatus = (status: SmComplaintStatus) =>
    open({ status }, [SM_COMPLAINT_STATUS_LABELS[status]], STATUS_TITLES[status]);

  const tiles: StatCardProps[] = [
    {
      label: `New ${words}`,
      value: count(c.newInPeriod),
      sub: countOf(c.reopenedInPeriod, "reopened", "reopened"),
      icon: "chatbox-ellipses-outline",
      tone: "indigo",
      // More complaints is not good news.
      trend: c.newInPeriodPrev != null ? dashboardTrend(c.newInPeriod, c.newInPeriodPrev, "n", false) : undefined,
      trendSeries: recent.map((m) => m.created),
      onPress: () => open({ status: "new_period" }, [`New ${words}`], `New complaints ${words}`),
    },
    {
      label: "Open",
      value: count(c.status.open),
      sub: "waiting for action",
      icon: "alert-circle-outline",
      tone: c.status.open ? "warning" : "success",
      onPress: () => openStatus("open"),
    },
    {
      label: "In progress",
      value: count(c.status.inProgress),
      sub: "being worked on",
      icon: "construct-outline",
      tone: "info",
      onPress: () => openStatus("in_progress"),
    },
    {
      label: `Resolved ${words}`,
      value: count(c.resolvedInPeriod),
      sub: avgResolutionText(c.avgResolutionDays) ?? "resolved or closed",
      icon: "checkmark-done-outline",
      tone: "success",
      trendSeries: recent.map((m) => m.resolved),
      onPress: () => open({ status: "resolved_period" }, [`Resolved ${words}`], `Resolved ${words}`),
    },
  ];

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <StatusCard complaints={c} onOpen={openStatus} />
        <CategoryCard complaints={c} words={words} onOpen={(category) => open({ category }, [category], `Complaints: ${category}`)} />
        {smShowsComplaintBranches(c.byBranch) ? (
          <BranchCard complaints={c} words={words} onOpen={(branch, label) => open({ branch }, [label], `Complaints: ${label}`)} />
        ) : null}
        <ChartCard title="Complaints by month" caption="Created and resolved, last 12 months. Tap a month for the complaints created then.">
          {recent.length ? (
            <BarChart
              label="Complaints created and resolved by month"
              series={[
                { label: "Created", color: colorOf("open") },
                { label: "Resolved", color: colorOf("resolved") },
              ]}
              data={recent.map((m) => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.created, m.resolved] }))}
              formatValue={count}
              emptyText="No complaints in these months."
              itemAccessibilityHint="Opens the complaints created this month"
              onPressItem={(i) => {
                const month = recent[i]?.month;
                if (month) open({ month }, [monthLabel(month)], `Complaints, ${monthLabel(month)}`);
              }}
            />
          ) : (
            <InlineEmpty text="No complaint history yet." />
          )}
        </ChartCard>
        <OldestCard
          complaints={c}
          onOpenAll={() => open({ status: "active" }, ["Open and in progress"], "Open and in progress")}
        />
      </ChartGrid>
    </>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────────────────────────────────

const STATUS_COUNT: Record<SmComplaintStatus, (c: SmComplaints) => number> = {
  open: (c) => c.status.open,
  in_progress: (c) => c.status.inProgress,
  resolved: (c) => c.status.resolved,
  closed: (c) => c.status.closed,
};

/**
 * One stacked bar of every complaint by status now, and a tappable row per status under it. (Counts are `n`, not
 * `value`: the worklets Babel plugin warns about `.value` read inside a style.)
 */
function StatusCard({ complaints: c, onOpen }: { complaints: SmComplaints; onOpen: (status: SmComplaintStatus) => void }) {
  const theme = useTheme();
  const chart = useChartColors();
  const colorOf = useComplaintStatusColors();
  const parts = SM_COMPLAINT_STATUSES.map((status) => ({ status, n: STATUS_COUNT[status](c) }));
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  return (
    <ChartCard title="Status now" caption="Every complaint in scope, not just this period. Tap a status for its list.">
      {total > 0 ? (
        <>
          <View
            style={[styles.stackBar, { backgroundColor: chart.track }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Complaints by status: ${parts.map((p) => `${SM_COMPLAINT_STATUS_LABELS[p.status]} ${count(p.n)}`).join(", ")}`}
          >
            {parts
              .filter((p) => p.n > 0)
              .map((p) => (
                <Pressable
                  key={p.status}
                  onPress={() => onOpen(p.status)}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  style={[styles.segment, { flexGrow: p.n, backgroundColor: colorOf(p.status) }]}
                />
              ))}
          </View>
          <View style={styles.legend}>
            {parts.map((p) => {
              const detail = STATUS_DETAIL[p.status];
              const label = SM_COMPLAINT_STATUS_LABELS[p.status];
              const value = `${count(p.n)} · ${pct(shareOf(p.n, total))}`;
              return (
                <Pressable
                  key={p.status}
                  onPress={() => onOpen(p.status)}
                  accessibilityRole="button"
                  accessibilityLabel={[label, detail, value].filter(Boolean).join(", ")}
                  accessibilityHint="Opens these complaints"
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [styles.legendRow, pressed && styles.pressed]}
                >
                  <View style={[styles.dot, { backgroundColor: colorOf(p.status) }]} />
                  <View style={styles.flex}>
                    <AppText variant="bodySmall" numberOfLines={1}>
                      {label}
                    </AppText>
                    {detail ? (
                      <AppText variant="caption" color="textMuted" numberOfLines={1}>
                        {detail}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="captionStrong" numberOfLines={2} style={[styles.tabular, styles.value]}>
                    {value}
                  </AppText>
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <InlineEmpty text="No complaints yet." />
      )}
    </ChartCard>
  );
}

// ─── By category ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * A row per category: open (orange) and in progress (blue) now as one bar, scaled to the busiest category, with
 * how many came in during the period.
 */
function CategoryCard({ complaints: c, words, onOpen }: { complaints: SmComplaints; words: string; onOpen: (category: string) => void }) {
  const theme = useTheme();
  const chart = useChartColors();
  const colorOf = useComplaintStatusColors();
  const max = Math.max(0, ...c.byCategory.map((k) => k.open + k.inProgress));
  return (
    <ChartCard title="By category" caption={`Open and in progress now, and new ${words}. Tap a category for its complaints.`}>
      {c.byCategory.length ? (
        <View style={styles.categories}>
          {c.byCategory.map((k, i) => {
            const active = k.open + k.inProgress;
            const value = `${count(active)} active · ${count(k.total)} new`;
            const detail = active ? `${count(k.open)} open · ${count(k.inProgress)} in progress` : null;
            const width = (n: number) => (max > 0 && n > 0 ? `${Math.max(2, (n / max) * 100)}%` : "0%") as `${number}%`;
            return (
              <Pressable
                key={`${k.category}-${i}`}
                onPress={() => onOpen(k.category)}
                accessibilityRole="button"
                accessibilityLabel={[k.category, `${count(active)} open or in progress`, detail, `${count(k.total)} new ${words}`].filter(Boolean).join(", ")}
                accessibilityHint="Opens these complaints"
                android_ripple={{ color: theme.colors.ripple }}
                style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
              >
                <View style={styles.categoryTop}>
                  <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.flex}>
                    {k.category}
                  </AppText>
                  <AppText variant="captionStrong" numberOfLines={2} style={[styles.tabular, styles.value]}>
                    {value}
                  </AppText>
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                </View>
                <View style={[styles.categoryBar, { backgroundColor: chart.track }]}>
                  {k.open > 0 ? <View style={{ width: width(k.open), backgroundColor: colorOf("open") }} /> : null}
                  {k.inProgress > 0 ? <View style={{ width: width(k.inProgress), backgroundColor: colorOf("in_progress") }} /> : null}
                </View>
                {detail ? (
                  <AppText variant="caption" color="textMuted">
                    {detail}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <InlineEmpty text={`No complaints by category ${words}.`} />
      )}
    </ChartCard>
  );
}

// ─── By branch ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A compact row per branch ("No branch" = WhatsApp complaints): open and in progress now, new in the period. Only
 * shown when the complaints span more than one branch or include some without one. A row opens every complaint of
 * that branch.
 */
function BranchCard({
  complaints: c,
  words,
  onOpen,
}: {
  complaints: SmComplaints;
  words: string;
  onOpen: (branch: string, label: string) => void;
}) {
  return (
    <ChartCard title="By branch" caption={`Open and in progress now, and new ${words}. Tap a branch for its complaints.`} padding={0}>
      {c.byBranch.map((b, i) => {
        const active = b.open + b.inProgress;
        const detail = `${count(b.open)} open · ${count(b.inProgress)} in progress · ${count(b.total)} new ${words}`;
        return (
          <Fragment key={`${b.branch || "none"}-${i}`}>
            {i > 0 ? <Divider inset={16} /> : null}
            <ListRow
              leftIcon={b.branch ? "location-outline" : "chatbubbles-outline"}
              title={b.label}
              subtitle={detail}
              meta={`${count(active)} active`}
              accessibilityLabel={[b.label, `${count(active)} open or in progress`, detail].join(", ")}
              accessibilityHint="Opens this branch's complaints"
              onPress={() => onOpen(b.branch, b.label)}
            />
          </Fragment>
        );
      })}
    </ChartCard>
  );
}

// ─── Oldest open complaints ───────────────────────────────────────────────────────────────────────────────

function activeSubtitle(a: SmActiveComplaint): string {
  return [a.customerName, a.category, a.branch ?? "No branch", a.createdOn ? `since ${formatDate(a.createdOn)}` : null].filter(Boolean).join(" · ");
}

/** The oldest open / in-progress complaints with their status and an age chip (amber from 3 days, red from 7). */
function OldestCard({ complaints: c, onOpenAll }: { complaints: SmComplaints; onOpenAll: () => void }) {
  return (
    <ChartCard title="Oldest open complaints" caption="Open and in progress, oldest first" padding={0}>
      {c.oldestActive.length ? (
        <>
          {c.oldestActive.map((a, i) => {
            const status = a.status ? SM_COMPLAINT_STATUS_LABELS[a.status] : null;
            const age = complaintAgeText(a.ageDays);
            const ageTone = complaintAgeTone(a.ageDays);
            const title = a.complaintNo ?? (a.complaintId ? `Complaint ${a.complaintId}` : "Complaint");
            return (
              <Fragment key={`${a.complaintId ?? a.complaintNo ?? "c"}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <ListRow
                  leftIcon="chatbox-ellipses-outline"
                  leftIconTone={ageTone === "neutral" ? "primary" : ageTone}
                  title={title}
                  subtitle={activeSubtitle(a)}
                  subtitleLines={3}
                  right={
                    <View style={styles.chips}>
                      {status ? <StatusPill label={status} tone={complaintStatusTone(a.status)} size="sm" /> : null}
                      {age ? <StatusPill label={age} tone={ageTone} icon="time-outline" size="sm" /> : null}
                    </View>
                  }
                  accessibilityLabel={[title, activeSubtitle(a), status, age ? (age === "Today" ? "received today" : `${age} old`) : null]
                    .filter(Boolean)
                    .join(", ")}
                />
              </Fragment>
            );
          })}
          <Divider inset={16} />
          <ListRow
            leftIcon="list-outline"
            title={`All open and in progress (${count(c.activeTotal)})`}
            accessibilityHint="Opens every open and in progress complaint"
            onPress={onOpenAll}
          />
        </>
      ) : (
        <View style={styles.padded}>
          <InlineEmpty text="No open complaints" />
        </View>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  note: { flexDirection: "row", alignItems: "center", gap: 4 },
  flexShrink: { flexShrink: 1 },
  flex: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  // The figure next to a label: never more than about half the row, wrapping (large text) instead of pushing the
  // label out.
  value: { flexShrink: 1, maxWidth: "55%", textAlign: "right" },
  pressed: { opacity: 0.7 },
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  // A segment is at least 4 dp wide so a small count stays visible (and tappable from the rows below).
  stackBar: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", gap: 2 },
  segment: { flexBasis: 0, minWidth: 4 },
  legend: { marginTop: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categories: { gap: spacing.sm },
  categoryRow: { gap: 4, minHeight: 44, justifyContent: "center", paddingVertical: 4 },
  categoryTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  categoryBar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden" },
  chips: { alignItems: "flex-end", gap: 4 },
});
