import { useCallback, useRef, useState } from "react";
import { notifyDoorAccessChanged, unlockMyRoomDoor, type DoorAccess } from "../services/doorAccessService";
import { ApiError, errorMessage } from "../services/apiClient";
import { useToast } from "../components/ui";
import { haptics } from "../utils/haptics";

/**
 * Home "Unlock Door" button: opens the room door in one tap; guards double taps and reports the result.
 * Feedback: a medium haptic on press, then the success haptic + animated check toast, or the error haptic.
 */
export function useUnlockRoomDoor(access: DoorAccess | null) {
  const [unlocking, setUnlocking] = useState(false);
  const busy = useRef(false);
  const toast = useToast();

  const unlock = useCallback(async () => {
    if (!access || busy.current) return;
    busy.current = true;
    setUnlocking(true);
    haptics.medium();
    try {
      const message = await unlockMyRoomDoor(access);
      toast.success(message, { title: "Door unlocked", haptic: true });
    } catch (err) {
      toast.error(errorMessage(err, "Please try again or ask reception."), { title: "Could not unlock" });
      // The server answered but said no: access may have been turned off, so refresh the home button.
      if (!(err instanceof ApiError) || err.status !== 0) notifyDoorAccessChanged();
    } finally {
      busy.current = false;
      setUnlocking(false);
    }
  }, [access, toast]);

  return { unlock, unlocking };
}
