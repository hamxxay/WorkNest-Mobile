import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { DOOR_ACCESS_CHANGED, getDoorAccess, type DoorAccess } from "../services/doorAccessService";

/** Door access of the logged-in account; refreshed each time the screen gains focus. */
export function useDoorAccess(): DoorAccess | null {
  const { user } = useAuth();
  const [access, setAccess] = useState<DoorAccess | null>(null);
  const email = user?.email ?? "";

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!email) {
        setAccess(null);
        return;
      }
      getDoorAccess(email).then(result => {
        if (active) setAccess(result);
      });
      return () => {
        active = false;
      };
    }, [email]),
  );

  // An unlock the server refused (access turned off, booking ended…): re-check now so the button updates.
  useEffect(() => {
    if (!email) return;
    const sub = DeviceEventEmitter.addListener(DOOR_ACCESS_CHANGED, () => {
      getDoorAccess(email, true).then(setAccess);
    });
    return () => sub.remove();
  }, [email]);

  return access;
}
