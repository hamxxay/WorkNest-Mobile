import { complaintStatusColor, darkComplaintStatusColors, lightComplaintStatusColors } from "./complaintStatus";

describe("complaint status colours", () => {
  it("uses the CMS colours in light mode and lighter steps of the same hues in dark mode", () => {
    expect(lightComplaintStatusColors).toEqual({
      open: "#c2410c",
      in_progress: "#1d4ed8",
      resolved: "#047857",
      closed: "#64748b",
    });
    for (const s of ["open", "in_progress", "resolved", "closed"] as const) {
      expect(darkComplaintStatusColors[s]).not.toBe(lightComplaintStatusColors[s]);
    }
    expect(complaintStatusColor("open", false)).toBe("#c2410c");
    expect(complaintStatusColor("in_progress", true)).toBe(darkComplaintStatusColors.in_progress);
    expect(complaintStatusColor(null, true)).toBe(darkComplaintStatusColors.closed);
    expect(complaintStatusColor(undefined, false)).toBe(lightComplaintStatusColors.closed);
  });
});
