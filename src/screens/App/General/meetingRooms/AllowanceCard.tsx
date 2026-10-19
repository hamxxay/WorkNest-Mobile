import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Card, ResponsiveGrid, STAT_CARD_MIN_WIDTH, StatCard } from "../../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  hoursText,
  hoursUnit,
  monthLabel,
  usedPercent,
  type MeetingRoomEntitlement,
} from "../../../../services/meetingRoomService";

/**
 * The allowance for the month of the chosen date: hours left of the month's hours, the private office and its
 * location, a bar of the hours used, then hours per month / used / remaining / longest booking (website layout).
 */
export function AllowanceCard({ entitlement: e, date }: { entitlement: MeetingRoomEntitlement; date: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const percent = usedPercent(e);
  const month = monthLabel(e.monthStart, date);
  const office = [e.privateSpaceName ? `With ${e.privateSpaceName}` : null, e.locationName].filter(Boolean).join(" · ");
  const max = e.maxBookingHours;
  return (
    <View style={styles.wrap}>
      <Card>
        {month ? (
          <AppText variant="overline" color="textMuted">
            {`Free hours for ${month}`}
          </AppText>
        ) : null}
        <AppText variant="heading" accessibilityRole="header" style={styles.heading}>
          {`${hoursText(e.remainingMinutes)} of ${hoursText(e.allocatedMinutes)} ${hoursUnit(e.allocatedMinutes)} left`}
        </AppText>
        {office ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" style={styles.flex}>
              {office}
            </AppText>
          </View>
        ) : null}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Free hours used this month"
          accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent used` }}
          style={styles.track}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </Card>
      <ResponsiveGrid minItemWidth={STAT_CARD_MIN_WIDTH}>
        <StatCard label="Hours per month" value={hoursText(e.allocatedMinutes)} icon="calendar-outline" />
        <StatCard label="Used" value={hoursText(e.usedMinutes)} icon="time-outline" tone="neutral" />
        <StatCard label="Remaining" value={hoursText(e.remainingMinutes)} icon="hourglass-outline" tone="success" />
        <StatCard label="Per booking" value={max} sub={`${max === 1 ? "hour" : "hours"} max`} icon="timer-outline" tone="info" />
      </ResponsiveGrid>
    </View>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.md },
    flex: { flex: 1 },
    heading: { marginTop: t.spacing.xxs },
    meta: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, marginTop: t.spacing.xs },
    track: {
      height: 8,
      borderRadius: t.radii.pill,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
      marginTop: t.spacing.md,
    },
    fill: { height: "100%", borderRadius: t.radii.pill, backgroundColor: c.primary },
  });
