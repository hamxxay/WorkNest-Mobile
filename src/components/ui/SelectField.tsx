import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { fontFor, useTheme } from "../../theme";
import { BottomSheet } from "./BottomSheet";
import { FieldShell, fieldA11yLabel, fieldBoxColors, fieldStyles, type FieldBaseProps } from "./Field";
import { TextField } from "./TextField";

export type SelectOption<T extends string | number> = {
  label: string;
  value: T;
  /** Second line in the list. */
  description?: string;
  /** Ionicons name on the left of the option. */
  icon?: string;
  disabled?: boolean;
};

export type SelectFieldProps<T extends string | number> = FieldBaseProps & {
  value: T | null | undefined;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T, option: SelectOption<T>) => void;
  /** Shown when nothing is selected. Default "Select". */
  placeholder?: string;
  /** Ionicons name inside the box on the left. */
  leftIcon?: string;
  /** Search box in the sheet. Default: on when there are more than 8 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Sheet title. Default: the label. */
  sheetTitle?: string;
  /** Shown in the sheet when no option matches / the list is empty. */
  emptyText?: string;
  /** Options still loading: spinner in the box, sheet shows a spinner. */
  loading?: boolean;
  accessibilityLabel?: string;
};

/**
 * Dropdown replacement: a field that opens a bottom-sheet list (searchable when long).
 *
 *   <SelectField label="Space type" required value={typeId} onChange={setTypeId}
 *     options={types.map(t => ({ label: t.name, value: t.id }))} />
 */
export function SelectField<T extends string | number>({
  label,
  required,
  helperText,
  error,
  disabled = false,
  containerStyle,
  value,
  options,
  onChange,
  placeholder = "Select",
  leftIcon,
  searchable,
  searchPlaceholder = "Search",
  sheetTitle,
  emptyText = "No options",
  loading = false,
  accessibilityLabel,
}: SelectFieldProps<T>) {
  const { colors, typography } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find(o => o.value === value);
  const canSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const box = fieldBoxColors(colors, { focused: open, error: !!error, disabled });
  const spoken = accessibilityLabel ?? fieldA11yLabel(label, required) ?? placeholder;

  return (
    <FieldShell label={label} required={required} helperText={helperText} error={error} disabled={disabled} containerStyle={containerStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${spoken}: ${selected ? selected.label : "not selected"}`}
        accessibilityHint={error ? `Error: ${error}` : "Opens a list of options"}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        android_ripple={{ color: colors.ripple }}
        style={[fieldStyles.box, box, styles.clip]}
      >
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={colors.textMuted} /> : null}
        <Text
          numberOfLines={1}
          style={[typography.body, styles.flex, { color: selected ? (disabled ? colors.textMuted : colors.text) : colors.placeholder }]}
        >
          {selected ? selected.label : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        )}
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={close}
        title={sheetTitle ?? label ?? placeholder}
        scrollable={false}
        fullHeight={canSearch}
        maxHeight="80%"
      >
        {canSearch ? (
          <View style={styles.search}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              leftIcon="search"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={searchPlaceholder}
            />
          </View>
        ) : null}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered as SelectOption<T>[]}
            keyExtractor={o => String(o.value)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[typography.bodySmall, styles.empty, { color: colors.textMuted }]}>{emptyText}</Text>
            }
            renderItem={({ item }) => {
              const isSel = item.value === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel, checked: isSel, disabled: !!item.disabled }}
                  accessibilityLabel={item.description ? `${item.label}, ${item.description}` : item.label}
                  disabled={item.disabled}
                  onPress={() => {
                    onChange(item.value, item);
                    close();
                  }}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.option,
                    isSel && { backgroundColor: colors.primarySoft },
                    pressed && !isSel && { backgroundColor: colors.surfaceAlt },
                    item.disabled && { opacity: 0.45 },
                  ]}
                >
                  {item.icon ? <Ionicons name={item.icon} size={20} color={isSel ? colors.onPrimarySoft : colors.textMuted} /> : null}
                  <View style={styles.flex}>
                    <Text style={[typography.body, { color: isSel ? colors.onPrimarySoft : colors.text }, isSel && styles.bold]}>
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{item.description}</Text>
                    ) : null}
                  </View>
                  {isSel ? <Ionicons name="checkmark" size={20} color={colors.onPrimarySoft} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </BottomSheet>
    </FieldShell>
  );
}

/** Alias for screens that call it a picker. */
export const PickerField = SelectField;
export type PickerFieldProps<T extends string | number> = SelectFieldProps<T>;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: "hidden" },
  search: { paddingHorizontal: 20, paddingBottom: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 8 },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bold: fontFor("600"),
  empty: { textAlign: "center", paddingVertical: 24 },
  center: { paddingVertical: 32, alignItems: "center" },
});
