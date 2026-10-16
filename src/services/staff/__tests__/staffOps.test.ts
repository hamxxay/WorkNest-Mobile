// QA_06 staff app operations against a mocked transport, with the answers as the API sends them: add by CNIC,
// fingerprint / face / card enrolment, what the door machines did after access on / off and Remove, the surcharge
// invoice warning, Send agreement amounts, Record payment, the initial invoice, and the door events cap.
// apiClient / config / authStorage are mocked so React Native is never loaded.

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
  const serverMessage = (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null);
  return {
    ApiError,
    apiRequest: jest.fn(),
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage,
    errorMessage: (e: any, fallback = "Something went wrong.") => (e instanceof Error ? e.message : fallback),
  };
});

import { apiRequest, ApiError } from "../../apiClient";
import { addAttendantByCnic, assignAttendant, byCnicProblem, removeAttendant, setDoorAccess } from "../attendants";
import {
  cardNumberError,
  enrolAttendant,
  enrolBlockedReason,
  getRoomMachine,
  machineSyncNotice,
  normalizeMachineSync,
  normalizeRoomMachine,
  normalizeStaffEnrolResult,
  staffEnrolPrompt,
  staffEnrolSummary,
  STAFF_ENROL_TIMEOUT_MS,
} from "../doorMachines";
import { agreementAmount, agreementFormProblems, sendAgreement } from "../agreements";
import { getInvoice, invoiceCashBalance, normalizeInvoice, recordInvoicePayment, validateRecordPayment } from "../invoices";
import {
  canSendInitialInvoice,
  getInitialInvoiceStatus,
  getWhtRates,
  initialChoiceFromPreview,
  initialInvoiceQuery,
  previewInitialInvoice,
  sendInitialInvoice,
} from "../initialInvoice";
import { accessEventsCapNote, ACCESS_EVENTS_LIMIT } from "../accessActivity";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};
const apiError = (status: number, body: unknown) => new (ApiError as any)((body as any)?.message ?? "x", status, body);

// ─── 1. Add by CNIC ──────────────────────────────────────────────────────────────────────────────────────

describe("add a customer-added employee by CNIC", () => {
  it("posts { idNumber } and returns the person on 200", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      message: "Employee verified and added. Now add their fingerprint or face.",
      data: { personId: 77, name: "Sara Khan", email: "sara@x.pk", phone: "+923001234567", idType: "CNIC", idNumber: "35202-1234567-1" },
    });
    const out = await addAttendantByCnic(31, " 35202-1234567-1 ");
    expect(lastCall()).toMatchObject({ path: "/bookings/31/attendants/by-cnic", method: "POST", body: { idNumber: "35202-1234567-1" } });
    expect(out).toMatchObject({ kind: "added", message: "Employee verified and added. Now add their fingerprint or face.", person: { personId: 77, name: "Sara Khan" } });
  });

  it("404 / canAddManually -> offer Add manually with the API's message", async () => {
    api.mockRejectedValueOnce(apiError(404, { isSuccessful: false, message: "No employee with this CNIC was added by the customer for this booking.", data: { canAddManually: true } }));
    expect(await addAttendantByCnic(31, "35202-1234567-1")).toEqual({
      kind: "not-found",
      message: "No employee with this CNIC was added by the customer for this booking.",
      canAddManually: true,
    });
  });

  it("409 shows the message (no manual add); 503 a plain message with manual add", async () => {
    api.mockRejectedValueOnce(apiError(409, { isSuccessful: false, message: "Sara Khan is already on this booking." }));
    expect(await addAttendantByCnic(31, "3520212345671")).toMatchObject({ kind: "already", message: "Sara Khan is already on this booking.", canAddManually: false });
    api.mockRejectedValueOnce(apiError(503, { isSuccessful: false, message: "Run EMP_01 on the database." }));
    const unavailable = await addAttendantByCnic(31, "3520212345671");
    expect(unavailable).toMatchObject({ kind: "unavailable", canAddManually: true });
    expect(unavailable.message).not.toMatch(/EMP_01/);
  });

  it("other refusals (room full for a sales executive) throw with the API's message", async () => {
    const full = apiError(400, { isSuccessful: false, message: "Office 329 is full (6 of 6 seats). Only an admin can add more people to this room." });
    expect(byCnicProblem(full)).toBeNull();
    api.mockRejectedValueOnce(full);
    await expect(addAttendantByCnic(31, "3520212345671")).rejects.toThrow(/Only an admin/);
  });

  it("checks the CNIC before calling the API", async () => {
    await expect(addAttendantByCnic(31, "")).rejects.toThrow("Enter the CNIC.");
    await expect(addAttendantByCnic(31, "12345")).rejects.toThrow(/13 digits/);
    expect(api).not.toHaveBeenCalled();
  });
});

