// Staff services against a mocked transport: right endpoint, query, method and body (mirroring the CMS), and
// the responses normalised. apiClient / config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "staff@worknest.test" })),
}));
jest.mock("../../apiClient", () => {
  class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { apiRequest, ApiError } from "../../apiClient";
import { actionResult } from "../http";
import { getRoleDashboard, getNavBadges, normalizeRoleDashboard } from "../dashboard";
import { createCustomer, listCustomers, updateCustomer } from "../customers";
import { createQuotation, emailQuotation, listQuotations, sendQuotation, createQuotationVersion } from "../quotations";
import { cancelBooking, listBookings, updateBookingStatus } from "../bookings";
import {
  approveCapacityRequest,
  assignAttendant,
  listCapacityRequests,
  rejectCapacityRequest,
  requestCapacityApproval,
} from "../attendants";
import { listAgreements, markAgreementSigned } from "../agreements";
import { listInvoices } from "../invoices";
import { updateComplaintStatus } from "../complaints";
import { extendChallanValidity, searchChallan } from "../challan";
import { getStaffProfile } from "../profile";

const api = apiRequest as jest.Mock;

beforeEach(() => api.mockReset());

const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

describe("transport", () => {
  it("always authenticates and keeps the raw payload", async () => {
    api.mockResolvedValueOnce({ data: [], total: 0 });
    await listBookings();
    expect(lastCall()).toMatchObject({ path: "/booking?page=1&limit=10", method: "GET", requiresAuth: true, unwrapData: false });
  });

  it("actionResult prefers the server message, but not a bare 'Success'", () => {
    expect(actionResult({ isSuccessful: true, message: "Customer created successfully.", data: { id: 1 } }, "x")).toEqual({
      message: "Customer created successfully.",
      data: { id: 1 },
    });
    expect(actionResult({ isSuccessful: true, message: "Success", data: null }, "Done.")).toEqual({ message: "Done.", data: null });
    expect(actionResult({ message: "Request withdrawn.", isSuccessful: true }, "x").message).toBe("Request withdrawn.");
  });
});

describe("dashboard", () => {
  it("GET dashboard/role with period and locationIds", async () => {
    api.mockResolvedValueOnce({ role: "sales_executive", period: "quarter", sales: { quotationsCreated: 4, conversionPct: 25 } });
    const d = await getRoleDashboard({ period: "quarter", locationIds: [3, 5] });
    expect(lastCall().path).toBe("/dashboard/role?period=quarter&locationIds=3%2C5");
    expect(d.sales?.quotationsCreated).toBe(4);
    expect(d.team).toBeNull();
  });

  it("fills only the sections the role gets", () => {
    const d = normalizeRoleDashboard({
      role: "super_admin",
      team: { openComplaints: 2, offlineMachines: [{ name: "Door 1", lastSeen: null }] },
      locations: [{ locationId: 1, name: "I-8", totalSpaces: 10, occupiedSpaces: 5 }],
      staff: { perLocation: [], people: [{ userId: 9, name: "Sara", role: "sales_executive", quotations: 3 }] },
      system: { hikSyncEnabled: true, hikJobs: [{ job: "online", lastOk: null, running: false }] },
    });
    expect(d.sales).toBeNull();
    expect(d.team?.openComplaints).toBe(2);
    expect(d.locations?.[0]).toMatchObject({ locationId: 1, occupiedSpaces: 5 });
    expect(d.staff?.people[0]).toMatchObject({ name: "Sara", quotations: 3 });
    expect(d.system?.hikJobs[0]).toMatchObject({ job: "online", lastOk: null });
  });

  it("nav badges keep positive whole counts", async () => {
    api.mockResolvedValueOnce({ "/admin/bookings": 2, "/admin/kyc": 0, "/admin/contacts": 1.7, "/admin/x": "n" });
    expect(await getNavBadges()).toEqual({ "/admin/bookings": 2, "/admin/contacts": 1 });
  });
});

describe("customers", () => {
  it("lists with search (not query) and paging", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: [{ id: 1, idGUID: "g", firstName: "Ali", lastName: "Khan", email: "a@x.pk" }] });
    const page = await listCustomers({ page: 1, limit: 20, search: " ali " });
    expect(lastCall().path).toBe("/customer?page=1&limit=20&search=ali");
    expect(page.items[0]).toMatchObject({ id: 1, idGuid: "g", fullName: "Ali Khan", customerType: "Individual" });
    expect(page.hasMore).toBe(false);
  });

  it("validates before calling the API", async () => {
    await expect(
      createCustomer({ customerType: "Individual", firstName: "Ali", email: "a@x.pk", cnicOrPassport: "123" }),
    ).rejects.toThrow("CNIC must be 13 digits");
    expect(api).not.toHaveBeenCalled();
  });

  it("POST customer with the CMS body; PUT sends the whole customer", async () => {
    api.mockResolvedValue({ isSuccessful: true, message: "Customer created successfully.", data: { id: 5, firstName: "Ali", email: "a@x.pk" } });
    const created = await createCustomer({
      customerType: "Company",
      firstName: "Ali",
      email: "a@x.pk",
      company: "Acme",
      ntn: "1234567-8",
      phoneNumber: "0300 1234567",
      cityId: 0,
    });
    expect(lastCall()).toMatchObject({
      path: "/customer",
      method: "POST",
      body: expect.objectContaining({ customerType: "Company", company: "Acme", ntn: "1234567-8", cityId: null, isActive: true }),
    });
    expect(created).toMatchObject({ message: "Customer created successfully.", data: { id: 5 } });

    await updateCustomer("guid-1", { customerType: "Individual", firstName: "Ali", email: "a@x.pk", company: "Acme" });
    expect(lastCall()).toMatchObject({
      path: "/customer/guid-1",
      method: "PUT",
      body: expect.objectContaining({ firstName: "Ali", email: "a@x.pk", company: null }),
    });
  });
});

