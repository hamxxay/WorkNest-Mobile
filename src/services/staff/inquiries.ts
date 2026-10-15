import { toBranchId } from "./branches";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffPatch, type ActionResult } from "./http";

// Tour inquiries: the list, staff-entered inquiries and feedback already live in services/contactService.ts
// (GET contact, POST book-tour, POST contact/{id}/feedback — same calls as the CMS) and are re-exported here so
// staff screens import from one place. Roles: every staff role. Branch routing: the API gives location-bound staff
// (admins, sales executives) the inquiries of their locations plus those with no branch; super admins see all.
export {
  createTourInquiry,
  getTourInquiries,
  normalizeInquiry,
  saveInquiryFeedback,
  type InquiryFeedbackRequest,
  type InquiryOutcome,
  type TourInquiry,
  type TourInquiryPage,
} from "../contactService";

/** Inquiry status ids (CMS): 1 New, 2 In progress, 3 Resolved, 4 Closed. */
export const INQUIRY_STATUS = { new: 1, inProgress: 2, resolved: 3, closed: 4 } as const;

export const INQUIRY_STATUS_LABELS: Record<number, string> = {
  1: "New",
  2: "In Progress",
  3: "Resolved",
  4: "Closed",
};

/** PATCH contact/{id}/status { statusId } (feedback already moves the status; this is the manual change). */
export async function updateInquiryStatus(id: number | string, statusId: number): Promise<ActionResult> {
  if (!INQUIRY_STATUS_LABELS[statusId]) throw new Error("Choose a valid status.");
  const raw = await staffPatch(STAFF_ENDPOINTS.inquiries.status(id), { statusId });
  return actionResult(raw, "Inquiry status updated.");
}

/**
 * PATCH contact/{publicId}/location { locationId } — set or change an inquiry's branch (location-bound staff: only
 * to one of their locations, and only inquiries they can see; the API checks).
 */
export async function updateInquiryLocation(
  inquiry: { publicId: string | null },
  locationId: number,
): Promise<ActionResult> {
  if (!inquiry.publicId) throw new Error("This inquiry could not be identified. Refresh the list and try again.");
  const id = toBranchId(locationId);
  if (id == null) throw new Error("Choose the branch.");
  const raw = await staffPatch(STAFF_ENDPOINTS.inquiries.location(inquiry.publicId), { locationId: id });
  return actionResult(raw, "Branch updated.");
}
