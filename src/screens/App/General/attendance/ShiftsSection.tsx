import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatusPill,
  useConfirm,
  useToast,
} from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  attendanceErrorMessage,
  deleteAttendanceShift,
  durationText,
  getAttendanceShifts,
  shiftTimesText,
  workDaysText,
  type AttendanceShift,
} from "../../../../services/attendanceService";
import { SectionScroll } from "./SectionScroll";
import { ShiftSheet } from "./ShiftSheet";

/**
 * Shifts: the customer's shifts with add / edit (ShiftSheet) and delete. Without any shift the report shows only
 * in, out and hours; with one it also works out late, absent, half day and overtime.
 */
export function ShiftsSection() {
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  // undefined: closed, null: a new shift.
  const [editing, setEditing] = useState<AttendanceShift | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShifts(await getAttendanceShifts());
      setError("");
    } catch (err) {
      setError(attendanceErrorMessage(err, "Your shifts could not be loaded."));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = (message: string | null) => {
    setEditing(undefined);
    toast.success(message ?? "Shift saved.");
    load();
  };

  const remove = async (s: AttendanceShift) => {
    try {
      const ok = await confirm({
        title: `Delete ${s.name}?`,
        message: s.employeeCount
          ? `${s.employeeCount} ${s.employeeCount === 1 ? "employee works" : "employees work"} this shift. This can't be undone.`
          : "This can't be undone.",
        confirmLabel: "Delete shift",
        destructive: true,
        onConfirm: () => deleteAttendanceShift(s.id),
      });
      if (!ok) return;
      toast.success("Shift deleted.");
      load();
    } catch (err) {
      toast.error(attendanceErrorMessage(err, "The shift could not be deleted."));
    }
  };

  return (
    <SectionScroll onRefresh={load}>
      <Button title="Add shift" leftIcon="add-circle-outline" fullWidth onPress={() => setEditing(null)} />

      {!loaded ? (
        <ListSkeleton rows={2} avatar={false} />
      ) : error ? (
        <Card>
          <ErrorState compact title="Could not load your shifts" message={error} onRetry={load} retrying={loading} />
        </Card>
      ) : !shifts.length ? (
        <Card>
          <EmptyState
            compact
            icon="time-outline"
            title="No shifts yet"
            message="Without a shift the report shows in, out and hours. Add one to see late, absent and overtime too."
          />
        </Card>
      ) : (
        shifts.map((s) => (
          <Card key={s.id}>
            <View style={styles.body}>
              <View style={styles.head}>
                <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
                  {s.name}
                </AppText>
                {s.isDefault ? <StatusPill tone="primary" label="Default" /> : null}
                {s.crossesMidnight ? <StatusPill tone="indigo" label="Night shift" icon="moon-outline" /> : null}
              </View>
              <AppText variant="body">{shiftTimesText(s)}</AppText>
              <AppText variant="bodySmall" color="textSecondary">
                {[
                  workDaysText(s.workDays),
                  `Grace ${s.graceMinutes} min`,
                  s.halfDayMinutes ? `Half day under ${durationText(s.halfDayMinutes)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {s.employeeCount === 1 ? "1 employee" : `${s.employeeCount} employees`}
              </AppText>
              <View style={styles.actions}>
                <Button title="Edit" variant="outline" size="sm" leftIcon="create-outline" onPress={() => setEditing(s)} />
                <Button title="Delete" variant="dangerOutline" size="sm" leftIcon="trash-outline" onPress={() => remove(s)} />
              </View>
            </View>
          </Card>
        ))
      )}

      {editing !== undefined ? (
        <ShiftSheet shift={editing} onClose={() => setEditing(undefined)} onSaved={onSaved} />
      ) : null}
    </SectionScroll>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { gap: t.spacing.sm },
    head: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: t.spacing.sm },
    actions: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.xs },
  });
