// Pure rules of the staff services (no network).

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));
jest.mock("../../apiClient", () => ({
  ApiError: class extends Error {},
  apiRequest: jest.fn(),
  friendlyApiMessage: () => "error",
  serverMessage: () => null,
}));

import {
  addPersonAction,
  canDecideCapacityRequest,
  canWithdrawCapacityRequest,
  validateAttendantInput,
} from "../attendants";
import { buildCustomerPayload, customerToInput, normalizeCustomer, validateCustomerInput } from "../customers";
import { buildQuotationPayload, offeringTypesForLocation, validateQuotationInput } from "../quotations";
import { BOOKING_STATUS_OPTIONS, bookingStatusIdFromLabel } from "../bookings";
import { agreementStatusLabel, validateSendAgreement } from "../agreements";
import { effectiveInvoiceStatus, normalizeInvoice } from "../invoices";
import { complaintStatusLabel, normalizeComplaint, normalizeComplaintStatus, validateComplaintInput } from "../complaints";
import { challanBookingStatusLabel, challanDateToIso, isValidChallanQuery } from "../challan";
import { filterSpaces, floorLabel, privateRoomCapacities, spaceInGroup, spaceMonthlyPrice, spaceTypeGroup, type StaffSpace } from "../lookups";

describe("adding a person to a room (capacity rule)", () => {
  const free = { wouldExceedCapacity: false, allowsOverCapacity: false };
  const fullOffice = { wouldExceedCapacity: true, allowsOverCapacity: true };
  const fullMeeting = { wouldExceedCapacity: true, allowsOverCapacity: false };

  it("free seat: everyone assigns directly", () => {
    expect(addPersonAction(free, "sales_executive")).toBe("assign");
    expect(addPersonAction(free, "admin")).toBe("assign");
  });

  it("full room: a sales executive asks an admin", () => {
    expect(addPersonAction(fullOffice, "sales_executive")).toBe("request-approval");
    expect(addPersonAction(fullMeeting, "sales_executive")).toBe("request-approval");
  });

  it("full room: admins confirm the surcharge in offices, never overfill meeting / shared rooms", () => {
    expect(addPersonAction(fullOffice, "admin")).toBe("confirm-surcharge");
    expect(addPersonAction(fullOffice, "super_admin")).toBe("confirm-surcharge");
    expect(addPersonAction(fullMeeting, "admin")).toBe("not-allowed");
  });

  it("only admins decide; the requester or an admin withdraws; only pending requests", () => {
    const pending = { status: "Pending", requestedByEmail: "Sales@WorkNest.pk" };
    expect(canDecideCapacityRequest(pending, "admin")).toBe(true);
    expect(canDecideCapacityRequest(pending, "sales_executive")).toBe(false);
    expect(canDecideCapacityRequest({ status: "Approved" }, "super_admin")).toBe(false);
    expect(canWithdrawCapacityRequest(pending, "sales_executive", "sales@worknest.pk")).toBe(true);
    expect(canWithdrawCapacityRequest(pending, "sales_executive", "other@worknest.pk")).toBe(false);
    expect(canWithdrawCapacityRequest(pending, "sales_executive", null)).toBe(false);
    expect(canWithdrawCapacityRequest(pending, "admin", "x@y.pk")).toBe(true);
    expect(canWithdrawCapacityRequest({ ...pending, status: "Rejected" }, "admin", "x@y.pk")).toBe(false);
  });

  it("validates a new person like the API", () => {
    const ok = { customerId: 1, name: "Omar", email: "o@x.pk", phone: "03001234567", idType: "CNIC" as const, idNumber: "35202-1234567-1" };
    expect(validateAttendantInput(ok)).toBeNull();
    expect(validateAttendantInput({ ...ok, idNumber: "123" })).toMatch(/CNIC must be 13 digits/);
    expect(validateAttendantInput({ ...ok, idType: "Passport", idNumber: "AB123" })).toBeNull();
    expect(validateAttendantInput({ ...ok, phone: "0300" })).toMatch(/Phone number/);
    expect(validateAttendantInput({ ...ok, email: "nope" })).toMatch(/valid email/);
    expect(validateAttendantInput({ ...ok, customerId: 0 })).toMatch(/customer/);
  });
});

