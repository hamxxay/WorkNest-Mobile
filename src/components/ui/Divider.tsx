import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

export type DividerProps = {
  /** Left inset in dp (e.g. 72 to line up with list text after an avatar). */
  inset?: number;
  /** Vertical margin above and below. Default 0. */
  spacing?: number;
  vertical?: boolean;
  /** Use the stronger border colour. */
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Hairline separator using the theme border colour. */
export function Divider({ inset = 0, spacing = 0, vertical = false, strong = false, style }: DividerProps) {
  const { colors } = useTheme();
  const color = strong ? colors.borderStrong : colors.border;
  if (vertical) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[styles.vertical, { backgroundColor: color, marginHorizontal: spacing }, style]}
      />
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.horizontal, { backgroundColor: color, marginLeft: inset, marginVertical: spacing }, style]}
    />
  );
}

const styles = StyleSheet.create({
  vertical: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  horizontal: { height: StyleSheet.hairlineWidth },
});
