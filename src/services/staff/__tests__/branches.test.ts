// Branch routing of tour inquiries and complaints: the pure rules (which branches a form offers, the filter chips,
// names shown, tolerant parsing of the new fields) and the calls (query, body and method).

jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn() }));
jest.mock("../../apiClient", () => ({
  ApiError: class extends Error {},
  apiRequest: jest.fn(),
  friendlyApiMessage: () => "error",
  serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
}));

import { API_ENDPOINTS } from "../../../config/api";
import { apiRequest } from "../../apiClient";
import {
  NO_BRANCH_LABEL,
  branchChoice,
  branchDisplayName,
  branchFilterOptions,
  branchFilterParam,
  canMoveBranch,
  NO_BRANCH_FILTER,
  chosenBranchId,
  complaintSavePlan,
  locationIdByName,
  resolveBranchId,
  toBranchId,
} from "../branches";
import { createComplaint, listComplaints, normalizeComplaint, updateComplaintBranch } from "../complaints";
import { createTourInquiry, getTourInquiries, normalizeInquiry, updateInquiryLocation } from "../inquiries";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const F7 = { id: 1, name: "F-7", isActive: true };
const I8 = { id: 2, name: "I-8", isActive: true };
const G11 = { id: 3, name: "G-11", isActive: false };
const ALL = [F7, G11, I8];

