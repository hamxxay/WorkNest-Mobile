import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  Banner,
  Button,
  Card,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  ListRow,
  ListSkeleton,
  ResponsiveGrid,
  SectionHeader,
  SelectField,
  STAT_CARD_MIN_WIDTH,
  StatCard,
} from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  addDays,
  attendanceErrorMessage,
  attendanceToday,
  dayNotes,
  durationText,
  getAttendanceEmployees,
  getAttendanceReport,
  inOutText,
  MAX_REPORT_DAYS,
  rangeDays,
  thisMonthRange,
  totalSummary,
  validateRange,
  type AttendanceEmployee,
  type AttendanceReport,
  type AttendanceSummary,
} from "../../../../services/attendanceService";
import { formatDate, parseDate, toYmdLocal } from "../../../../utils/format";
import { AttendanceStatusPill } from "./AttendanceStatusPill";
import { SectionScroll } from "./SectionScroll";

/** Day rows shown at first (and added per "Show more"): 62 days x many employees is a long list. */
const DAY_PAGE = 60;

/**
 * Report: a date range (this month by default, at most 62 days), an employee filter, the summary (all employees
 * together, or the chosen one) and the days, newest first. Days without scans are only listed for employees with
 * a shift (Absent / Holiday / Off day); the API decides every status.
 */
