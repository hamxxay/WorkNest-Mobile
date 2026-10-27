import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BottomSheet, Button, Chip, DateField, FieldLabel, FilterChips, SelectField, type HeaderAction } from "../../../../components/ui";
import { isLocationBound } from "../../../../context/roles";
import {
  LIST_DATE_LABEL,
  NO_LIST_FILTERS,
  activeFilterChips,
  activeFilterCount,
  effectiveListFilters,
  getListStatusOptions,
  parseApiDate,
  statusDisplay,
  toApiDate,
  withFromDate,
  withToDate,
  withoutFilter,
  type ActiveFilterChip,
  type FilteredList,
  type ListFilters,
  type ListStatusOption,
  type StaffLocation,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { useBranchChoice } from "./Branch";
import { useAsyncData } from "./hooks";
import { useStaffSession } from "./StaffSession";

// Location / Status / From-To filters of the staff lists Bookings, Quotations, Invoices, Payments and Customers (the
// CMS list filters). A "Filters" header button (with the number of filters on) opens a sheet; the filters that are
// on show as removable chips under the search box. They are applied on the server together with the search, and a
// change starts the list over from page 1 (usePagedList does that when fetchPage changes).
//   - Location: only the locations the user may see (location-bound staff: their own; super admin: every active
//     one), and only when there is more than one (as the CMS).
//   - Status: the choices of GET {list}/statuses; hidden when there are none or they could not be loaded (as the
//     CMS, e.g. before the database update has run).

export type ListFilterState = {
  /** The filters to send (a location / status that is no longer offered is dropped). */
  filters: ListFilters;
  setFilters: (filters: ListFilters) => void;
  clear: () => void;
  remove: (key: ActiveFilterChip["key"]) => void;
  /** Filters that are on (the date range counts once). */
  count: number;
  active: boolean;
  chips: ActiveFilterChip[];
  /** Location choices; empty when the picker is not shown (one location or none). */
  locationOptions: StaffLocation[];
  allLocationsLabel: string;
  statusOptions: ListStatusOption[];
  dateLabel: string;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  /** The "Filters" button for the AppHeader actions. */
  headerAction: HeaderAction;
};

export function useListFilters(list: FilteredList): ListFilterState {
  const { role } = useStaffSession();
  const { choice } = useBranchChoice();
  const locationOptions = useMemo(() => (choice.options.length > 1 ? choice.options : []), [choice.options]);
  const fetchStatuses = useCallback(() => getListStatusOptions(list), [list]);
  const statuses = useAsyncData(fetchStatuses);
  const [picked, setPicked] = useState<ListFilters>(NO_LIST_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const locationIds = useMemo(() => locationOptions.map((l) => l.id), [locationOptions]);
  const { locationId, status, from, to } = effectiveListFilters(picked, locationIds, statuses.data);
  // One object per distinct value, so a screen's fetchPage (deps: filters) only changes when a filter does.
  const filters = useMemo<ListFilters>(() => ({ locationId, status, from, to }), [locationId, status, from, to]);
  const statusOptions = useMemo(() => statuses.data ?? [], [statuses.data]);
  const dateLabel = LIST_DATE_LABEL[list];
  const count = activeFilterCount(filters);
  const chips = useMemo(
    () => activeFilterChips(filters, { locations: locationOptions, statusOptions, dateLabel }),
    [filters, locationOptions, statusOptions, dateLabel],
  );
  const openSheet = useCallback(() => setSheetOpen(true), []);

  return {
    filters,
    setFilters: setPicked,
    clear: useCallback(() => setPicked(NO_LIST_FILTERS), []),
    remove: useCallback((key: ActiveFilterChip["key"]) => setPicked((prev) => withoutFilter(prev, key)), []),
    count,
    active: count > 0,
    chips,
    locationOptions,
    allLocationsLabel: isLocationBound(role) ? "All my locations" : "All locations",
    statusOptions,
    dateLabel,
    sheetOpen,
    openSheet,
    closeSheet: useCallback(() => setSheetOpen(false), []),
    headerAction: {
      icon: "options-outline",
      accessibilityLabel: count ? `Filters, ${count} on` : "Filters",
      badge: count,
      onPress: openSheet,
    },
  };
}

/** The filters that are on, as removable chips (nothing when none is on), with Clear all. */
export function ActiveFilterChips({ state, style }: { state: ListFilterState; style?: StyleProp<ViewStyle> }) {
  if (!state.chips.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Filters on"
      style={styles.chipBar}
      contentContainerStyle={[styles.chips, style]}
    >
      {state.chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          selected
          onPress={state.openSheet}
          onRemove={() => state.remove(chip.key)}
          accessibilityLabel={`${chip.label}. Change filters`}
        />
      ))}
      {state.chips.length > 1 ? <Button title="Clear all" variant="ghost" size="sm" onPress={state.clear} /> : null}
    </ScrollView>
  );
}