describe("quotations", () => {
  const input = {
    customerId: 4,
    spaceId: 9,
    offeringTypeId: 1,
    offeringType: "24/7",
    startDateTime: "2026-11-01T00:00:00",
    endDateTime: "2027-11-01T00:00:00",
    validUntil: "2026-10-19",
    discountType: "Percentage" as const,
    discountValue: 5,
    billingPeriodMonths: 3,
    securityDepositMonths: 2,
  };

  it("lists with locationId and keeps total", async () => {
    api.mockResolvedValueOnce({ data: [{ id: 1, quotationNumber: "WN-QT-1", version: 2, status: "Sent" }], total: 30, page: 1, limit: 10 });
    const page = await listQuotations({ search: "WN", locationId: 2 });
    expect(lastCall().path).toBe("/quotation?page=1&limit=10&search=WN&locationId=2");
    expect(page).toMatchObject({ total: 30, hasMore: true });
    expect(page.items[0]).toMatchObject({ id: 1, quotationNumber: "WN-QT-1", version: 2, status: "Sent" });
  });

  it("creates with the discount fields the CMS sends", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Quotation generated successfully.", data: { id: 77, status: "Active" } });
    const res = await createQuotation(input);
    expect(lastCall()).toMatchObject({
      path: "/quotation",
      method: "POST",
      body: expect.objectContaining({ discountType: "Percentage", discountPercentage: 5, discountValue: 5, floorId: null, validUntil: "2026-10-19" }),
    });
    expect(res.data.id).toBe(77);
  });

  it("sends the chosen deposit months (0 stays 0) and no deposit override; reads the stored months, never a default", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { id: 78, securityDepositMonths: 0, securityDeposit: 0 } });
    const res = await createQuotation({ ...input, securityDepositMonths: 0 });
    expect(lastCall().body).toMatchObject({ securityDepositMonths: 0, securityDepositOverride: null });
    expect(res.data).toMatchObject({ securityDepositMonths: 0, securityDeposit: 0 });
    // An older API without the field: null (the screens fall back to the stored amount).
    api.mockResolvedValueOnce({ isSuccessful: true, data: { id: 79, securityDeposit: 126000 } });
    expect((await createQuotation(input)).data).toMatchObject({ securityDepositMonths: null, securityDeposit: 126000 });
  });

  it("refuses an end before the start without calling the API", async () => {
    await expect(createQuotation({ ...input, endDateTime: "2026-10-01T00:00:00" })).rejects.toThrow("after the start");
    expect(api).not.toHaveBeenCalled();
  });

  it("send uses the version route; new version posts no fields; email sends only the address", async () => {
    api.mockResolvedValue({ isSuccessful: true, message: "Quotation sent successfully.", data: null });
    await sendQuotation(12, 3);
    expect(lastCall()).toMatchObject({ path: "/quotation/12/versions/3/send", method: "POST", body: {} });
    await createQuotationVersion(12);
    expect(lastCall()).toMatchObject({ path: "/quotation/12/versions", method: "POST", body: {} });
    await emailQuotation(12, " ");
    expect(lastCall()).toMatchObject({ path: "/quotation/12/send-email", body: { email: null } });
  });
});