// ─── 7. Surcharge invoice warning ────────────────────────────────────────────────────────────────────────

describe("assign: the answer's data (no isSuccessful)", () => {
  it("reads isOverCapacity / surchargeInvoiceError from data", async () => {
    api.mockResolvedValueOnce({
      message: "Attendant successfully assigned to booking.",
      data: {
        isOverCapacity: true,
        surchargeApplied: 15000,
        surchargeInvoiceError: "The attendant was added, but the surcharge invoice could not be created. Please create it from Invoices.",
      },
    });
    const res = await assignAttendant(31, { personId: 4, customerId: 2 });
    expect(res.data).toEqual({
      isOverCapacity: true,
      surchargeApplied: 15000,
      surchargeInvoiceError: "The attendant was added, but the surcharge invoice could not be created. Please create it from Invoices.",
    });
  });

  it("no error when the invoice was made", async () => {
    api.mockResolvedValueOnce({ message: "Attendant successfully assigned to booking.", data: { isOverCapacity: false } });
    expect((await assignAttendant(31, { personId: 4, customerId: 2 })).data.surchargeInvoiceError).toBeNull();
  });
});

// ─── 5. Machines after access on / off and Remove ────────────────────────────────────────────────────────

const machines = (over: Record<string, unknown> = {}) => ({
  enabled: false,
  people: 1,
  notEnrolled: 0,
  suspended: false,
  error: null,
  devices: [
    { deviceId: 1, device: "Office 329", ok: true, queued: false, error: null },
    { deviceId: 2, device: "Entrance 1", ok: true, queued: false, error: null },
  ],
  ...over,
});

