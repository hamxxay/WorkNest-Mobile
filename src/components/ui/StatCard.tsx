import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme, type Tone } from "../../theme";
import { SkeletonBlock, SkeletonGroup } from "../Skeleton";
import { PRESS_SCALE, ScalePressable } from "../motion/ScalePressable";

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
  /** Shows a skeleton instead of the value. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** KPI tile for dashboards. Put two per row: `<View style={{flexDirection:"row", gap:12}}>`. */
export function StatCard({ label, value, sub, tone = "primary", icon, trend, onPress, loading = false, style }: StatCardProps) {
  const { colors, tones, typography, radii, shadows } = useTheme();
  const t = tones[tone];

  let trendColor = colors.textMuted;
  let trendIcon = "remove";
  if (trend && trend.direction !== "flat") {
    const good = (trend.direction === "up") === (trend.upIsGood ?? true);
    trendColor = good ? colors.success : colors.danger;
    trendIcon = trend.direction === "up" ? "trending-up" : "trending-down";
  }

  const body = (
    <>
      <View style={styles.top}>
        <Text style={[typography.bodySmall, styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.iconWell, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={18} color={t.fg} />
          </View>
        ) : null}
      </View>
      {loading ? (
        <SkeletonGroup style={styles.skeleton}>
          <SkeletonBlock width="55%" height={24} radius={6} />
          {sub ? <SkeletonBlock width="75%" height={12} radius={4} /> : null}
        </SkeletonGroup>
      ) : (
        <>
          <Text style={[typography.kpi, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </Text>
          {sub ? (
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
          {trend ? (
            <View style={styles.trend}>
              <Ionicons name={trendIcon} size={14} color={trendColor} />
              <Text style={[typography.captionStrong, { color: trendColor }]} numberOfLines={1}>
                {trend.label}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </>
  );

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    ...shadows.sm,
  };
  const a11y = loading ? `${label}, loading` : [label, String(value), sub, trend?.label].filter(Boolean).join(", ");

  if (onPress) {
    return (
      <ScalePressable
        pressScale={PRESS_SCALE}
        accessibilityRole="button"
        accessibilityLabel={a11y}
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
  flex: { flex: 1, minWidth: 140 },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  label: { flex: 1 },
  iconWell: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  trend: { flexDirection: "row", alignItems: "center", gap: 4 },
  skeleton: { gap: 8, paddingVertical: 4 },
});