describe("bookings", () => {
  it("normalises list rows and status", async () => {
    api.mockResolvedValueOnce({ data: [{ bookingId: 8, customerName: "Acme", bookingStatusLabel: "Confirmed", spaceName: "Office 2" }], total: 1 });
    const page = await listBookings({ search: "acme" });
    expect(page.items[0]).toMatchObject({ bookingId: 8, statusLabel: "Confirmed", statusId: 33 });
  });

  it("staff change status with PATCH status { statusId }; cancel is 86", async () => {
    api.mockResolvedValue({ isSuccessful: true, message: "Booking status updated.", data: null });
    await updateBookingStatus(8, 6);
    expect(lastCall()).toMatchObject({ path: "/booking/8/status", method: "PATCH", body: { statusId: 6 } });
    await cancelBooking(8);
    expect(lastCall()).toMatchObject({ path: "/booking/8/status", body: { statusId: 86 } });
  });
});

describe("attendants and capacity requests", () => {
  it("assign sends no assignedFrom", async () => {
    api.mockResolvedValueOnce({ message: "Attendant successfully assigned to booking.", data: { isOverCapacity: false } });
    await assignAttendant(31, { personId: 4, customerId: 2 });
    expect(lastCall()).toMatchObject({ path: "/bookings/31/attendants", method: "POST", body: { personId: 4, customerId: 2 } });
  });

  it("request approval: new id vs already pending", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, id: 15, message: "Room is full, so an admin has been asked to approve adding this person." });
    const created = await requestCapacityApproval(31, { personId: 4, customerId: 2 });
    expect(lastCall()).toMatchObject({ path: "/bookings/31/capacity-requests", body: { personId: 4, customerId: 2 } });
    expect(created.data).toEqual({ id: 15, alreadyPending: false });

    api.mockResolvedValueOnce({ isSuccessful: true, message: "A request for this person is already waiting for an admin." });
    const again = await requestCapacityApproval(31, { personId: 4, customerId: 2 });
    expect(again).toMatchObject({ message: "A request for this person is already waiting for an admin.", data: { id: null, alreadyPending: true } });
  });

  it("lists pending requests by default and reads requestedAt as UTC", async () => {
    api.mockResolvedValueOnce([{ id: 1, status: "Pending", requestedAt: "2026-10-12T05:00:00", requestedByEmail: "s@x.pk", personName: "Omar" }]);
    const list = await listCapacityRequests({ bookingDetailId: 31 });
    expect(lastCall().path).toBe("/capacity-requests?status=Pending&bookingDetailId=31");
    expect(list[0]).toMatchObject({ id: 1, requestedAt: "2026-10-12T05:00:00Z", personName: "Omar" });
  });

  it("approve posts {}; reject sends the note (or null)", async () => {
    api.mockResolvedValue({ isSuccessful: true, message: "Request rejected." });
    await approveCapacityRequest(1);
    expect(lastCall()).toMatchObject({ path: "/capacity-requests/1/approve", method: "POST", body: {} });
    await rejectCapacityRequest(1, "  ");
    expect(lastCall()).toMatchObject({ path: "/capacity-requests/1/reject", body: { note: null } });
    await rejectCapacityRequest(1, "Room is too small");
    expect(lastCall()).toMatchObject({ body: { note: "Room is too small" } });
  });
});