describe("what the door machines did", () => {
  it("access status and remove keep the machines' answer", async () => {
    api.mockResolvedValueOnce({ message: "Access status toggled to Disabled for attendant.", rowsUpdated: 1, machines: machines() });
    const res = await setDoorAccess({ bookingDetailId: 31, customerId: 2, personId: 4, isEnabled: false });
    expect(lastCall()).toMatchObject({ path: "/access-status", method: "PATCH" });
    expect(res.data.machines?.devices).toHaveLength(2);

    api.mockResolvedValueOnce({ message: "Attendant soft-removed from booking assignment and access revoked.", machines: machines({ people: 0, devices: [] }) });
    const removed = await removeAttendant(31, 4);
    expect(lastCall()).toMatchObject({ path: "/bookings/31/attendants/4", method: "DELETE" });
    expect(removed.data.machines).toMatchObject({ people: 0 });
  });

  it("all machines: success", () => {
    const n = machineSyncNotice(normalizeMachineSync({ machines: machines() }), "Sara Khan", "disable");
    expect(n).toEqual({ tone: "success", message: "Door access turned off for Sara Khan on 2 machines.", problems: [] });
  });

  it("suspended booking: access on is saved but doors stay blocked", () => {
    const n = machineSyncNotice(normalizeMachineSync({ machines: machines({ enabled: true, suspended: true }) }), "Sara Khan", "enable");
    expect(n.tone).toBe("warning");
    expect(n.message).toMatch(/stay blocked while the challan is overdue/);
  });

  it("offline machines are queued and named", () => {
    const sync = normalizeMachineSync({
      machines: machines({
        devices: [
          { device: "Office 329", ok: true, queued: false },
          { device: "Entrance 1", ok: false, queued: true, error: "Machine offline - change queued; applies when it reconnects." },
        ],
      }),
    });
    const n = machineSyncNotice(sync, "Sara Khan", "remove");
    expect(n.tone).toBe("warning");
    expect(n.message).toBe("Sara Khan removed from the room and blocked on 1 machine. 1 offline machine will update when it reconnects: Entrance 1.");
    expect(n.problems).toEqual([{ device: "Entrance 1", status: "Offline: the change is queued and applies when it reconnects", queued: true }]);
  });

  it("failed machines: danger with the error", () => {
    const sync = normalizeMachineSync({ machines: machines({ devices: [{ device: "Office 329", ok: false, queued: false, error: "Sara Khan: device busy" }] }) });
    const n = machineSyncNotice(sync, "Sara Khan", "disable");
    expect(n.tone).toBe("danger");
    expect(n.message).toMatch(/1 machine could not be updated: Office 329/);
    expect(n.problems[0].status).toBe("Failed: Sara Khan: device busy");
  });

  it("never enrolled: nothing to change at the door", () => {
    expect(machineSyncNotice(normalizeMachineSync({ machines: machines({ people: 0, notEnrolled: 1, devices: [] }) }), "Sara Khan", "enable")).toMatchObject({
      tone: "success",
      message: "Door access turned on for Sara Khan. Not enrolled on any machine yet, so there was nothing to change at the door.",
    });
    expect(machineSyncNotice(null, "", "remove").message).toMatch(/^This person removed from the room\. Not enrolled/);
  });
});

// ─── 3. Enrolment ────────────────────────────────────────────────────────────────────────────────────────

