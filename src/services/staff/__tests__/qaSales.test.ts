// QA_05 (staff sales): tour inquiries from two tables with the same ids, the one "New" rule, unambiguous writes,
// the Type of staff-entered inquiries, phone checks, profile locations, badges counted once and users' DB names.

jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn() }));
jest.mock("../../apiClient", () => ({
  ApiError: class extends Error {},
  apiRequest: jest.fn(),
  friendlyApiMessage: () => "error",
  serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
}));

import { apiRequest } from "../../apiClient";
import { withoutCapacityRequests, badgesByRoute } from "../../../navigation/staff/access";
import { uniqueBy } from "../../../screens/App/Staff/shared/guards";
import {
  canContactByPhone,
  inquiryRowKey,
  inquiryTypeText,
  isNewInquiry,
} from "../../../utils/inquiry";
import { createTourInquiry, inquiryPath, normalizeInquiry, saveInquiryFeedback, updateInquiryStatus } from "../inquiries";
import { assignedLocationsLabel, normalizeProfile } from "../profile";
import { normalizeUser } from "../users";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const OLD = { id: 2, publicId: "a48a0f04-6f95-4635-a518-ebb19cc9f3e4", contactType: "Book Tour", statusId: 0, phoneNumber: "Tour: 2026-06-26 02:" };
const NEWER = { id: 2, publicId: "c85c5a83-bcc8-f111-99d8-484d7ea9a94c", contactType: "book_tour", statusId: 1, phoneNumber: "03220256000" };

describe("tour inquiries from two tables", () => {
  it("rows with the same id get different keys and both stay in the list", () => {
    const rows = [OLD, NEWER].map(normalizeInquiry);
    expect(rows.map((r) => r.source)).toEqual(["booktour", "contact"]);
    expect(rows.map((r) => r.key)).toEqual(["booktour-2", "contact-2"]);
    expect(uniqueBy(rows, inquiryRowKey)).toHaveLength(2);
    // The API's own key / source / flags win when it sends them.
    const fromApi = normalizeInquiry({ ...OLD, source: "booktour", key: "booktour-2", canChangeBranch: false, isNew: true });
    expect(fromApi).toMatchObject({ source: "booktour", key: "booktour-2", canChangeBranch: false, isNew: true });
    expect(normalizeInquiry({ ...NEWER, source: "contact", canChangeBranch: true }).canChangeBranch).toBe(true);
  });

  it("old website bookings can't get a branch (the API's flag; older API: by source)", () => {
    expect(normalizeInquiry(OLD).canChangeBranch).toBe(false);
    expect(normalizeInquiry(NEWER).canChangeBranch).toBe(true);
  });

  it("New follows the API's isNew, the same rule as the dashboard and the badge", () => {
    expect(isNewInquiry(normalizeInquiry({ ...NEWER, statusId: 2, isNew: false }))).toBe(false);
    expect(isNewInquiry(normalizeInquiry({ ...OLD, isNew: true }))).toBe(true);
    // An older API without isNew: status New and no feedback yet.
    expect(isNewInquiry(normalizeInquiry({ id: 3, statusId: 1 }))).toBe(true);
    expect(isNewInquiry(normalizeInquiry({ id: 3, statusId: 1, feedbackOutcome: "future_prospect" }))).toBe(false);
  });

  it("writes go by public id, or id + source without one", () => {
    expect(inquiryPath(normalizeInquiry(NEWER), "feedback")).toBe(`/contact/${NEWER.publicId}/feedback`);
    expect(inquiryPath({ id: 2, publicId: null, source: "booktour" }, "status")).toBe("/contact/2/status?source=booktour");
    expect(inquiryPath({ id: null, publicId: null, source: "contact" }, "status")).toBeNull();
  });

  it("feedback and status are sent to the right inquiry", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Feedback saved." });
    await saveInquiryFeedback(normalizeInquiry(OLD), { outcome: "not_interested", reason: "Too far" });
    expect(lastCall()).toMatchObject({ path: `/contact/${OLD.publicId}/feedback`, method: "POST" });

    api.mockResolvedValueOnce({ isSuccessful: true, message: "Feedback saved." });
    await saveInquiryFeedback({ id: 2, publicId: null, source: "booktour" }, { outcome: "converted", quotationId: 9 });
    expect(lastCall()).toMatchObject({ path: "/contact/2/feedback?source=booktour", body: { outcome: "converted", quotationId: 9 } });

    api.mockResolvedValueOnce({ isSuccessful: true, message: "Contact status updated." });
    await updateInquiryStatus(normalizeInquiry(NEWER), 3);
    expect(lastCall()).toMatchObject({ path: `/contact/${NEWER.publicId}/status`, method: "PATCH", body: { statusId: 3 } });

    await expect(saveInquiryFeedback({ id: null, publicId: null }, { outcome: "converted" })).rejects.toThrow("could not be identified");
  });
});

