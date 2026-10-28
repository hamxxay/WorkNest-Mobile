import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  Banner,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SelectField,
  StatusPill,
  useToast,
} from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  attendanceErrorMessage,
  employeeShiftText,
  getAttendanceEmployees,
  getAttendanceShifts,
  setEmployeeShift,
  shiftTimesText,
  type AttendanceEmployee,
  type AttendanceShift,
} from "../../../../services/attendanceService";
import { SectionScroll } from "./SectionScroll";

/** The picker's value for "no own shift" (sent as shiftId null: the default shift then applies, if there is one). */
const NO_OWN_SHIFT = 0;

/**
 * Employees: the customer's employees with their rooms, whether WorkNest has enrolled them on the machine, and the
 * shift each one works (PUT employees/{personId}/shift). Employees are added on a booking (My Bookings → Employees)
 * and enrolled by WorkNest; nothing about that is changed here.
 */
export function EmployeesSection() {
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextEmployees, nextShifts] = await Promise.all([getAttendanceEmployees(), getAttendanceShifts()]);
      setEmployees(nextEmployees);
      setShifts(nextShifts);
      setError("");
    } catch (err) {
      setError(attendanceErrorMessage(err, "Your employees could not be loaded."));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const defaultShift = shifts.find((s) => s.isDefault) ?? null;
  const options = [
    {
      label: defaultShift ? `Default shift (${defaultShift.name})` : "No shift",
      value: NO_OWN_SHIFT,
      description: defaultShift ? shiftTimesText(defaultShift) : "Only in, out and hours are shown",
    },
    ...shifts.map((s) => ({ label: s.name, value: s.id, description: shiftTimesText(s) })),
  ];

  const pick = async (e: AttendanceEmployee, value: number) => {
    const current = e.usesDefaultShift || !e.shiftId ? NO_OWN_SHIFT : e.shiftId;
    if (value === current || savingId) return;
    setSavingId(e.personId);
    try {
      const message = await setEmployeeShift(e.personId, value === NO_OWN_SHIFT ? null : value);
      toast.success(message ?? `${e.name}'s shift is saved.`);
      await load();
    } catch (err) {
      toast.error(attendanceErrorMessage(err, "The shift could not be saved."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SectionScroll onRefresh={load}>
      <Banner
        tone="info"
        message="Employees are added from My Bookings → Employees, and WorkNest enrols their fingerprint on your room's machine."
      />

      {!loaded ? (
        <ListSkeleton rows={3} avatar={false} />
      ) : error ? (
        <Card>
          <ErrorState compact title="Could not load your employees" message={error} onRetry={load} retrying={loading} />
        </Card>
      ) : !employees.length ? (
        <Card>
          <EmptyState
            compact
            icon="people-outline"
            title="No employees yet"
            message="Add your employees on your booking (My Bookings → Employees)."
          />
        </Card>
      ) : (
        employees.map((e) => (
          <Card key={e.personId}>
            <View style={styles.body}>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {e.name}
                  </AppText>
                  {e.idNumberMasked ? (
                    <AppText variant="bodySmall" color="textMuted">
                      {e.idNumberMasked}
                    </AppText>
                  ) : null}
                </View>
                {!e.active ? (
                  <StatusPill tone="neutral" label="Removed" />
                ) : e.enrolled ? (
                  <StatusPill tone="success" label="Enrolled" icon="finger-print-outline" />
                ) : (
                  <StatusPill tone="warning" label="Not enrolled" />
                )}
              </View>
              <AppText variant="bodySmall" color="textSecondary">
                {e.rooms.length ? e.rooms.join(", ") : "No room"}
              </AppText>
              {e.active ? (
                <SelectField
                  label="Shift"
                  value={e.usesDefaultShift || !e.shiftId ? NO_OWN_SHIFT : e.shiftId}
                  options={options}
                  onChange={(v) => pick(e, v)}
                  sheetTitle={`Shift for ${e.name}`}
                  loading={savingId === e.personId}
                  disabled={!!savingId}
                />
              ) : (
                <AppText variant="bodySmall" color="textMuted">
                  {`Shift: ${employeeShiftText(e, shifts)}`}
                </AppText>
              )}
            </View>
          </Card>
        ))
      )}
    </SectionScroll>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { gap: t.spacing.sm },
    head: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm },
  });