describe("customers", () => {
  it("validation follows the API rules", () => {
    expect(validateCustomerInput({ customerType: "Individual", firstName: "", email: "" })).toEqual({
      firstName: "First name is required.",
      email: "Email is required.",
    });
    const company = validateCustomerInput({ customerType: "Company", firstName: "A", email: "a@x.pk", ntn: "123" });
    expect(company.company).toMatch(/Company/);
    expect(company.ntn).toMatch(/8-digit NTN/);
    expect(validateCustomerInput({ customerType: "AOP", firstName: "A", email: "a@x.pk", company: "X", ntn: "1234567-8" })).toEqual({});
    expect(validateCustomerInput({ customerType: "Individual", firstName: "A", email: "a@x.pk", phoneNumber: "12" }).phoneNumber).toBeTruthy();
  });

  it("payload drops company fields for individuals and blanks become null", () => {
    expect(
      buildCustomerPayload({ customerType: "Individual", firstName: " Ali ", email: " a@x.pk ", company: "Acme", ntn: "1", lastName: " ", cityId: 3 }),
    ).toEqual({
      customerType: "Individual",
      firstName: "Ali",
      lastName: null,
      company: null,
      email: "a@x.pk",
      phoneNumber: null,
      cnicOrPassport: null,
      address: null,
      cityId: 3,
      notes: null,
      ntn: null,
      secpRegistrationNo: null,
      isActive: true,
    });
  });

  it("derives the customer type like the CMS and round-trips to the form", () => {
    expect(normalizeCustomer({ id: 1, company: "Individual" }).customerType).toBe("Individual");
    expect(normalizeCustomer({ id: 1, company: "Acme" }).customerType).toBe("Company");
    expect(normalizeCustomer({ id: 1, customerType: "AOP", company: "Acme" }).customerType).toBe("AOP");
    const c = normalizeCustomer({ Id: 2, FirstName: "Sara", Email: "s@x.pk", IsActive: false });
    expect(c).toMatchObject({ id: 2, firstName: "Sara", isActive: false });
    expect(customerToInput(c)).toMatchObject({ customerType: "Individual", firstName: "Sara", email: "s@x.pk", company: "" });
  });
});

describe("quotations", () => {
  const base = {
    customerId: 1,
    spaceId: 2,
    offeringTypeId: 1,
    offeringType: "24/7",
    startDateTime: "2026-11-01T00:00:00",
    endDateTime: "2027-02-01T00:00:00",
    validUntil: "2026-10-19",
    discountType: "Amount" as const,
    discountValue: 5000,
  };

  it("validates the form", () => {
    expect(validateQuotationInput(base)).toBeNull();
    expect(validateQuotationInput({ ...base, customerId: 0 })).toBe("Choose the customer.");
    expect(validateQuotationInput({ ...base, validUntil: "19/10/2026" })).toMatch(/valid until/);
    expect(validateQuotationInput({ ...base, discountType: "Percentage", discountValue: 120 })).toMatch(/100%/);
    expect(validateQuotationInput({ ...base, discountValue: -1 })).toMatch(/negative/);
  });

  it("an amount discount sends discountPercentage 0", () => {
    expect(buildQuotationPayload(base)).toMatchObject({ discountType: "Amount", discountPercentage: 0, discountValue: 5000, remarks: null });
  });

  it("offering types: shared ones plus the location's own", () => {
    const types = [
      { id: 1, description: "24/7-I8", discountCap: 10, isActive: true, locationId: 1 },
      { id: 4, description: "24/7", discountCap: 10, isActive: true, locationId: 2 },
      { id: 6, description: "Day", discountCap: 5, isActive: true, locationId: null },
    ];
    expect(offeringTypesForLocation(types, 2).map((t) => t.id)).toEqual([4, 6]);
    expect(offeringTypesForLocation(types, null).map((t) => t.id)).toEqual([6]);
  });
});

