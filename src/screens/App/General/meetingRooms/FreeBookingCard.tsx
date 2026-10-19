import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, InfoRow, StatusPill } from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import {
  bookingRoomName,
  bookingWhenText,
  hoursText,
  hoursUnit,
  type FreeMeetingRoomBooking,
} from "../../../../services/meetingRoomService";
import { TitleRow } from "../shared/TitleRow";

type FreeBookingCardProps = {
  booking: FreeMeetingRoomBooking;
  /** Shown only when the API says the booking can still be cancelled. */
  onCancel: () => void;
};

/** One free meeting-room booking: room, when, location, reference, notes / reason, status and Cancel (upcoming only). */
export function FreeBookingCard({ booking: b, onCancel }: FreeBookingCardProps) {
  const styles = useThemedStyles(createStyles);
  const room = bookingRoomName(b);
  const status = b.bookingStatusLabel || b.bookingStatusCode || "Booked";
  const duration = b.durationMinutes ? ` (${hoursText(b.durationMinutes)} ${hoursUnit(b.durationMinutes)})` : "";
  return (
    <Card variant={b.isPast ? "filled" : "elevated"}>
      <TitleRow
        title={room}
        accessibilityRole="header"
        right={<StatusPill status={b.bookingStatusCode || b.bookingStatusLabel} label={status} />}
      />
      <View style={styles.rows}>
        <InfoRow label="When" value={`${bookingWhenText(b)}${duration}`} icon="time-outline" layout="stacked" />
        {b.locationName ? <InfoRow label="Location" value={b.locationName} icon="location-outline" /> : null}
        {b.challanNumber ? <InfoRow label="Reference" value={b.challanNumber} icon="document-text-outline" /> : null}
        {b.notes ? <InfoRow label="Notes" value={b.notes} icon="create-outline" layout="stacked" /> : null}
        {b.cancelReason ? <InfoRow label="Reason" value={b.cancelReason} icon="chatbox-outline" layout="stacked" /> : null}
      </View>
      {b.isPast || b.canCancel ? (
        <View style={styles.footer}>
          {b.isPast ? (
            <AppText variant="caption" color="textMuted">
              Ended
            </AppText>
          ) : null}
          {b.canCancel ? (
            <Button
              title="Cancel"
              size="sm"
              variant="ghost"
              leftIcon="close-outline"
              onPress={onCancel}
              accessibilityLabel={`Cancel ${room}, ${bookingWhenText(b)}`}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    rows: { marginTop: t.spacing.sm },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
  });
