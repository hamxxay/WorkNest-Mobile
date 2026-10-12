import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, useThemeMode, type ThemeMode } from "../../theme";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";

const OPTIONS: ReadonlyArray<SegmentOption<ThemeMode>> = [
  { label: "System", value: "system", icon: "phone-portrait-outline", accessibilityLabel: "Use system setting" },
  { label: "Light", value: "light", icon: "sunny-outline", accessibilityLabel: "Light mode" },
  { label: "Dark", value: "dark", icon: "moon-outline", accessibilityLabel: "Dark mode" },
];

export type AppearanceSettingProps = {
  /** Default "Appearance". Pass null to hide the title row. */
  title?: string | null;
  /** Default explains the System option. Pass null to hide. */
  description?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * System / Light / Dark switch, saved on the device. Drop it into a profile or settings screen:
 *   <Card><AppearanceSetting /></Card>
 */
export function AppearanceSetting({
  title = "Appearance",
  description = "System follows your phone's light or dark setting.",
  style,
}: AppearanceSettingProps) {
  const { colors, typography } = useTheme();
  const { mode, setMode } = useThemeMode();
  return (
    <View style={[styles.wrap, style]}>
      {title ? (
        <Text accessibilityRole="header" style={[typography.subheading, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      {description ? <Text style={[typography.caption, { color: colors.textMuted }]}>{description}</Text> : null}
      <SegmentedControl
        options={OPTIONS}
        value={mode}
        onChange={setMode}
        accessibilityLabel={title ?? "Appearance"}
        style={styles.control}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  control: { marginTop: 8 },
});