describe("branch helpers", () => {
  it("reads ids tolerantly (missing, blank, 0 and text = no branch)", () => {
    expect(toBranchId(5)).toBe(5);
    expect(toBranchId("7")).toBe(7);
    expect(toBranchId(null)).toBeNull();
    expect(toBranchId(undefined)).toBeNull();
    expect(toBranchId("")).toBeNull();
    expect(toBranchId(" ")).toBeNull();
    expect(toBranchId(0)).toBeNull();
    expect(toBranchId(-2)).toBeNull();
    expect(toBranchId("I-8")).toBeNull();
    expect(toBranchId(1.5)).toBeNull();
    expect(toBranchId(true)).toBeNull();
  });

  it("matches a complaint's branch name to a location (trimmed, any case)", () => {
    expect(locationIdByName(ALL, " i-8 ")).toBe(2);
    expect(locationIdByName(ALL, "Blue Area")).toBeNull();
    expect(locationIdByName(ALL, "")).toBeNull();
    expect(locationIdByName(ALL, null)).toBeNull();
    expect(resolveBranchId({ locationId: 1, branch: "I-8" }, ALL)).toBe(1);
    expect(resolveBranchId({ locationId: null, branch: "F-7" }, ALL)).toBe(1);
    expect(resolveBranchId({ locationId: null, branch: null }, ALL)).toBeNull();
  });

  it("names the branch shown on a row; null means no branch", () => {
    expect(NO_BRANCH_LABEL).toBe("No branch");
    expect(branchDisplayName({ locationId: 2, name: "I-8" }, [])).toBe("I-8");
    expect(branchDisplayName({ locationId: 2, name: null }, ALL)).toBe("I-8");
    expect(branchDisplayName({ locationId: 9, name: " " }, ALL)).toBe("Location 9");
    expect(branchDisplayName({ locationId: null, name: null }, ALL)).toBeNull();
    expect(branchDisplayName({}, ALL)).toBeNull();
  });

  it("one location: the branch is fixed to it", () => {
    const choice = branchChoice("sales_executive", [2], ALL);
    expect(choice.fixed).toEqual(I8);
    expect(choice.options).toEqual([I8]);
    expect(chosenBranchId(choice, null)).toBe(2);
    expect(chosenBranchId(choice, 1)).toBe(2);
  });

  it("several locations: only theirs", () => {
    const choice = branchChoice("admin", [1, 3], ALL);
    expect(choice.fixed).toBeNull();
    expect(choice.options.map((l) => l.id)).toEqual([1, 3]);
    expect(chosenBranchId(choice, null)).toBeNull();
    expect(chosenBranchId(choice, 2)).toBeNull();
    expect(chosenBranchId(choice, 3)).toBe(3);
  });

  it("before the profile loads, a location-bound user gets the (API-scoped) location list", () => {
    expect(branchChoice("admin", [], [F7]).fixed).toEqual(F7);
    expect(branchChoice("admin", undefined, [F7, I8]).options).toEqual([F7, I8]);
  });

  it("super admin: every active location", () => {
    const choice = branchChoice("super_admin", [], ALL);
    expect(choice.fixed).toBeNull();
    expect(choice.options).toEqual([F7, I8]);
    expect(branchChoice("super_admin", [], [F7]).fixed).toBeNull();
  });

  it("offers a move only to a different branch", () => {
    expect(canMoveBranch(null, [F7])).toBe(true);
    expect(canMoveBranch(1, [F7])).toBe(false);
    expect(canMoveBranch(1, [F7, I8])).toBe(true);
    expect(canMoveBranch(null, [])).toBe(false);
  });

  it("location filter chips only for users who see more than one location", () => {
    expect(branchFilterOptions("sales_executive", [F7])).toEqual([]);
    expect(branchFilterOptions("admin", [F7, I8])).toEqual([
      { label: "All my locations", value: 0 },
      { label: "F-7", value: 1 },
      { label: "I-8", value: 2 },
      { label: "No branch", value: NO_BRANCH_FILTER },
    ]);
    expect(branchFilterOptions("super_admin", ALL)[0]).toEqual({ label: "All locations", value: 0 });
    // Every location + "No branch" (the items without one; ?locationId=0 for the API).
    expect(branchFilterOptions("super_admin", ALL)).toHaveLength(5);
    expect(branchFilterOptions("super_admin", ALL).at(-1)).toEqual({ label: "No branch", value: NO_BRANCH_FILTER });
    expect(branchFilterParam(0)).toBeUndefined();
    expect(branchFilterParam(NO_BRANCH_FILTER)).toBe(0);
    expect(branchFilterParam(2)).toBe(2);
    expect(branchFilterParam(null)).toBeUndefined();
  });

  it("saving a complaint: moves the branch only when another one is picked", () => {
    expect(complaintSavePlan({ currentBranchId: null, pickedBranchId: null, statusChanged: false })).toEqual({ moveTo: null, updateStatus: true });
    expect(complaintSavePlan({ currentBranchId: null, pickedBranchId: 2, statusChanged: false })).toEqual({ moveTo: 2, updateStatus: false });
    expect(complaintSavePlan({ currentBranchId: 1, pickedBranchId: 2, statusChanged: true })).toEqual({ moveTo: 2, updateStatus: true });
    expect(complaintSavePlan({ currentBranchId: 2, pickedBranchId: 2, statusChanged: false })).toEqual({ moveTo: null, updateStatus: true });
  });
});

describe("parsing the new fields", () => {
  it("inquiries: locationId / locationName in either case; missing = no branch", () => {
    expect(normalizeInquiry({ id: 1, locationId: 2, locationName: "I-8" })).toMatchObject({ locationId: 2, locationName: "I-8" });
    expect(normalizeInquiry({ Id: 1, LocationId: "3", LocationName: " G-11 " })).toMatchObject({ locationId: 3, locationName: "G-11" });
    expect(normalizeInquiry({ id: 1 })).toMatchObject({ locationId: null, locationName: null });
    expect(normalizeInquiry({ id: 1, locationId: 0, locationName: "" })).toMatchObject({ locationId: null, locationName: null });
    expect(normalizeInquiry(null)).toMatchObject({ locationId: null, locationName: null });
  });

  it("complaints: locationId when the API resolves it; missing = null", () => {
    expect(normalizeComplaint({ id: 1, branch: "I-8", locationId: 2 })).toMatchObject({ branch: "I-8", locationId: 2 });
    expect(normalizeComplaint({ id: 1, Branch: "F-7", LocationId: "1" })).toMatchObject({ branch: "F-7", locationId: 1 });
    expect(normalizeComplaint({ id: 1, branch: " " })).toMatchObject({ branch: null, locationId: null });
  });
});

