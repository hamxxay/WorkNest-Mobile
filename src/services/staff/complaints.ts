import { phoneError } from "../../utils/phone";
import { toBranchId } from "./branches";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPatch, staffPost, type ActionResult } from "./http";
import { bool, num, optNum, optStr, pick, str, toPage, withQuery, type Page } from "./normalize";

// Complaints (CMS admin.service.ts getComplaints / createComplaint / updateComplaintStatus; API
// ComplaintController). Roles: every staff role. Complaints come from the WhatsApp chatbot or are entered by staff.
// Marking one resolved (the first time) asks the customer on WhatsApp to confirm. Branch routing: the API gives
// location-bound staff (admins, sales executives) the complaints whose Branch is one of their locations plus those
// with no branch; super admins see all.

export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export const COMPLAINT_STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/** Category options of the CMS "new complaint" form. */
export const COMPLAINT_CATEGORIES = [
  "Internet / WiFi",
  "Electricity / AC",
  "Cleaning",
  "Noise",
  "Access / Entry",
  "Booking Issue",
  "Other",
] as const;

/** Same normalisation as the API (trim, lower-case, spaces to "_", "inprogress" -> "in_progress"); null if unknown. */
export function normalizeComplaintStatus(value: string | null | undefined): ComplaintStatus | null {
  const v = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const key = v === "inprogress" ? "in_progress" : v;
  return (["open", "in_progress", "resolved", "closed"] as const).find((s) => s === key) ?? null;
}

export function complaintStatusLabel(value: string | null | undefined): string {
  const status = normalizeComplaintStatus(value);
  return COMPLAINT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? (value || "Open");
}

export type StaffComplaint = {
  id: number;
  complaintNo: string;
  /** whatsapp | manual */
  source: string;
  customerName: string | null;
  phoneNumber: string | null;
  email: string | null;
  /** Branch name (WN_Complaints.Branch = a WN_Locations.Name); null = no branch. */
  branch: string | null;
  /** The branch's location id when the API resolves it (null when it does not, or there is no branch). */
  locationId: number | null;
  category: string;
  description: string;
  status: ComplaintStatus | string;
  statusLabel: string;
  isFollowUp: boolean;
  previousComplaintNo: string | null;
  /** CMS "Source" column: "WhatsApp" / "Manual", plus " · follow-up of CMP-..." */
  sourceLabel: string;
  /** CMS customer reply column after "resolved": persists / resolved / waiting. */
  replyLabel: string;
  staffNotes: string | null;
  createdOn: string | null;
  updatedOn: string | null;
};

export function normalizeComplaint(raw: any): StaffComplaint {
  const source = str(raw, "source") || "manual";
  const status = str(raw, "status") || "open";
  const previousComplaintNo = optStr(raw, "previousComplaintNo");
  const isFollowUp = bool(raw, "isFollowUp");
  const reply = (optStr(raw, "resolutionResponse") ?? "").toLowerCase();
  const replyLabel =
    reply === "persists"
      ? "Issue persists"
      : reply === "resolved"
      ? "Confirmed resolved"
      : bool(raw, "resolvedNotificationSent")
      ? "Waiting for reply"
      : "-";
  return {
    id: num(raw, "id"),
    complaintNo: str(raw, "complaintNo"),
    source,
    customerName: optStr(raw, "customerName"),
    phoneNumber: optStr(raw, "phoneNumber"),
    email: optStr(raw, "email"),
    branch: optStr(raw, "branch"),
    locationId: toBranchId(pick(raw, "locationId")),
    category: str(raw, "category"),
    description: str(raw, "description"),
    status: normalizeComplaintStatus(status) ?? status,
    statusLabel: complaintStatusLabel(status),
    isFollowUp,
    previousComplaintNo,
    sourceLabel:
      (source.toLowerCase() === "whatsapp" ? "WhatsApp" : "Manual") +
      (isFollowUp && previousComplaintNo ? ` · follow-up of ${previousComplaintNo}` : ""),
    replyLabel,
    staffNotes: optStr(raw, "staffNotes"),
    createdOn: optStr(raw, "createdOn", "createdAt"),
    updatedOn: optStr(raw, "updatedOn"),
  };
}

