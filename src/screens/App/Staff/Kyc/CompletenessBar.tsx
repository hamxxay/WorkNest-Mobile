import { StyleSheet, View } from "react-native";
import { AppText } from "../../../../components/ui";
import { useTheme } from "../../../../theme";

/** KYC completeness: a progress track with the percentage. */
export function CompletenessBar({ percent }: { percent: number }) {
  const { colors, tones } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const fill = pct >= 100 ? tones.success.solid : pct >= 50 ? tones.primary.solid : tones.warning.solid;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="KYC completeness"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
      <AppText variant="captionStrong" color="textSecondary">
        {pct}%
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});
