import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, BottomSheet, Button, DateField, PressableField, SegmentedControl } from "../../../components/ui";
import {
  EARLIEST_DAY,
  PERIOD_OPTIONS,
  checkRange,
  parseDay,
  rangeDraft,
  rangeHint,
  rangeLabel,
  ymd,
  type CeoPeriod,
  type DashRange,
} from "../../../services/ceo";
import { spacing } from "../../../theme";

// The period selector of the CEO and Sales Manager dashboards: This month | Quarter | Year | Custom. Custom opens a
// From / To editor (a sheet with the app's date fields), checked as the API checks it (both dates, from on or before
// to, at most 366 days, not after today, 2000 or later) and applied only when valid; the chosen range then shows under
// the selector and opens the editor again. Choosing a calendar period keeps the range, so Custom reopens with it.

export type PeriodControlProps = {
  period: CeoPeriod;
  /** The custom range (kept while a calendar period is chosen). */
  range: DashRange | null;
  /** A calendar period (range unchanged), or "custom" with the range just applied. */
  onChange: (period: CeoPeriod, range: DashRange | null) => void;
  /** The editor opened or closed (the dashboard's auto refresh waits while it is open). */
  onEditingChange?: (editing: boolean) => void;
};

export function PeriodControl({ period, range, onChange, onEditingChange }: PeriodControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DashRange>(() => rangeDraft(period, range));
  const [error, setError] = useState<string | null>(null);

  const show = (next: boolean) => {
    setOpen(next);
    onEditingChange?.(next);
  };
  const openEditor = () => {
    setDraft(rangeDraft(period, range));
    setError(null);
    show(true);
  };
  const close = () => {
    setError(null);
    show(false);
  };
  const apply = () => {
    const problem = checkRange(draft.from, draft.to, ymd(new Date()));
    if (problem) {
      setError(problem);
      return;
    }
    show(false);
    onChange("custom", { from: draft.from, to: draft.to });
  };
  const setDay = (key: keyof DashRange) => (date: Date) => {
    setDraft((d) => ({ ...d, [key]: ymd(date) }));
    setError(null);
  };

  const today = new Date();
  const earliest = parseDay(EARLIEST_DAY) ?? undefined;
  const custom = period === "custom" && !!range;

  return (
    <View style={styles.stack}>
      <SegmentedControl
        accessibilityLabel="Period"
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(next) => (next === "custom" ? openEditor() : onChange(next, range))}
      />
      {custom ? (
        <PressableField
          value={rangeLabel(range)}
          subtitle={rangeHint(range).replace(/\.$/, "")}
          leftIcon="calendar-outline"
          rightIcon="create-outline"
          onPress={openEditor}
          active={open}
          accessibilityLabel="Date range"
          accessibilityHint="Opens the From and To dates"
        />
      ) : null}
      <BottomSheet
        visible={open}
        onClose={close}
        title="Custom date range"
        subtitle="Compared with the same number of days just before it"
        error={error}
        footer={
          <>
            <Button title="Cancel" variant="outline" onPress={close} style={styles.flex} />
            <Button title="Apply" onPress={apply} style={styles.flex} />
          </>
        }
      >
        <View style={styles.fields}>
          <DateField
            label="From"
            required
            value={draft.from}
            onChange={setDay("from")}
            minimumDate={earliest}
            maximumDate={today}
            pickerTitle="From"
          />
          <DateField
            label="To"
            required
            value={draft.to}
            onChange={setDay("to")}
            minimumDate={parseDay(draft.from) ?? earliest}
            maximumDate={today}
            pickerTitle="To"
          />
          <AppText variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            {rangeHint(draft)}
          </AppText>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  fields: { gap: spacing.md },
  flex: { flex: 1 },
});
