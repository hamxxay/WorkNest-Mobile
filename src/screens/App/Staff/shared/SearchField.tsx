import { StyleSheet, View } from "react-native";
import { TextField } from "../../../../components/ui";
import { spacing } from "../../../../theme";

/** Search box above a list (search icon, clear button). Debounce the value with useDebounced. */
export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.wrap}>
      <TextField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        leftIcon="search"
        rightIcon={value ? "close-circle" : undefined}
        rightIconLabel="Clear search"
        onRightIconPress={value ? () => onChangeText("") : undefined}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
});
