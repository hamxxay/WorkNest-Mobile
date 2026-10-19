import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, BottomSheet, Button, TextField } from "../../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import { errorMessage } from "../../../../services/apiClient";
import {
  bookingRoomName,
  bookingWhenText,
  CANCEL_REASON_MAX_LENGTH,
  cancelFreeMeetingRoom,
  hoursText,
  hoursUnit,
  type FreeMeetingRoomBooking,
} from "../../../../services/meetingRoomService";

type CancelFreeBookingSheetProps = {
  booking: FreeMeetingRoomBooking;
  onClose: () => void;
  /** Cancelled: the API's message. */
  onCancelled: (message: string) => void;
};

/**
 * "Cancel this booking?" with an optional reason (POST booking/meeting-room/{id}/cancel), like the website's dialog.
 * Stays open with the API's reason when it refuses (e.g. the booking has started meanwhile).
 */
export function CancelFreeBookingSheet({ booking: b, onClose, onCancelled }: CancelFreeBookingSheetProps) {
  const styles = useThemedStyles(createStyles);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  // Set at once: a double tap must not send two cancels.
  const busyRef = useRef(false);

  const close = () => {
    if (!busyRef.current) onClose();
  };

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCancelling(true);
    setError("");
    try {
      const message = await cancelFreeMeetingRoom(b.bookingId, reason);
      busyRef.current = false;
      onCancelled(message);
    } catch (err) {
      busyRef.current = false;
      setCancelling(false);
      setError(errorMessage(err, "The booking could not be cancelled."));
    }
  };

  const hours = `${hoursText(b.durationMinutes)} ${hoursUnit(b.durationMinutes)}`;
  return (
    <BottomSheet
      visible
      onClose={close}
      dismissible={!cancelling}
      title="Cancel this booking?"
      error={error}
      footer={
        <>
          <Button title="Keep booking" variant="outline" onPress={close} disabled={cancelling} style={styles.flex} />
          <Button
            title="Cancel booking"
            variant="danger"
            onPress={confirm}
            loading={cancelling}
            disabled={cancelling}
            haptic
            style={styles.flex}
          />
        </>
      }
    >
      <View style={styles.body}>
        <AppText variant="bodySmall" color="textSecondary">
          {`${bookingRoomName(b)}, ${bookingWhenText(b)}. The ${hours} go back to that month's free hours.`}
        </AppText>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          maxLength={CANCEL_REASON_MAX_LENGTH}
          multiline
          rows={3}
          disabled={cancelling}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { gap: t.spacing.md },
  });
