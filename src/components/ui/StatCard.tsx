import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { fontFor, useTheme, type Tone } from "../../theme";
import { SkeletonBlock, SkeletonGroup } from "../Skeleton";
import { PRESS_SCALE, ScalePressable } from "../motion/ScalePressable";
import { Sparkline } from "../charts/Sparkline";
import { describeTrend, splitTrendLabel } from "../charts/summary";
import { STAT_CARD_MIN_WIDTH } from "../../utils/responsive";

export type StatTrend = {
  direction: "up" | "down" | "flat";
  /** e.g. "+12% vs last month". */
  label: string;
  /** Whether "up" is good (green). Default true; set false for things like "Overdue". */
  upIsGood?: boolean;
};

export type StatCardProps = {
  label: string;
  value: string | number;
  /** Small line under the value, e.g. "3 due this week". */
  sub?: string;
  /** Colour family for the icon well and accent. Default "primary". */
  tone?: Tone;
  /** Ionicons name. */
  icon?: string;
  trend?: StatTrend;
  onPress?: () => void;
  /** Spoken after the card when it is pressable: what pressing it opens ("Opens invoiced this month by location"). */
  accessibilityHint?: string;
  /** Shows a skeleton instead of the value. */
  loading?: boolean;
  /** Recent values, oldest first (e.g. the last 6 months). Two or more draw a sparkline at the bottom of the card. */
  trendSeries?: number[];
  style?: StyleProp<ViewStyle>;
};

/** Narrowest a StatCard should get at the default font size (dp): the column width ResponsiveGrid / KpiGrid use. */
export { STAT_CARD_MIN_WIDTH };

/**
 * KPI tile for dashboards: a small muted label with the icon, the big value (tabular figures), a delta chip against
 * the previous period (arrow, green when the change is good, red when it is bad), a small secondary line and an
 * optional sparkline at the bottom. Lay several out with `<ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH}>` (two
 * per row on phones, four on tablets, one on a narrow phone with large text) rather than a fixed row.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "primary",
  icon,
  trend,
  onPress,
  accessibilityHint,
  loading = false,
  trendSeries,
  style,
}: StatCardProps) {
  const { colors, tones, typography, radii, shadows } = useTheme();
  const t = tones[tone];
  const hasSeries = !!trendSeries && trendSeries.length > 1;

  // Delta chip: soft tone fill, arrow + figure in the tone's text colour; the comparison follows in muted text.
  let delta = tones.neutral;
  let deltaIcon = "remove";
  if (trend && trend.direction !== "flat") {
    const good = (trend.direction === "up") === (trend.upIsGood ?? true);
    delta = good ? tones.success : tones.danger;
    deltaIcon = trend.direction === "up" ? "arrow-up" : "arrow-down";
  }
  const trendText = trend ? splitTrendLabel(trend.label) : null;

  const body = (
    <>
      <View style={styles.top}>
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.iconWell, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={16} color={t.fg} />
          </View>
        ) : null}
      </View>
      {loading ? (
        <SkeletonGroup style={styles.skeleton}>
          <SkeletonBlock width="55%" height={26} radius={6} />
          {sub ? <SkeletonBlock width="75%" height={12} radius={4} /> : null}
        </SkeletonGroup>
      ) : (
        <>
          <Text style={[typography.kpi, styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </Text>
          {trend && trendText ? (
            <View style={styles.trend}>
              <View style={[styles.chip, { backgroundColor: delta.bg }]}>
                <Ionicons name={deltaIcon} size={12} color={delta.fg} />
                <Text style={[typography.captionStrong, styles.tabular, { color: delta.fg }]} numberOfLines={1}>
                  {trendText.figure}
                </Text>
              </View>
              {trendText.versus ? (
                <Text style={[typography.caption, styles.versus, { color: colors.textMuted }]} numberOfLines={1}>
                  {trendText.versus}
                </Text>
              ) : null}
            </View>
          ) : null}
          {sub ? (
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
          {hasSeries ? <Sparkline data={trendSeries} tone={tone} height={28} decorative style={styles.sparkline} /> : null}
        </>
      )}
    </>
  );

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    ...shadows.sm,
  };
  const a11y = loading ? `${label}, loading` : [label, String(value), sub, trend?.label, hasSeries && describeTrend(trendSeries)].filter(Boolean).join(", ");

  if (onPress) {
    return (
      <ScalePressable
        pressScale={PRESS_SCALE}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        android_ripple={{ color: colors.ripple, foreground: true }}
        style={({ pressed }) => [styles.flex, cardStyle, { overflow: "hidden" }, pressed && { opacity: 0.92 }, style]}
      >
        {body}
      </ScalePressable>
    );
  }
  return (
    <View accessible accessibilityLabel={a11y} style={[styles.flex, cardStyle, style]}>
      {body}
    </View>
  );
}

/** Alias: some screens call these KPI cards. */
export const KpiCard = StatCard;
export type KpiCardProps = StatCardProps;

const styles = StyleSheet.create({
  // No minWidth: in a plain row of two on a 320dp phone the cards must shrink, not push past the screen edge.
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28 },
  // Small, muted label: 13/18 medium.
  label: { flex: 1, fontSize: 13, lineHeight: 18, ...fontFor("500") },
  iconWell: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  value: { marginTop: 2, letterSpacing: -0.3 },
  // The chip and its comparison share a line when they fit; the comparison wraps under the chip otherwise.
  trend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  versus: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  skeleton: { gap: 8, paddingVertical: 4 },
  sparkline: { marginTop: "auto" },
});