describe("fingerprint / face / card enrolment", () => {
  const ok = {
    ok: true,
    type: "fingerprint",
    machineId: "120",
    devices: [
      { deviceId: 1, device: "Office 329", ok: true, queued: false, verified: true },
      { deviceId: 2, device: "Entrance 1", ok: false, queued: true, error: "Machine offline - queued" },
    ],
    queuedCount: 1,
    summary: "Saved on 1 of 1 machines · 1 machine offline (queued)",
  };

  it("posts fingerNo with the long time limit", async () => {
    api.mockResolvedValueOnce(ok);
    const res = await enrolAttendant({ bookingDetailId: 31, personId: 4, kind: "fingerprint", fingerNo: 3 });
    expect(lastCall()).toMatchObject({ path: "/bookings/31/attendants/4/hik/fingerprint", method: "POST", body: { fingerNo: 3 }, timeoutMs: STAFF_ENROL_TIMEOUT_MS });
    expect(STAFF_ENROL_TIMEOUT_MS).toBe(120000);
    expect(res).toMatchObject({ ok: true, kind: "fingerprint", queuedCount: 1 });
    expect(staffEnrolSummary(res)).toBe("Saved on 1 of 1 machines · 1 machine offline (queued)");
  });

  it("a typed card number is sent and checked first", async () => {
    api.mockResolvedValueOnce({ ...ok, type: "card", cardNo: "0012345" });
    await enrolAttendant({ bookingDetailId: 31, personId: 4, kind: "card", cardNo: " 0012345 " });
    expect(lastCall()).toMatchObject({ path: "/bookings/31/attendants/4/hik/card", body: { fingerNo: 1, cardNo: "0012345" } });
    await expect(enrolAttendant({ bookingDetailId: 31, personId: 4, kind: "card", cardNo: "12-34" })).rejects.toThrow(/1 to 32 letters or digits/);
    expect(cardNumberError("")).toBe("Enter the card number.");
    expect(cardNumberError("A".repeat(33))).not.toBeNull();
  });

  it("a refused enrolment (400 with the result) resolves with ok false and the reason", async () => {
    api.mockRejectedValueOnce(
      apiError(400, { ok: false, type: "face", error: "Office 329 (the booked room's machine) is offline - enrollment can't be captured.", devices: [] }),
    );
    const res = await enrolAttendant({ bookingDetailId: 31, personId: 4, kind: "face" });
    expect(res).toMatchObject({ ok: false, kind: "face", error: "Office 329 (the booked room's machine) is offline - enrollment can't be captured." });
  });

  it("a timeout says it may still have finished", async () => {
    api.mockRejectedValueOnce(new (ApiError as any)("The server took too long to respond. Please try again.", 0));
    await expect(enrolAttendant({ bookingDetailId: 31, personId: 4, kind: "face" })).rejects.toThrow(/may still have finished/);
  });

  it("prompts name the room machine", () => {
    expect(staffEnrolPrompt("fingerprint", "Sara Khan", "Office 329", { fingerNo: 2 })).toBe(
      "Ask Sara Khan to stand at the Office 329 machine and place finger 2 on the reader.",
    );
    expect(staffEnrolPrompt("face", "", "Office 329", { machineName: "Room 329 Door" })).toBe(
      "Ask the person to stand at the Room 329 Door machine (Office 329) and look at the camera.",
    );
    expect(staffEnrolPrompt("card", "Sara", "Office 329")).toBe("Ask Sara to stand at the Office 329 machine and tap the card on the reader.");
    expect(staffEnrolPrompt("card", "Sara", "Office 329", { cardNo: "77" })).toBe("Saving card 77 for Sara on the machines.");
  });

  it("missing ok: true only when a machine saved it and none failed", () => {
    expect(normalizeStaffEnrolResult({ devices: [{ device: "A", ok: true }] }, "face").ok).toBe(true);
    expect(normalizeStaffEnrolResult({ devices: [{ device: "A", ok: false, error: "x" }] }, "face").ok).toBe(false);
  });

  it("room machine status: off with the reason only when the server checked it", async () => {
    expect(enrolBlockedReason(normalizeRoomMachine({ checked: true, name: "Office 329", online: false, canEnrol: false, reason: "Office 329 is offline." }))).toBe(
      "Office 329 is offline.",
    );
    expect(enrolBlockedReason(normalizeRoomMachine({ checked: true, name: "Office 329", online: true, canEnrol: true }))).toBeNull();
    expect(enrolBlockedReason(normalizeRoomMachine({ checked: false }))).toBeNull();
    expect(enrolBlockedReason(null)).toBeNull();
    api.mockRejectedValueOnce(apiError(404, { message: "Not found" }));
    expect(await getRoomMachine(31)).toBeNull(); // older server: buttons stay on
    expect(lastCall().path).toBe("/bookings/31/room-machine");
  });
});

// ─── 2. Send agreement ───────────────────────────────────────────────────────────────────────────────────