describe("staff-entered inquiry Type", () => {
  it("sends Walk-In by default, Reference with who referred the visitor", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Contact recorded." });
    await createTourInquiry({ fullName: "Ali Khan", phone: "03001234567", locationId: 1 });
    expect(lastCall().body).toMatchObject({ inquiryType: "WalkIn", referenceName: null, locationId: 1 });

    api.mockResolvedValueOnce({ isSuccessful: true, message: "Contact recorded." });
    await createTourInquiry({ fullName: "Ali Khan", phone: "03001234567", inquiryType: "Reference", referenceName: "  Sana Iqbal " });
    expect(lastCall().body).toMatchObject({ inquiryType: "Reference", referenceName: "Sana Iqbal" });
  });

  it("the list shows the Type (Reference with the name)", () => {
    expect(inquiryTypeText(normalizeInquiry({ id: 1, inquiryType: "WalkIn" }))).toBe("Walk-In");
    expect(inquiryTypeText(normalizeInquiry({ id: 1, InquiryType: "Reference", ReferenceName: "Sana" }))).toBe("Reference: Sana");
    expect(inquiryTypeText(normalizeInquiry({ id: 1, inquiryType: "Website" }))).toBe("Website");
    expect(inquiryTypeText(normalizeInquiry({ id: 1 }))).toBe("");
  });
});

describe("call / WhatsApp only for a real phone number", () => {
  it("uses the API's phone rule", () => {
    expect(canContactByPhone("03001234567")).toBe(true);
    expect(canContactByPhone("+92 300 1234567")).toBe(true);
    expect(canContactByPhone("Tour: 2026-06-26 02:")).toBe(false);
    expect(canContactByPhone("12345")).toBe(false);
    expect(canContactByPhone("")).toBe(false);
    expect(canContactByPhone(null)).toBe(false);
  });
});

describe("profile locations", () => {
  const locations = [
    { id: 1, name: "I-8" },
    { id: 2, name: "F-7" },
  ];

  it("super admins and the CEO see every location, even with a main location stored", () => {
    const superAdmin = normalizeProfile({ role: "super_admin", locationId: 1 });
    expect(assignedLocationsLabel("super_admin", superAdmin.locationIds, locations)).toBe("All locations");
    expect(assignedLocationsLabel("ceo", [1], locations)).toBe("All locations");
  });

  it("location-bound staff see their locations by name", () => {
    expect(assignedLocationsLabel("admin", [1, 2], locations)).toBe("I-8, F-7");
    expect(assignedLocationsLabel("sales_executive", [3], locations)).toBe("Location 3");
    expect(assignedLocationsLabel("admin", [], locations)).toBe("Not assigned");
  });
});

describe("badges: capacity requests counted once", () => {
  it("takes the admins' pending requests out of the Attendants count (they show on Approvals)", () => {
    const raw = { "/admin/attendants": 3, "/admin/bookings": 2 };
    expect(withoutCapacityRequests(raw, 2)).toEqual({ "/admin/attendants": 1, "/admin/bookings": 2 });
    expect(withoutCapacityRequests(raw, 5)["/admin/attendants"]).toBe(0);
    expect(withoutCapacityRequests(raw, 0)).toBe(raw);
    // With 2 requests and 1 suspension, the screen badges add up to 1 + 2 bookings; the 2 requests are counted once elsewhere.
    expect(badgesByRoute("admin", withoutCapacityRequests(raw, 2))).toEqual({ Attendants: 1, BookingList: 2 });
  });
});

describe("users: names and roles from the database", () => {
  it("keeps WN_Users.Name and WN_Roles.DisplayName, never the email prefix", () => {
    const u = normalizeUser({ publicId: "g", email: "ali.khan@example.com", name: "", role: "general", roleDisplayName: "General User" });
    expect(u.name).toBe("");
    expect(u.roleDisplayName).toBe("General User");
    expect(normalizeUser({ id: 1, email: "a@b.c", name: "CEO1", role: "ceo" }).roleDisplayName).toBeNull();
  });
});
