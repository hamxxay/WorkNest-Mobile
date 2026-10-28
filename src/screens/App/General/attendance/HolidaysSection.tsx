import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  ListSkeleton,
  TextField,
  useConfirm,
  useToast,
} from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  addAttendanceHoliday,
  attendanceErrorMessage,
  attendanceToday,
  deleteAttendanceHoliday,
  getAttendanceHolidays,
  HOLIDAY_NAME_MAX_LENGTH,
  type AttendanceHoliday,
} from "../../../../services/attendanceService";
import { formatDate, toYmdLocal } from "../../../../utils/format";
import { SectionScroll } from "./SectionScroll";

/**
 * Holidays: the customer's own holidays for a year (there are no WorkNest-wide ones). On a holiday nobody is
 * marked absent; scans on it count as overtime. Add with a date and a name, delete after a confirm.
 */
export function HolidaysSection() {
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const thisYear = Number(attendanceToday().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  // Only the answer for the latest year is applied.
  const request = useRef(0);

  const load = useCallback(async () => {
    const seq = ++request.current;
    setLoading(true);
    try {
      const next = await getAttendanceHolidays(year);
      if (seq !== request.current) return;
      setHolidays(next);
      setError("");
    } catch (err) {
      if (seq !== request.current) return;
      setError(attendanceErrorMessage(err, "Your holidays could not be loaded."));
    } finally {
      if (seq === request.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdded = (date: string, message: string | null) => {
    setAdding(false);
    toast.success(message ?? "Holiday added.");
    const addedYear = Number(date.slice(0, 4));
    if (addedYear !== year) setYear(addedYear);
    else load();
  };

  const remove = async (h: AttendanceHoliday) => {
    try {
      const ok = await confirm({
        title: `Delete ${h.name}?`,
        message: `${formatDate(h.date, { weekday: true })} will count as a normal day again.`,
        confirmLabel: "Delete holiday",
        destructive: true,
        onConfirm: () => deleteAttendanceHoliday(h.id),
      });
      if (!ok) return;
      toast.success("Holiday deleted.");
      load();
    } catch (err) {
      toast.error(attendanceErrorMessage(err, "The holiday could not be deleted."));
    }
  };

  return (
    <SectionScroll onRefresh={load}>
      <View style={styles.yearRow}>
        <IconButton icon="chevron-back" accessibilityLabel="Previous year" variant="tonal" onPress={() => setYear((y) => y - 1)} />
        <AppText variant="subheading" style={styles.year} accessibilityRole="header">
          {String(year)}
        </AppText>
        <IconButton icon="chevron-forward" accessibilityLabel="Next year" variant="tonal" onPress={() => setYear((y) => y + 1)} />
      </View>

      <Button title="Add holiday" leftIcon="add-circle-outline" fullWidth onPress={() => setAdding(true)} />

      {!loaded || (loading && !holidays.length && !error) ? (
        <ListSkeleton rows={3} avatar={false} />
      ) : error ? (
        <Card>
          <ErrorState compact title="Could not load your holidays" message={error} onRetry={load} retrying={loading} />
        </Card>
      ) : !holidays.length ? (
        <Card>
          <EmptyState compact icon="sunny-outline" title={`No holidays in ${year}`} message="Add the days your office is closed." />
        </Card>
      ) : (
        <Card padding={0}>
          {holidays.map((h, i) => (
            <View key={h.id}>
              {i ? <Divider inset={68} /> : null}
              <ListRow
                leftIcon="sunny-outline"
                title={h.name}
                subtitle={formatDate(h.date, { weekday: true })}
                right={
                  <IconButton icon="trash-outline" accessibilityLabel={`Delete ${h.name}`} onPress={() => remove(h)} />
                }
              />
            </View>
          ))}
        </Card>
      )}

      {adding ? (
        <AddHolidaySheet
          initialDate={year === thisYear ? attendanceToday() : `${year}-01-01`}
          onClose={() => setAdding(false)}
          onAdded={onAdded}
        />
      ) : null}
    </SectionScroll>
  );
}

/** Date + name (POST holidays). Stays open with the API's reason when it refuses (e.g. that date already has one). */
function AddHolidaySheet({
  initialDate,
  onClose,
  onAdded,
}: {
  initialDate: string;
  onClose: () => void;
  onAdded: (date: string, message: string | null) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  const close = () => {
    if (!busyRef.current) onClose();
  };

  const save = async () => {
    if (busyRef.current) return;
    if (!name.trim()) {
      setError("Enter a name for the holiday.");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError("");
    try {
      const message = await addAttendanceHoliday(date, name);
      busyRef.current = false;
      onAdded(date, message);
    } catch (err) {
      busyRef.current = false;
      setSaving(false);
      setError(attendanceErrorMessage(err, "The holiday could not be added."));
    }
  };

  return (
    <BottomSheet
      visible
      onClose={close}
      dismissible={!saving}
      title="Add holiday"
      error={error}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={close} disabled={saving} style={styles.flex} />
          <Button title="Add holiday" onPress={save} loading={saving} disabled={saving} haptic style={styles.flex} />
        </>
      }
    >
      <View style={styles.body}>
        <DateField label="Date" value={date} onChange={(d) => setDate(toYmdLocal(d) || date)} disabled={saving} />
        <TextField
          label="Name"
          required
          value={name}
          onChangeText={setName}
          maxLength={HOLIDAY_NAME_MAX_LENGTH}
          placeholder="For example: Iqbal Day"
          disabled={saving}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { gap: t.spacing.md },
    yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: t.spacing.lg },
    year: { minWidth: 64, textAlign: "center" },
  });
