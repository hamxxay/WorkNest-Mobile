import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { notifyDoorAccessChanged, unlockMyRoomDoor, type DoorAccess } from "../services/doorAccessService";
import { ApiError } from "../services/apiClient";

/** Home "Unlock Door" button: opens the room door in one tap; guards double taps and reports the result. */
export function useUnlockRoomDoor(access: DoorAccess | null) {
  const [unlocking, setUnlocking] = useState(false);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (!access || busy.current) return;
    busy.current = true;
    setUnlocking(true);
    try {
      const message = await unlockMyRoomDoor(access);
      Alert.alert("Door unlocked", message);
    } catch (err) {
      Alert.alert("Could not unlock", err instanceof Error && err.message ? err.message : "Please try again or ask reception.");
      // The server answered but said no: access may have been turned off, so refresh the home button.
      if (!(err instanceof ApiError) || err.status !== 0) notifyDoorAccessChanged();
    } finally {
      busy.current = false;
      setUnlocking(false);
    }
  }, [access]);

  return { unlock, unlocking };
}
