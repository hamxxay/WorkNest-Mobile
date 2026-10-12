import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppText,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  PressableField,
  TextField,
} from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import { listCustomers, searchCustomers, type StaffCustomer } from "../../../../services/staff";
import { useTheme } from "../../../../theme";
import { useDebounced } from "./hooks";

type Props = {
  label?: string;
  required?: boolean;
  value: StaffCustomer | null;
  onChange: (customer: StaffCustomer) => void;
  error?: string | null;
  disabled?: boolean;
  /** Text to search for when the sheet opens (e.g. a tour inquiry's email). */
  initialQuery?: string;
  /** Shows a "New customer" button in the sheet. */
  onCreateNew?: () => void;
  helperText?: string;
};

/**
 * Customer field with server search (GET customer/search?q=: the first 20 active matches; GET customer for an
 * empty query). Replaces typing a customer id.
 */
export function CustomerPickerField({
  label = "Customer",
  required,
  value,
  onChange,
  error,
  disabled,
  initialQuery = "",
  onCreateNew,
  helperText,
}: Props) {
  const { colors, typography } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const q = useDebounced(query.trim(), 300);
  const [results, setResults] = useState<StaffCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    const request = q ? searchCustomers(q) : listCustomers({ page: 1, limit: 20 }).then((p) => p.items);
    request
      .then((rows) => alive && setResults(rows.filter((c) => c.id > 0)))
      .catch((err) => alive && setLoadError(errorMessage(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, q, attempt]);

  const summary = value ? [value.email, value.phoneNumber].filter(Boolean).join(" · ") : "";

  return (
    <>
      <PressableField
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        disabled={disabled}
        value={value ? value.fullName || value.email : null}
        subtitle={summary}
        placeholder="Search customers"
        leftIcon="person-outline"
        active={open}
        onPress={() => setOpen(true)}
        accessibilityHint="Opens customer search"
      />

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose customer" scrollable={false} fullHeight maxHeight="85%">
        <View style={styles.search}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Name, email, phone or code"
            accessibilityLabel="Search customers"
            leftIcon="search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        {loading && results.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loadError ? (
          <ErrorState compact message={loadError} onRetry={() => setAttempt((n) => n + 1)} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(c) => String(c.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState compact icon="people-outline" title="No customers found" message={q ? `Nothing matches "${q}".` : undefined} />
            }
            renderItem={({ item }) => (
              <ListRow
                avatar={{ name: item.fullName }}
                title={item.fullName || item.email}
                subtitle={[item.company, item.email, item.phoneNumber].filter(Boolean).join(" · ")}
                right={value?.id === item.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
                chevron={false}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
              />
            )}
          />
        )}
        {onCreateNew ? (
          <View style={styles.footer}>
            <AppText variant="caption" color="textMuted" style={[typography.caption, styles.flex]}>
              Not in the list?
            </AppText>
            <Button
              title="New customer"
              variant="outline"
              size="sm"
              leftIcon="person-add-outline"
              onPress={() => {
                setOpen(false);
                onCreateNew();
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: 20, paddingBottom: 8 },
  list: { paddingHorizontal: 8, paddingBottom: 8, flexGrow: 1 },
  center: { paddingVertical: 32, alignItems: "center" },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
});
