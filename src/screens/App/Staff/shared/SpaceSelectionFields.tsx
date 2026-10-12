import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, ErrorState, SegmentedControl, SelectField } from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import {
  SPACE_GROUP_LABELS,
  filterSpaces,
  getAllSpaces,
  getFloors,
  getOfferingTypes,
  isSpaceBooked,
  offeringTypesForLocation,
  privateRoomCapacities,
  spaceMonthlyPrice,
  type Floor,
  type OfferingType,
  type SpaceGroup,
  type StaffLocation,
  type StaffSpace,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";

// Location -> space type -> room size -> space -> floor -> offering type pickers, loaded and filtered the way
// the CMS quotation / booking forms do it (GET space?limit=1000 filtered on the device, GET floor?locationId=,
// GET quotation/offering-types filtered by location). Replaces typing space / floor ids.

export type SpaceSelection = {
  locationId: number | null;
  group: SpaceGroup;
  /** Private rooms: seats. */
  capacity: number | null;
  spaceId: number | null;
  floorId: number | null;
  offeringTypeId: number | null;
};

export type SpaceSelectionErrors = Partial<Record<"location" | "space" | "offering", string>>;

export const EMPTY_SPACE_SELECTION: SpaceSelection = {
  locationId: null,
  group: "private",
  capacity: null,
  spaceId: null,
  floorId: null,
  offeringTypeId: null,
};

export type SpaceLookups = {
  spaces: StaffSpace[];
  offeringTypes: OfferingType[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** Spaces and offering types for the form (loaded once). */
export function useSpaceLookups(): SpaceLookups {
  const [spaces, setSpaces] = useState<StaffSpace[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getAllSpaces(), getOfferingTypes()])
      .then(([s, o]) => {
        if (!alive) return;
        setSpaces(s);
        setOfferingTypes(o);
      })
      .catch((err) => alive && setError(errorMessage(err, "Could not load the spaces.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [attempt]);

  return { spaces, offeringTypes, loading, error, reload: () => setAttempt((n) => n + 1) };
}

const GROUP_OPTIONS: { label: string; value: SpaceGroup }[] = [
  { label: "Private", value: "private" },
  { label: "Shared", value: "shared" },
  { label: "Meeting", value: "meeting" },
];

export function SpaceSelectionFields({
  value,
  onChange,
  locations,
  locationsLoading,
  lookups,
  errors = {},
  disabled,
}: {
  value: SpaceSelection;
  onChange: (next: SpaceSelection) => void;
  locations: StaffLocation[];
  locationsLoading: boolean;
  lookups: SpaceLookups;
  errors?: SpaceSelectionErrors;
  disabled?: boolean;
}) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);

  useEffect(() => {
    if (!value.locationId) {
      setFloors([]);
      return undefined;
    }
    let alive = true;
    setFloorsLoading(true);
    getFloors(value.locationId)
      .then((f) => alive && setFloors(f))
      .catch(() => alive && setFloors([]))
      .finally(() => alive && setFloorsLoading(false));
    return () => {
      alive = false;
    };
  }, [value.locationId]);

  const capacities = useMemo(
    () => (value.group === "private" ? privateRoomCapacities(lookups.spaces, value.locationId) : []),
    [lookups.spaces, value.group, value.locationId],
  );
  const spaces = useMemo(
    () => filterSpaces(lookups.spaces, { locationId: value.locationId, group: value.group, capacity: value.capacity }),
    [lookups.spaces, value.locationId, value.group, value.capacity],
  );
  const offerings = useMemo(
    () => offeringTypesForLocation(lookups.offeringTypes, value.locationId),
    [lookups.offeringTypes, value.locationId],
  );

  // Keep the offering type valid for the location (CMS: first available one).
  useEffect(() => {
    if (!offerings.length) return;
    if (!offerings.some((o) => o.id === value.offeringTypeId)) onChange({ ...value, offeringTypeId: offerings[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerings]);

  const update = (patch: Partial<SpaceSelection>) => onChange({ ...value, ...patch });

  if (lookups.error) return <ErrorState compact message={lookups.error} onRetry={lookups.reload} />;

  return (
    <View style={styles.wrap}>
      <SelectField
        label="Location"
        required
        value={value.locationId}
        options={locations.map((l) => ({ label: l.name, value: l.id, description: l.cityName ?? undefined }))}
        onChange={(id) => update({ locationId: id, spaceId: null, floorId: null, capacity: null })}
        loading={locationsLoading}
        error={errors.location}
        leftIcon="location-outline"
        placeholder="Choose a location"
        disabled={disabled}
      />
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">
          Space type
        </AppText>
        <SegmentedControl
          accessibilityLabel="Space type"
          options={GROUP_OPTIONS}
          value={value.group}
          onChange={(g) => update({ group: g, spaceId: null, capacity: null })}
          disabled={disabled}
        />
      </View>
      {value.group === "private" ? (
        <SelectField
          label="Room size"
          value={value.capacity}
          options={capacities.map((c) => ({ label: `${c} ${c === 1 ? "seat" : "seats"}`, value: c }))}
          onChange={(c) => update({ capacity: c, spaceId: null })}
          placeholder={capacities.length ? "Any size" : "No private rooms here"}
          loading={lookups.loading}
          leftIcon="people-outline"
          disabled={disabled || !value.locationId}
        />
      ) : null}
      <SelectField
        label={SPACE_GROUP_LABELS[value.group]}
        required
        value={value.spaceId}
        options={spaces.map((s) => ({
          label: s.name,
          value: s.id,
          description: [
            isSpaceBooked(s) ? (s.bookedTill ? `Booked till ${formatDate(s.bookedTill)}` : "Booked") : "Available",
            s.capacity ? `${s.capacity} seats` : null,
            spaceMonthlyPrice(s) ? formatMoney(spaceMonthlyPrice(s)) : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
        onChange={(id) => {
          const space = lookups.spaces.find((s) => s.id === id);
          update({ spaceId: id, floorId: value.floorId ?? space?.floorId ?? null });
        }}
        loading={lookups.loading}
        error={errors.space}
        leftIcon="business-outline"
        placeholder={value.locationId ? "Choose a space" : "Choose the location first"}
        emptyText={value.locationId ? "No spaces of this type here" : "Choose the location first"}
        searchable
        disabled={disabled || !value.locationId}
      />
      <SelectField
        label="Floor"
        value={value.floorId}
        options={floors.map((f) => ({ label: f.name, value: f.id }))}
        onChange={(id) => update({ floorId: id })}
        loading={floorsLoading}
        leftIcon="layers-outline"
        placeholder={floors.length ? "Choose a floor" : "No floors listed"}
        disabled={disabled || !value.locationId}
      />
      <SelectField
        label="Offering"
        required
        value={value.offeringTypeId}
        options={offerings.map((o) => ({
          label: o.description,
          value: o.id,
          description: o.discountCap ? `Discount up to ${o.discountCap}%` : undefined,
        }))}
        onChange={(id) => update({ offeringTypeId: id })}
        loading={lookups.loading}
        error={errors.offering}
        leftIcon="time-outline"
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  group: { gap: 6 },
});