describe("branch calls", () => {
  it("inquiries list sends ?locationId= for a location, 0 for no branch, nothing for all", async () => {
    expect(API_ENDPOINTS.contact.list(1, 50, undefined, 2)).toBe("/contact?page=1&limit=50&locationId=2");
    expect(API_ENDPOINTS.contact.list(1, 50, "ali", 0)).toBe("/contact?page=1&limit=50&search=ali&locationId=0");
    expect(API_ENDPOINTS.contact.list(1, 50, "ali")).toBe("/contact?page=1&limit=50&search=ali");
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await getTourInquiries(1, 50, undefined, 0);
    expect(lastCall().path).toBe("/contact?page=1&limit=50&locationId=0");
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await listComplaints({ locationId: 0 });
    expect(lastCall().path).toContain("locationId=0");
    api.mockResolvedValueOnce({ data: [{ id: 4, publicId: "abc", LocationId: 2, LocationName: "I-8" }], total: 1 });
    const page = await getTourInquiries(1, 50, undefined, 2);
    expect(lastCall()).toMatchObject({ path: "/contact?page=1&limit=50&locationId=2", method: "GET", requiresAuth: true });
    expect(page.items[0]).toMatchObject({ locationId: 2, locationName: "I-8" });
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await getTourInquiries(1, 50);
    expect(lastCall().path).toBe("/contact?page=1&limit=50");
  });

  it("a staff-entered inquiry carries its branch", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Inquiry added." });
    await createTourInquiry({ fullName: "Ali Khan", phone: "03001234567", locationId: 2 });
    expect(lastCall()).toMatchObject({ path: "/book-tour", method: "POST", body: { fullName: "Ali Khan", locationId: 2 } });
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Inquiry added." });
    await createTourInquiry({ fullName: "Ali Khan", phone: "03001234567" });
    expect(lastCall().body).not.toHaveProperty("locationId");
  });

  it("sets an inquiry's branch by its public id", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Location updated." });
    const result = await updateInquiryLocation({ publicId: "2b7c0b6e-0000-4000-8000-000000000001" }, 2);
    expect(lastCall()).toMatchObject({
      path: "/contact/2b7c0b6e-0000-4000-8000-000000000001/location",
      method: "PATCH",
      body: { locationId: 2 },
    });
    expect(result.message).toBe("Location updated.");
    await expect(updateInquiryLocation({ publicId: null }, 2)).rejects.toThrow(/could not be identified/);
    await expect(updateInquiryLocation({ publicId: "x" }, 0)).rejects.toThrow(/Choose the branch/);
  });

  it("complaints list sends ?locationId= only for a real location", async () => {
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await listComplaints({ page: 1, limit: 20, locationId: 2 });
    expect(lastCall().path).toBe("/complaints?page=1&limit=20&locationId=2");
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await listComplaints({ page: 1, limit: 20, locationId: null });
    expect(lastCall().path).toBe("/complaints?page=1&limit=20");
  });

  it("a staff-entered complaint sends the branch name and its location id", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Complaint recorded.", data: { id: 9, complaintNo: "CMP-000009" } });
    await createComplaint({ category: "Cleaning", description: "Bins full", branch: "I-8", locationId: 2 });
    expect(lastCall()).toMatchObject({ path: "/complaints", method: "POST", body: { branch: "I-8", locationId: 2 } });
  });

  it("sets a complaint's branch", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Branch updated." });
    await updateComplaintBranch(7, 1);
    expect(lastCall()).toMatchObject({ path: "/complaints/7/branch", method: "PATCH", body: { locationId: 1 } });
    await expect(updateComplaintBranch(7, 0)).rejects.toThrow(/Choose the branch/);
  });
});
