import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { TextField } from "../../../../components/ui";
import { spacing } from "../../../../theme";

/**
 * Search box above a list (search icon, clear button). Debounce the value with useDebounced. Pinned above a list it
 * pads itself like the screen; inside a list header (short windows, see useShortWindow) pass a `style` without
 * that padding, since the list already pads its content.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
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