describe("bookings", () => {
  it("maps labels to the CMS status ids", () => {
    expect(bookingStatusIdFromLabel("Confirmed")).toBe(33);
    expect(bookingStatusIdFromLabel("No Show")).toBe(6);
    expect(bookingStatusIdFromLabel("no_show")).toBe(6);
    expect(bookingStatusIdFromLabel("Cancelled")).toBe(86);
    expect(bookingStatusIdFromLabel("weird")).toBeNull();
    expect(BOOKING_STATUS_OPTIONS.map((o) => o.label)).toEqual(["Pending", "Confirmed", "No Show", "Rejected", "Cancelled"]);
  });
});

describe("agreements", () => {
  it("status label like the CMS", () => {
    expect(agreementStatusLabel("AgreementSent", null)).toBe("Sent");
    expect(agreementStatusLabel("EmailFailed", null)).toBe("Email failed - resend");
    expect(agreementStatusLabel("SignedUploaded", null, "2026-10-01")).toBe("Signed copy received - verify (e-signed)");
    expect(agreementStatusLabel("Signed", 12)).toBe("Signed - booking created");
  });

  it("send validation uses the CNIC / phone rules", () => {
    expect(validateSendAgreement({ quotationId: 1, entityType: "Individual" })).toBeNull();
    expect(validateSendAgreement({ quotationId: 0, entityType: "Individual" })).toMatch(/quotation/);
    expect(validateSendAgreement({ quotationId: 1, entityType: "Individual", cnic: "1" })).toMatch(/CNIC/);
    expect(validateSendAgreement({ quotationId: 1, entityType: "Individual", contractStartDate: "2026-13-01" })).toMatch(/start date/);
  });
});

describe("invoices", () => {
  const today = new Date(2026, 9, 12);
  it("unpaid / partial past due show as Overdue", () => {
    expect(effectiveInvoiceStatus("Unpaid", "2026-10-11", today)).toBe("Overdue");
    expect(effectiveInvoiceStatus("Partial", "2026-10-11T00:00:00", today)).toBe("Overdue");
    expect(effectiveInvoiceStatus("Unpaid", "2026-10-12", today)).toBe("Unpaid");
    expect(effectiveInvoiceStatus("Paid", "2020-01-01", today)).toBe("Paid");
    expect(effectiveInvoiceStatus("", null, today)).toBe("Unpaid");
  });

  it("balance falls back to grand total - WHT - paid", () => {
    expect(normalizeInvoice({ id: 1, grandTotal: 1000, whtAmount: 100, paidTotal: 200 }).balanceDue).toBe(700);
    expect(normalizeInvoice({ id: 1, invoiceTypeId: 6, companyName: "-" })).toMatchObject({ invoiceType: "WHT Invoice", companyName: null });
  });
});

describe("complaints", () => {
  it("normalises status words like the API", () => {
    expect(normalizeComplaintStatus("In Progress")).toBe("in_progress");
    expect(normalizeComplaintStatus("inprogress")).toBe("in_progress");
    expect(normalizeComplaintStatus("CLOSED")).toBe("closed");
    expect(normalizeComplaintStatus("done")).toBeNull();
    expect(complaintStatusLabel("in_progress")).toBe("In Progress");
  });

  it("source and reply labels like the CMS", () => {
    const c = normalizeComplaint({
      id: 1,
      complaintNo: "CMP-000001",
      source: "whatsapp",
      isFollowUp: true,
      previousComplaintNo: "CMP-000000",
      status: "resolved",
      resolvedNotificationSent: true,
    });
    expect(c.sourceLabel).toBe("WhatsApp · follow-up of CMP-000000");
    expect(c.replyLabel).toBe("Waiting for reply");
    expect(normalizeComplaint({ resolutionResponse: "persists" }).replyLabel).toBe("Issue persists");
  });

  it("validates a staff-entered complaint", () => {
    expect(validateComplaintInput({ category: "Cleaning", description: "Bins full" })).toBeNull();
    expect(validateComplaintInput({ category: "", description: "x" })).toMatch(/category/);
    expect(validateComplaintInput({ category: "Noise", description: "x", phoneNumber: "123" })).toMatch(/Phone/);
  });
});