/** The Filters sheet (rendered while open): changes are kept in the sheet until Apply. */
export function ListFilterSheet({ state }: { state: ListFilterState }) {
  return state.sheetOpen ? <FilterSheet state={state} /> : null;
}

function FilterSheet({ state }: { state: ListFilterState }) {
  // Starts from the filters that are on each time the sheet opens.
  const [draft, setDraft] = useState<ListFilters>(state.filters);

  const apply = () => {
    state.setFilters(draft);
    state.closeSheet();
  };
  const clearAll = () => {
    state.clear();
    state.closeSheet();
  };
  const fromDate = parseApiDate(draft.from);
  const toDate = parseApiDate(draft.to);
  const statusChoices = [
    { label: "All statuses", value: "" },
    ...state.statusOptions.map((o) => ({ label: statusDisplay(o.label), value: o.value })),
  ];

  return (
    <BottomSheet
      visible
      onClose={state.closeSheet}
      title="Filters"
      footer={
        <>
          <Button title="Clear all" variant="outline" onPress={clearAll} disabled={!state.active && activeFilterCount(draft) === 0} style={styles.flex} />
          <Button title="Apply" onPress={apply} style={styles.flex} />
        </>
      }
    >
      <View style={styles.body}>
        {state.locationOptions.length ? (
          <SelectField
            label="Location"
            value={draft.locationId ?? 0}
            options={[
              { label: state.allLocationsLabel, value: 0 },
              ...state.locationOptions.map((l) => ({ label: l.name, value: l.id, description: l.cityName ?? undefined })),
            ]}
            onChange={(id) => setDraft((d) => ({ ...d, locationId: id > 0 ? id : null }))}
            leftIcon="location-outline"
            sheetTitle="Choose the location"
          />
        ) : null}
        {state.statusOptions.length ? (
          <View style={styles.group}>
            <FieldLabel label="Status" />
            <FilterChips
              value={draft.status ?? ""}
              onChange={(value) => setDraft((d) => ({ ...d, status: value || null }))}
              options={statusChoices}
              scrollable={false}
              accessibilityLabel="Status"
            />
          </View>
        ) : null}
        <DateField
          label={`${state.dateLabel} from`}
          value={fromDate}
          onChange={(date) => setDraft((d) => withFromDate(d, toApiDate(date)))}
          onClear={draft.from ? () => setDraft((d) => withFromDate(d, null)) : undefined}
          maximumDate={toDate ?? undefined}
          placeholder="Any date"
          pickerTitle={`${state.dateLabel} from`}
          accessibilityLabel={`${state.dateLabel} from`}
        />
        <DateField
          label={`${state.dateLabel} to`}
          value={toDate}
          onChange={(date) => setDraft((d) => withToDate(d, toApiDate(date)))}
          onClear={draft.to ? () => setDraft((d) => withToDate(d, null)) : undefined}
          minimumDate={fromDate ?? undefined}
          placeholder="Any date"
          pickerTitle={`${state.dateLabel} to`}
          accessibilityLabel={`${state.dateLabel} to`}
        />
      </View>
    </BottomSheet>
  );
}

/** Empty list text: with filters on, say so and offer to clear them. */
export function filteredEmpty(
  state: ListFilterState,
  noun: string,
  search: string,
): { illustration: "search"; title: string; message: string; actionLabel: string; onAction: () => void } | null {
  if (!state.active) return null;
  return {
    illustration: "search",
    title: `No ${noun} found`,
    message: search ? `Nothing matches "${search}" with these filters.` : "Nothing matches these filters.",
    actionLabel: "Clear filters",
    onAction: state.clear,
  };
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, gap: spacing.sm, alignItems: "center" },
  body: { gap: spacing.lg },
  group: { gap: spacing.sm },
  flex: { flex: 1 },
});
