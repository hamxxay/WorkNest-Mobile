import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getAttendanceStatus } from "../services/attendanceService";

/**
 * Attendance is turned on for the signed-in customer (GET attendance/my/status, checked each time the screen gains
 * focus). False for guests and staff, while loading, when it is off and when the check fails, so the Attendance
 * entry points (Profile, Home) only show when the screen behind them will work.
 */
export function useAttendanceEnabled(): boolean {
  const { user, isStaff } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const signedInCustomer = !!user && !isStaff;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!signedInCustomer) {
        setEnabled(false);
        return;
      }
      getAttendanceStatus()
        .then((status) => active && setEnabled(status.enabled))
        .catch(() => active && setEnabled(false));
      return () => {
        active = false;
      };
    }, [signedInCustomer]),
  );

  return enabled;
}