describe("challan validity", () => {
  it("reads the expiry date formats the search returns", () => {
    expect(challanDateToIso("2026-07-29T00:00:00")).toBe("2026-07-29");
    expect(challanDateToIso("29/07/2026")).toBe("2026-07-29");
    expect(challanDateToIso("Jul 29, 2026")).toBe("2026-07-29");
    expect(challanDateToIso("29 Jul 2026")).toBe("2026-07-29");
    expect(challanDateToIso("29 Jul 202")).toBeNull();
    expect(challanDateToIso("31/02/2026")).toBeNull();
  });

  it("status ids and the search input rule", () => {
    expect(challanBookingStatusLabel(5)).toBe("Pending");
    expect(challanBookingStatusLabel(2)).toBe("Confirmed");
    expect(challanBookingStatusLabel(86)).toBe("Cancelled");
    expect(isValidChallanQuery("WN-CH 123")).toBe(true);
    expect(isValidChallanQuery("12;drop")).toBe(false);
    expect(isValidChallanQuery("")).toBe(false);
  });
});

describe("space lookups", () => {
  const space = (over: Partial<StaffSpace>): StaffSpace => ({
    id: 1,
    idGuid: null,
    name: "",
    code: null,
    locationId: 1,
    locationIdGuid: null,
    locationName: null,
    spaceTypeId: null,
    spaceTypeName: null,
    categoryCode: null,
    capacity: 0,
    price: 0,
    pricePerHour: 0,
    pricePerDay: 0,
    pricePerMonth: 0,
    seatPrice: 0,
    status: "Available",
    bookedTill: null,
    floorId: null,
    floor: null,
    imageUrl: null,
    ...over,
  });

  it("groups space types by name like the CMS", () => {
    expect(spaceTypeGroup("Private Office")).toBe("private");
    expect(spaceTypeGroup("Dedicated Desk")).toBe("private");
    expect(spaceTypeGroup("Meeting/Conference")).toBe("meeting");
    expect(spaceTypeGroup("Co-Working Space")).toBe("shared");
    expect(spaceTypeGroup("Event Hall")).toBeNull();
  });

  it("filters spaces by location, group and private-room size", () => {
    const spaces = [
      space({ id: 1, name: "Office 1", spaceTypeName: "Private Office", capacity: 4 }),
      space({ id: 2, name: "Office 2", spaceTypeName: "Private Office", capacity: 6, locationId: 2 }),
      space({ id: 3, name: "Meeting Room 1", spaceTypeName: "Meeting/Conference" }),
      space({ id: 4, name: "Hot desk area", categoryCode: "SHARED" }),
      space({ id: 5, name: "Office 3", spaceTypeName: "Private Office", capacity: 6 }),
    ];
    expect(filterSpaces(spaces, { locationId: 1, group: "private" }).map((s) => s.id)).toEqual([1, 5]);
    expect(filterSpaces(spaces, { locationId: 1, group: "private", capacity: 6 }).map((s) => s.id)).toEqual([5]);
    expect(filterSpaces(spaces, { group: "meeting" }).map((s) => s.id)).toEqual([3]);
    expect(filterSpaces(spaces, { locationId: 1, group: "shared" }).map((s) => s.id)).toEqual([4]);
    expect(privateRoomCapacities(spaces, 1)).toEqual([4, 6]);
    expect(privateRoomCapacities(spaces)).toEqual([4, 6]);
    expect(spaceInGroup(space({ name: "Board meeting" }), "meeting")).toBe(true);
  });

  it("standard monthly price like the CMS", () => {
    expect(spaceMonthlyPrice(space({ pricePerMonth: 40000, price: 1 }))).toBe(40000);
    expect(spaceMonthlyPrice(space({ seatPrice: 30000, price: 1 }))).toBe(30000);
    expect(spaceMonthlyPrice(space({ price: 25000 }))).toBe(25000);
  });

  it("floor labels", () => {
    expect(floorLabel({ id: 3, name: "3rd Floor" })).toBe("3rd Floor");
    expect(floorLabel({ id: 3, floorNumber: 2 })).toBe("Floor 2");
    expect(floorLabel({ id: 3 })).toBe("Floor #3");
  });
});
