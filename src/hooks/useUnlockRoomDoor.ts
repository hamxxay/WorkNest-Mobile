import { useCallback, useRef, useState } from "react";
import { notifyDoorAccessChanged, unlockMyRoomDoor, type DoorAccess } from "../services/doorAccessService";
import { ApiError, errorMessage } from "../services/apiClient";
import { useToast } from "../components/ui";

/** Home "Unlock Door" button: opens the room door in one tap; guards double taps and reports the result. */
export function useUnlockRoomDoor(access: DoorAccess | null) {
  const [unlocking, setUnlocking] = useState(false);
  const busy = useRef(false);
  const toast = useToast();

  const unlock = useCallback(async () => {
    if (!access || busy.current) return;
    busy.current = true;
    setUnlocking(true);
    try {
      const message = await unlockMyRoomDoor(access);
      toast.success(message, { title: "Door unlocked" });
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
