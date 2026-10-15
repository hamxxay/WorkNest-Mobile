import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, SelectField } from "../../../../components/ui";
import { NO_BRANCH_LABEL, branchChoice, type BranchChoice, type StaffLocation } from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { useStaffSession } from "./StaffSession";

// Branch routing on the Inquiries / Complaints screens: the branch line of a list row and the Branch field of the
// forms. Branches always come from the database (GET location, through the staff session), never a fixed list.

/** The branches the signed-in staff member may choose (one location: fixed; several: theirs; super admin: all active). */
export function useBranchChoice(): {
  choice: BranchChoice<StaffLocation>;
  locations: StaffLocation[];
  loading: boolean;
  error: string | null;
} {
  const { role, profile, locations, locationsLoading, locationsError } = useStaffSession();
  const choice = useMemo(() => branchChoice(role, profile?.locationIds, locations), [role, profile, locations]);
  return { choice, locations, loading: locationsLoading, error: locationsError };
}

/** Location icon + branch name; "No branch" (muted) when the item has none. */
export function BranchLine({ name, style }: { name: string | null; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.line, style]} accessible accessibilityLabel={name ? `Branch ${name}` : NO_BRANCH_LABEL}>
      <Ionicons name="location-outline" size={14} color={name ? colors.textSecondary : colors.textMuted} />
      <AppText variant="caption" color={name ? "textSecondary" : "textMuted"} numberOfLines={1} style={styles.flex}>
        {name ?? NO_BRANCH_LABEL}
      </AppText>
    </View>
  );
}

/**
 * Required Branch field of the add forms. A location-bound user with one location sees it fixed (shown, not
 * changeable); otherwise a picker of the branches they may choose.
 */
export function BranchField({
  choice,
  value,
  onChange,
  loading,
  loadError,
  error,
  disabled,
}: {
  choice: BranchChoice<StaffLocation>;
  value: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  loadError?: string | null;
  error?: string;
  disabled?: boolean;
}) {
  if (choice.fixed) {
    return (
      <SelectField
        label="Branch"
        required
        value={choice.fixed.id}
        options={[{ label: choice.fixed.name, value: choice.fixed.id }]}
        onChange={() => undefined}
        disabled
        leftIcon="location-outline"
        helperText="Your location"
      />
    );
  }
  return (
    <BranchPicker
      label="Branch"
      required
      options={choice.options}
      value={value}
      onChange={onChange}
      loading={loading}
      error={error ?? (!loading && !choice.options.length && loadError ? loadError : undefined)}
      disabled={disabled}
      placeholder="Choose the branch"
    />
  );
}

/** Picker of branches (used to set or change an item's branch, and by BranchField). */
export function BranchPicker({
  label = "Branch",
  required,
  options,
  value,
  onChange,
  loading,
  error,
  helperText,
  disabled,
  placeholder = "Choose the branch",
}: {
  label?: string;
  required?: boolean;
  options: readonly StaffLocation[];
  value: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <SelectField
      label={label}
      required={required}
      value={value}
      options={options.map((l) => ({ label: l.name, value: l.id, description: l.cityName ?? undefined }))}
      onChange={onChange}
      loading={loading}
      error={error}
      helperText={helperText}
      disabled={disabled}
      leftIcon="location-outline"
      placeholder={placeholder}
      emptyText="No branches available"
      sheetTitle="Choose the branch"
    />
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  flex: { flexShrink: 1 },
});