describe("agreements, invoices, complaints", () => {
  it("agreements list reads totalCount and derives the status label", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: [{ id: 3, status: "SignedUploaded", signedPdfUploadedAt: "2026-10-01T10:00:00" }],
      totalCount: 1,
      page: 1,
      limit: 20,
    });
    const page = await listAgreements({ status: "SignedUploaded" });
    expect(lastCall().path).toBe("/agreement?page=1&limit=20&status=SignedUploaded");
    expect(page.items[0]).toMatchObject({ id: 3, hasSignedPdf: true, statusLabel: "Signed copy received - verify" });
  });

  it("mark signed posts the note only when given", async () => {
    api.mockResolvedValue({ isSuccessful: true, message: "Agreement marked as Signed.", data: { id: 3, bookingId: 40 } });
    const res = await markAgreementSigned(3);
    expect(lastCall()).toMatchObject({ path: "/agreement/3/mark-signed", body: {} });
    expect(res.data.bookingId).toBe(40);
  });

  it("invoices list keeps the server balance and applies the overdue rule", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: [{ id: 1, invoiceNumber: "INV-1", grandTotal: 100, paidTotal: 10, balanceDue: 80, statusLabel: "Unpaid", dueOn: "2020-01-01" }],
      totalCount: 1,
    });
    const page = await listInvoices({ locationId: 2 });
    expect(lastCall().path).toBe("/invoice?page=1&limit=20&locationId=2");
    expect(page.items[0]).toMatchObject({ balanceDue: 80, statusLabel: "Unpaid", status: "Overdue" });
  });

  it("complaint status uses the API's status words", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Complaint updated.", data: { notified: false } });
    await updateComplaintStatus(5, "in_progress", " called back ");
    expect(lastCall()).toMatchObject({ path: "/complaints/5/status", method: "PATCH", body: { status: "in_progress", staffNotes: "called back" } });
  });
});

describe("challan validity", () => {
  it("search returns null on 404", async () => {
    api.mockRejectedValueOnce(new (ApiError as any)("No challan found for the given search term.", 404));
    expect(await searchChallan("WN-123")).toBeNull();
    expect(lastCall().path).toBe("/challan/search?q=WN-123");
  });

  it("search normalises the row", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: { bookingId: 12, challanNumber: "CH-1", currentExpiryDate: "29/07/2026", bookingStatus: 33, customerName: "Acme", spaceName: "Office 1" },
    });
    expect(await searchChallan("12")).toMatchObject({ bookingId: 12, currentExpiryDate: "2026-07-29", bookingStatus: "Confirmed" });
  });

  it("extend refuses a date not after the current expiry", async () => {
    await expect(
      extendChallanValidity({ bookingId: 12, newExpiryDate: "2026-07-29", currentExpiryDate: "2026-07-29" }),
    ).rejects.toThrow("after the current expiry");
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Challan validity extended successfully.", data: {} });
    await extendChallanValidity({ bookingId: 12, newExpiryDate: "2026-08-15", remarks: "" });
    expect(lastCall()).toMatchObject({ path: "/challan/extend-validity", body: { bookingId: 12, newExpiryDate: "2026-08-15" } });
    expect(lastCall().body).not.toHaveProperty("remarks");
  });
});

describe("profile", () => {
  it("reads locations from auth/me", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { email: "s@x.pk", role: "admin", locationId: 2, locationIds: [2, 4] } });
    expect(await getStaffProfile()).toMatchObject({ role: "admin", locationId: 2, locationIds: [2, 4] });
    api.mockResolvedValueOnce({ isSuccessful: true, data: { email: "s@x.pk", role: "admin", locationId: 2, locationIds: [] } });
    expect((await getStaffProfile()).locationIds).toEqual([2]);
  });
});