export function ReportSection() {
  const styles = useThemedStyles(createStyles);
  const [range, setRange] = useState(() => thisMonthRange());
  const [personId, setPersonId] = useState(0);
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(DAY_PAGE);
  // Only the answer for the latest range / employee is applied.
  const request = useRef(0);

  const rangeError = validateRange(range.from, range.to);

  const load = useCallback(async () => {
    if (validateRange(range.from, range.to)) return;
    const seq = ++request.current;
    setLoading(true);
    try {
      const next = await getAttendanceReport(range.from, range.to, personId || null);
      if (seq !== request.current) return;
      setReport(next);
      setError("");
      setShown(DAY_PAGE);
    } catch (err) {
      if (seq !== request.current) return;
      setReport(null);
      setError(attendanceErrorMessage(err, "The attendance report could not be loaded."));
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }, [range.from, range.to, personId]);

  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await getAttendanceEmployees());
    } catch {
      // The filter then offers "All employees" only; the report shows its own error.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // A new end keeps the range within MAX_REPORT_DAYS by moving the other end along.
  const onFrom = (picked: Date) => {
    const from = toYmdLocal(picked);
    if (!from) return;
    setRange((r) => {
      let to = r.to < from ? from : r.to;
      if (rangeDays(from, to) > MAX_REPORT_DAYS) to = addDays(from, MAX_REPORT_DAYS - 1);
      return { from, to };
    });
  };
  const onTo = (picked: Date) => {
    const to = toYmdLocal(picked);
    if (!to) return;
    setRange((r) => {
      let from = r.from > to ? to : r.from;
      if (rangeDays(from, to) > MAX_REPORT_DAYS) from = addDays(to, -(MAX_REPORT_DAYS - 1));
      return { from, to };
    });
  };

  const today = parseDate(attendanceToday()) ?? undefined;
  const summaryRows = report?.summary ?? [];
  const summary: AttendanceSummary | null = report
    ? personId
      ? summaryRows.find((s) => s.personId === personId) ?? totalSummary([])
      : totalSummary(summaryRows)
    : null;
  const days = report?.days ?? [];
  const employeeOptions = [
    { label: "All employees", value: 0 },
    ...employees.map((e) => ({ label: e.name, value: e.personId, description: e.active ? undefined : "Removed" })),
  ];

  return (
    <SectionScroll onRefresh={() => Promise.all([load(), loadEmployees()])}>
      <Card>
        <View style={styles.fields}>
          <View style={styles.row}>
            <DateField
              label="From"
              value={range.from}
              onChange={onFrom}
              maximumDate={today}
              containerStyle={styles.flex}
            />
            <DateField label="To" value={range.to} onChange={onTo} containerStyle={styles.flex} />
          </View>
          <SelectField
            label="Employee"
            value={personId}
            options={employeeOptions}
            onChange={(v) => setPersonId(v)}
            searchable={employees.length > 8}
            sheetTitle="Choose an employee"
          />
          {rangeError ? <Banner tone="danger" message={rangeError} /> : null}
        </View>
      </Card>

      {loading && !report ? (
        <>
          <KpiSkeleton count={6} />
          <ListSkeleton rows={4} avatar={false} />
        </>
      ) : error ? (
        <Card>
          <ErrorState compact title="Could not load the report" message={error} onRetry={load} retrying={loading} />
        </Card>
      ) : summary ? (
        <>
          <ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH} maxColumns={3}>
            <StatCard label="Present" value={summary.present} tone="success" icon="checkmark-circle-outline" />
            <StatCard label="Late" value={summary.late} tone="warning" icon="time-outline" sub={summary.halfDay ? `${summary.halfDay} half day` : undefined} />
            <StatCard label="Absent" value={summary.absent} tone="danger" icon="close-circle-outline" />
            <StatCard label="Missing out" value={summary.missingOut} tone="danger" icon="alert-circle-outline" />
            <StatCard label="Hours" value={durationText(summary.workedMinutes)} icon="hourglass-outline" />
            <StatCard label="Overtime" value={durationText(summary.overtimeMinutes)} tone="info" icon="trending-up-outline" />
          </ResponsiveGrid>

          {!personId && summaryRows.length > 1 ? (
            <>
              <SectionHeader title="By employee" />
              <Card padding={0}>
                {summaryRows.map((s, i) => (
                  <View key={s.personId}>
                    {i ? <Divider inset={16} /> : null}
                    <ListRow
                      title={s.name}
                      subtitle={summaryLine(s)}
                      subtitleLines={2}
                      meta={durationText(s.workedMinutes)}
                      chevron
                      onPress={() => setPersonId(s.personId)}
                      accessibilityHint="Shows only this employee's days"
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title="Days" />
          {!days.length ? (
            <Card>
              <EmptyState
                compact
                icon="calendar-outline"
                title="No attendance in these dates"
                message="Days appear once your employees scan on your room's machine."
              />
            </Card>
          ) : (
            <Card padding={0}>
              {days.slice(0, shown).map((d, i) => {
                const inOut = inOutText(d);
                const line = [
                  personId ? null : formatDate(d.date, { weekday: true }),
                  inOut || "No scans",
                  d.workedMinutes !== null ? durationText(d.workedMinutes) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const notes = dayNotes(d).join(" · ");
                return (
                  <View key={`${d.personId}-${d.date}`}>
                    {i ? <Divider inset={16} /> : null}
                    <ListRow
                      title={personId ? formatDate(d.date, { weekday: true }) : d.name}
                      subtitle={notes ? `${line}\n${notes}` : line}
                      subtitleLines={3}
                      right={<AttendanceStatusPill status={d.status} />}
                    />
                  </View>
                );
              })}
              {days.length > shown ? (
                <View style={styles.more}>
                  <Button
                    title={`Show more (${days.length - shown} left)`}
                    variant="ghost"
                    size="sm"
                    onPress={() => setShown((n) => n + DAY_PAGE)}
                  />
                </View>
              ) : null}
            </Card>
          )}
          <AppText variant="caption" color="textMuted">
            Times are from your room's machine (Pakistan time). First scan of the day is the check-in, the last one the
            check-out.
          </AppText>
        </>
      ) : null}
    </SectionScroll>
  );
}

/** "Present 20 · Late 2 · Absent 1 · Missing out 1" (zero counts left out). */
function summaryLine(s: AttendanceSummary): string {
  const parts: [string, number][] = [
    ["Present", s.present],
    ["Late", s.late],
    ["Half day", s.halfDay],
    ["Absent", s.absent],
    ["Missing out", s.missingOut],
  ];
  const line = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${n}`).join(" · ");
  return s.overtimeMinutes > 0 ? `${line || "No days"} · Overtime ${durationText(s.overtimeMinutes)}` : line || "No days";
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    fields: { gap: t.spacing.md },
    row: { flexDirection: "row", gap: t.spacing.md },
    more: { padding: t.spacing.sm, alignItems: "center" },
  });