describe("send agreement amounts", () => {
  it("blank fee / deposit are sent as 0, never null", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Lease agreement generated and sent successfully.", data: { id: 9 } });
    await sendAgreement({ quotationId: 5, entityType: "Individual", fullName: "Sara Khan", feeAmount: 630000, securityDeposit: undefined });
    expect(lastCall().body).toMatchObject({ feeAmount: 630000, securityDeposit: 0 });
    api.mockResolvedValueOnce({ isSuccessful: true, data: { id: 9 } });
    await sendAgreement({ quotationId: 5, entityType: "Individual", fullName: "Sara Khan", feeAmount: Number.NaN });
    expect(lastCall().body).toMatchObject({ feeAmount: 0, securityDeposit: 0 });
  });

  it("amount fields: blank is 0", () => {
    expect(agreementAmount("")).toBe(0);
    expect(agreementAmount(" 1,200.5 ")).toBe(1200.5);
    expect(agreementAmount("abc")).toBeNaN();
  });

  it("what the API needs is checked in the form", () => {
    const ok = {
      entityType: "Individual" as const,
      fullName: "Sara Khan",
      cnic: "35202-1234567-1",
      address: "Office 12, I-8 Markaz",
      contractStartDate: "2026-11-01",
      contractEndDate: "2027-10-31",
      fee: "630000",
      deposit: "0",
    };
    expect(agreementFormProblems(ok)).toEqual({});
    expect(agreementFormProblems({ ...ok, fee: "", deposit: "", address: " " })).toEqual({
      fee: "Enter the fee per billing cycle (more than 0).",
      address: "Enter the customer's address.",
    });
    expect(agreementFormProblems({ ...ok, deposit: "-1" }).deposit).toMatch(/0 if there is none/);
    // The send form shows the quotation's deposit read-only and passes none: nothing to check.
    expect(agreementFormProblems({ ...ok, deposit: undefined })).toEqual({});
    expect(agreementFormProblems({ ...ok, contractStartDate: null, contractEndDate: null })).toMatchObject({ start: expect.any(String), end: expect.any(String) });
    expect(agreementFormProblems({ ...ok, contractEndDate: "2026-10-01" }).end).toMatch(/after the start/);
    expect(agreementFormProblems({ ...ok, cnic: "" }).cnic).toBe("Enter the customer's CNIC.");
    expect(agreementFormProblems({ ...ok, entityType: "Company", cnic: "", ntn: "1234567-8", companyName: "Acme" })).toEqual({});
  });
});

// ─── 4. Record payment / 9. clean name ──────────────────────────────────────────────────────────────────

describe("record payment", () => {
  it("cash balance leaves out the WHT the customer withholds", () => {
    expect(invoiceCashBalance({ grandTotal: 1000, whtAmount: 100, paidTotal: 200, statusLabel: "Partial" })).toBe(700);
    expect(invoiceCashBalance({ grandTotal: 1000, whtAmount: 100, paidTotal: 900, statusLabel: "Partial" })).toBe(0);
    expect(invoiceCashBalance({ grandTotal: 1000, whtAmount: 0, paidTotal: 0, statusLabel: "Paid" })).toBe(0);
  });

  it("posts the payment like the CMS", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Payment recorded successfully", data: { paidTotal: 700, statusId: 12 } });
    const res = await recordInvoicePayment(430, { paidAmount: 700, paymentMethod: "Cheque", transactionRef: " CHQ-1 ", notes: "" }, 900);
    expect(lastCall()).toMatchObject({
      path: "/invoice/430/record-payment",
      method: "POST",
      body: { paidAmount: 700, paymentMethod: "Cheque", transactionRef: "CHQ-1", notes: null },
    });
    expect(res).toEqual({ message: "Payment recorded.", data: { paidTotal: 700, statusId: 12 } });
  });

  it("validates the amount and method", () => {
    expect(validateRecordPayment({ paidAmount: 0, paymentMethod: "Cash" })).toMatch(/more than 0/);
    expect(validateRecordPayment({ paidAmount: 1001, paymentMethod: "Cash" }, 1000)).toMatch(/more than what is left/);
    expect(validateRecordPayment({ paidAmount: 1000, paymentMethod: "Cash" }, 1000)).toBeNull();
    expect(validateRecordPayment({ paidAmount: 10, paymentMethod: "Gold" as any })).toMatch(/how it was paid/);
  });

  it("the detail keeps the list's customer name and a balance without WHT", async () => {
    const row = normalizeInvoice({ id: 430, invoiceNumber: "INV-2026-00430", customerName: "Haroon Laghari", grandTotal: 1000, paidTotal: 0, balanceDue: 900, statusLabel: "Unpaid" });
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: { id: 430, customerName: "Haroon Laghari Laghari", grandTotal: 1000, paidTotal: 0, balanceDue: 1000, whtAmount: 100, statusLabel: "Unpaid", lines: [] },
    });
    const inv = await getInvoice(430, row);
    expect(inv).toMatchObject({ customerName: "Haroon Laghari", balanceDue: 900, whtAmount: 100 });
  });
});