/**
 * GET complaints?page=&limit=&search=&status=&locationId= — open first, then in progress, resolved, closed; newest
 * first. locationId narrows the list to one of the user's locations (0 = only those with no branch).
 */
export async function listComplaints(
  query: { page?: number; limit?: number; search?: string; status?: ComplaintStatus | null; locationId?: number | null } = {},
): Promise<Page<StaffComplaint>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.complaints.list, {
      page,
      limit,
      search: query.search?.trim(),
      status: query.status ?? undefined,
      // 0 = only the complaints with no branch (the "No branch" filter).
      locationId: query.locationId === 0 ? 0 : toBranchId(query.locationId) ?? undefined,
    }),
  );
  return toPage(raw, normalizeComplaint, { page, limit });
}

export type ComplaintInput = {
  category: string;
  description: string;
  customerName?: string;
  phoneNumber?: string;
  email?: string;
  /** Branch name (sent as `branch`, which the API stores). */
  branch?: string;
  /** Branch location id (sent as `locationId`, which the API checks against the user's locations). */
  locationId?: number | null;
};

/** First problem with a new complaint (API limits: category 50, description 2000, name 200, email 256). */
export function validateComplaintInput(input: ComplaintInput): string | null {
  if (!input.category?.trim()) return "Choose the category.";
  if (input.category.trim().length > 50) return "The category is too long.";
  if (!input.description?.trim()) return "Describe the complaint.";
  if (input.description.trim().length > 2000) return "Keep the description under 2000 characters.";
  if ((input.customerName ?? "").trim().length > 200) return "The name is too long.";
  if ((input.email ?? "").trim().length > 256) return "The email is too long.";
  return phoneError(input.phoneNumber ?? "");
}

/** POST complaints — a complaint entered by staff (phone call, walk-in, email). */
export async function createComplaint(input: ComplaintInput): Promise<ActionResult<{ id: number | null; complaintNo: string | null }>> {
  const invalid = validateComplaintInput(input);
  if (invalid) throw new Error(invalid);
  const text = (v?: string) => v?.trim() || null;
  const raw = await staffPost(STAFF_ENDPOINTS.complaints.create, {
    category: input.category.trim(),
    description: input.description.trim(),
    customerName: text(input.customerName),
    phoneNumber: text(input.phoneNumber),
    email: text(input.email),
    branch: text(input.branch),
    locationId: toBranchId(input.locationId),
  });
  const result = actionResult<any>(raw, "Complaint recorded.");
  return { message: result.message, data: { id: optNum(result.data, "id"), complaintNo: optStr(result.data, "complaintNo") } };
}

/**
 * PATCH complaints/{id}/status { status, staffNotes } — resolved (the first time) asks the customer on WhatsApp;
 * `notified` says whether that message went out.
 */
export async function updateComplaintStatus(
  id: number,
  status: ComplaintStatus,
  staffNotes?: string,
): Promise<ActionResult<{ notified: boolean }>> {
  const notes = staffNotes?.trim() ?? "";
  if (notes.length > 1000) throw new Error("Keep the notes under 1000 characters.");
  const raw = await staffPatch(STAFF_ENDPOINTS.complaints.status(id), { status, staffNotes: notes || null });
  const result = actionResult<any>(raw, "Complaint updated.");
  return { message: result.message, data: { notified: bool(result.data, "notified") } };
}

/** PATCH complaints/{id}/branch { locationId } — set or change a complaint's branch (location-bound: one of theirs). */
export async function updateComplaintBranch(id: number, locationId: number): Promise<ActionResult> {
  const branchId = toBranchId(locationId);
  if (branchId == null) throw new Error("Choose the branch.");
  const raw = await staffPatch(STAFF_ENDPOINTS.complaints.branch(id), { locationId: branchId });
  return actionResult(raw, "Branch updated.");
}
