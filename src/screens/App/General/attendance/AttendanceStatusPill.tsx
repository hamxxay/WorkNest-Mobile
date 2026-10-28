import { StyleSheet, Text, View } from "react-native";
import { StatusPill } from "../../../../components/ui";
import { fontFor, palette, useTheme } from "../../../../theme";
import { dayStatusColor, dayStatusLabel, type AttendanceDayStatus } from "../../../../services/attendanceService";

/**
 * A day's status: Present green, Late amber, Half day orange, Missing out / Absent red (Missing out with an icon so
 * the two read apart), Holiday / Off day grey, Pending blue. Half day has no theme tone, so it is drawn here with
 * the orange ramp in the same shape as StatusPill.
 */
export function AttendanceStatusPill({ status }: { status: AttendanceDayStatus }) {
  const { isDark } = useTheme();
  const color = dayStatusColor(status);
  const label = dayStatusLabel(status);

  if (color === "orange") {
    const fg = isDark ? palette.orange[300] : palette.orange[700];
    return (
      <View
        accessible
        accessibilityLabel={`Status: ${label}`}
        style={[styles.pill, isDark ? styles.orangeDark : styles.orangeLight]}
      >
        <View style={[styles.dot, { backgroundColor: palette.orange[400] }]} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.text, { color: fg }]}>
          {label}
        </Text>
      </View>
    );
  }
  return <StatusPill tone={color} label={label} icon={status === "MissingOut" ? "alert-circle-outline" : undefined} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minHeight: 22,
  },
  orangeLight: { backgroundColor: "rgba(251, 146, 60, 0.16)", borderColor: palette.orange[300] },
  orangeDark: { backgroundColor: "rgba(251, 146, 60, 0.16)", borderColor: "rgba(251, 146, 60, 0.4)" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...fontFor("600"), includeFontPadding: false, flexShrink: 1, fontSize: 12 },
});
