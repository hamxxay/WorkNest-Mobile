import { useCallback } from "react";
import { useTheme } from "./ThemeProvider";
import { complaintStatusColor, type ComplaintStatusKey } from "./complaintStatus";

/** Complaint status colours for the active light / dark theme: `const colorOf = useComplaintStatusColors(); colorOf("open")`. */
export function useComplaintStatusColors(): (status: ComplaintStatusKey | null | undefined) => string {
  const { isDark } = useTheme();
  return useCallback((status: ComplaintStatusKey | null | undefined) => complaintStatusColor(status, isDark), [isDark]);
}
