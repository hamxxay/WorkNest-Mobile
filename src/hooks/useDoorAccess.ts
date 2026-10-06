import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getDoorAccess, type DoorAccess } from "../services/doorAccessService";

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

  return access;
}
