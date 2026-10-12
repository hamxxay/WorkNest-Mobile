import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffPatch, type ActionResult } from "./http";

// Tour inquiries: the list, staff-entered inquiries and feedback already live in services/contactService.ts
// (GET contact, POST book-tour, POST contact/{id}/feedback — same calls as the CMS) and are re-exported here so
// staff screens import from one place. Roles: every staff role; not location-scoped.
export {
  createTourInquiry,
  getTourInquiries,
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