// ─── 6. Initial invoice ──────────────────────────────────────────────────────────────────────────────────

describe("initial invoice", () => {
  it("query: preview, the signed date and the type", () => {
    expect(initialInvoiceQuery({ preview: true })).toEqual({ preview: "true", issuedOn: undefined, invoiceType: undefined, whTaxId: undefined });
    expect(initialInvoiceQuery({ issuedOn: "2026-10-15", choice: { type: "wht", whTaxId: 2 } })).toEqual({
      preview: undefined,
      issuedOn: "2026-10-15",
      invoiceType: "wht",
      whTaxId: 2,
    });
    expect(initialInvoiceQuery({ issuedOn: "15/10/2026", choice: { type: "standard" } })).toMatchObject({ issuedOn: undefined, invoiceType: "standard" });
  });

  it("preview posts with ?preview=true and reads the figures", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: { bookingId: 561, rent: 735000, tax: 5760, serviceCharge: 36000, securityDeposit: 420000, grandTotal: 1160760, hasExistingInvoice: false, bookingWhTaxId: 2, billingMonths: 3 },
    });
    const p = await previewInitialInvoice(561, { issuedOn: "2026-10-15" });
    expect(lastCall()).toMatchObject({ path: "/booking/561/send-initial-invoice?preview=true&issuedOn=2026-10-15", method: "POST" });
    expect(p).toMatchObject({ grandTotal: 1160760, netPayableAfterWht: 1160760, hasExistingInvoice: false });
    expect(initialChoiceFromPreview(p)).toEqual({ type: "wht", whTaxId: 2 });
    expect(initialChoiceFromPreview({ bookingWhTaxId: null })).toEqual({ type: "standard" });
  });

  it("send posts the choice; a WHT choice needs its rate", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Initial invoice INV-1 created and emailed." });
    const res = await sendInitialInvoice(561, { choice: { type: "standard" } });
    expect(lastCall()).toMatchObject({ path: "/booking/561/send-initial-invoice?invoiceType=standard", method: "POST" });
    expect(res.message).toBe("Initial invoice INV-1 created and emailed.");
    await expect(sendInitialInvoice(561, { choice: { type: "wht", whTaxId: 0 } })).rejects.toThrow(/WHT rate/);
  });

  it("status: sent / not sent / unknown on an older server", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { bookingId: 561, sent: true, invoiceId: 430, invoiceNumber: "INV-2026-00430" } });
    expect(await getInitialInvoiceStatus(561)).toEqual({ sent: true, invoiceId: 430, invoiceNumber: "INV-2026-00430" });
    expect(lastCall().path).toBe("/booking/561/initial-invoice");
    api.mockResolvedValueOnce({ isSuccessful: true, data: { bookingId: 562, sent: false, invoiceId: null, invoiceNumber: null } });
    expect(await getInitialInvoiceStatus(562)).toMatchObject({ sent: false });
    api.mockRejectedValueOnce(apiError(404, { message: "Not found" }));
    expect(await getInitialInvoiceStatus(563)).toBeNull();
  });

  it("WHT rates and which bookings can get the invoice", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: [{ id: 2, description: "Rent", rate: 16 }, { id: 0, description: "", rate: 0 }] });
    expect(await getWhtRates()).toEqual([{ id: 2, description: "Rent", rate: 16 }]);
    expect(canSendInitialInvoice("Confirmed")).toBe(true);
    expect(canSendInitialInvoice("Cancelled")).toBe(false);
    expect(canSendInitialInvoice("Rejected")).toBe(false);
  });
});

// ─── 12. Door events cap ─────────────────────────────────────────────────────────────────────────────────

describe("door events cap", () => {
  it("says when the newest 2000 are shown", () => {
    expect(ACCESS_EVENTS_LIMIT).toBe(2000);
    expect(accessEventsCapNote(1999)).toBeNull();
    expect(accessEventsCapNote(2000)).toBe("Showing the latest 2,000 door events. Choose a shorter period or one door to see older ones.");
  });
});
