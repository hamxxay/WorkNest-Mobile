import { blue, emerald, orange, slate } from "./palette";

// Complaint status colours of the Sales Manager complaints section (status bar, category bars), matching the CMS:
// Open #c2410c (orange), In progress #1d4ed8 (blue), Resolved #047857 (green, awaiting the customer's reply),
// Closed slate. Dark mode uses the 400 step of the same hue so marks keep at least 3:1 against the dark card
// surface (as the tour-inquiry Type colours do). Pure (no React); components use useComplaintStatusColors().

/** The API's complaint statuses (ComplaintStatus). */
export type ComplaintStatusKey = "open" | "in_progress" | "resolved" | "closed";

export const lightComplaintStatusColors: Record<ComplaintStatusKey, string> = {
  open: orange[700],
  in_progress: blue[700],
  resolved: emerald[700],
  closed: slate[500],
};

export const darkComplaintStatusColors: Record<ComplaintStatusKey, string> = {
  open: orange[400],
  in_progress: blue[400],
  resolved: emerald[400],
  closed: slate[400],
};

/** Colour of a complaint status in the active mode; an unknown status uses the "closed" slate. */
export function complaintStatusColor(status: ComplaintStatusKey | null | undefined, isDark: boolean): string {
  const colors = isDark ? darkComplaintStatusColors : lightComplaintStatusColors;
  return (status && colors[status]) || colors.closed;
}
