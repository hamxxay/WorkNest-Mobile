// Delete account (Google Play rule): reading the API's check, what the sheet shows for each answer (eligibility
// messages), the DELETE confirmation, who may delete themselves, and the two calls against a mocked transport.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));
jest.mock("../../apiClient", () => ({ ...jest.requireActual("../../apiClient"), apiRequest: jest.fn() }));

import { ApiError, apiRequest } from "../../apiClient";
import {
  ACCOUNT_ENDPOINTS,
  blockedMessage,
  canSelfDelete,
  deleteEligibility,
  deleteMyAccount,
  getDeleteCheck,
  isDeleteConfirmed,
  normalizeDeleteCheck,
  refusalCheckOf,
  STAFF_DELETE_MESSAGE,
} from "../accountDeletion";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());

describe("normalizeDeleteCheck", () => {
  it("reads a free account", () => {
    expect(
      normalizeDeleteCheck({
        canDelete: true,
        reason: null,
        reasonCode: null,
        isCustomerAccount: true,
        activeBookings: 0,
        pendingBookings: 0,
        unpaidInvoices: 0,
        balanceDue: 0,
        needsDatabaseUpdate: null,
      }),
    ).toEqual({
      canDelete: true,
      reason: null,
      reasonCode: null,
      isCustomerAccount: true,
      activeBookings: 0,
      pendingBookings: 0,
      unpaidInvoices: 0,
      balanceDue: 0,
      needsDatabaseUpdate: null,
    });
  });

  it("reads PascalCase and string numbers", () => {
    const check = normalizeDeleteCheck({
      CanDelete: false,
      Reason: " You can't delete your account while you have an active booking. ",
      ReasonCode: "active_booking",
      ActiveBookings: "2",
      UnpaidInvoices: 1,
      BalanceDue: "1500.5",
    });
    expect(check.canDelete).toBe(false);
    expect(check.reasonCode).toBe("active_booking");
    expect(check.reason).toBe("You can't delete your account while you have an active booking.");
    expect(check.activeBookings).toBe(2);
    expect(check.unpaidInvoices).toBe(1);
    expect(check.balanceDue).toBe(1500.5);
  });

  it("never treats a missing or odd answer as 'can delete'", () => {
    expect(normalizeDeleteCheck(null).canDelete).toBe(false);
    expect(normalizeDeleteCheck({}).canDelete).toBe(false);
    expect(normalizeDeleteCheck({ canDelete: "true" }).canDelete).toBe(false);
    expect(normalizeDeleteCheck({ canDelete: true, reasonCode: "active_booking" }).canDelete).toBe(false);
  });

  it("drops unknown reason codes and negative counts", () => {
    const check = normalizeDeleteCheck({ canDelete: false, reasonCode: "something_else", activeBookings: -3, balanceDue: -1 });
    expect(check.reasonCode).toBeNull();
    expect(check.activeBookings).toBe(0);
    expect(check.balanceDue).toBe(0);
  });

  it("marks staff accounts as not customer accounts", () => {
    expect(normalizeDeleteCheck({ canDelete: false, reasonCode: "staff_account" }).isCustomerAccount).toBe(false);
  });
});

describe("deleteEligibility", () => {
  const base = normalizeDeleteCheck({});

  it("can delete", () => {
    expect(deleteEligibility({ ...base, canDelete: true }).state).toBe("can_delete");
  });

  it("staff: ask an admin", () => {
    const e = deleteEligibility({ ...base, reasonCode: "staff_account" });
    expect(e.state).toBe("staff");
    expect(e.message).toContain(STAFF_DELETE_MESSAGE);
  });

  it("blocked: the API's own sentence", () => {
    const e = deleteEligibility({ ...base, reasonCode: "active_booking", reason: "API sentence.", activeBookings: 1 });
    expect(e).toEqual({ state: "blocked", message: "API sentence." });
  });

  it("blocked without a sentence: built from the counts", () => {
    const e = deleteEligibility({ ...base, reasonCode: "unpaid_invoice", unpaidInvoices: 2 });
    expect(e.state).toBe("blocked");
    expect(e.message).toBe("You can't delete your account while you have 2 unpaid invoices. Contact WorkNest for help.");
  });

  it("not available yet (server update missing)", () => {
    const e = deleteEligibility({ ...base, reasonCode: "unavailable" });
    expect(e.state).toBe("unavailable");
    expect(e.message).toMatch(/contact WorkNest/i);
  });

  it("account gone", () => {
    expect(deleteEligibility({ ...base, reasonCode: "not_found" }).state).toBe("gone");
  });
});

describe("blockedMessage", () => {
  it("lists every reason", () => {
    expect(blockedMessage({ activeBookings: 1, pendingBookings: 2, unpaidInvoices: 1 })).toBe(
      "You can't delete your account while you have an active booking, 2 booking requests waiting for confirmation and an unpaid invoice. Contact WorkNest for help.",
    );
    expect(blockedMessage({ activeBookings: 0, pendingBookings: 1, unpaidInvoices: 0 })).toBe(
      "You can't delete your account while you have a booking request waiting for confirmation. Contact WorkNest for help.",
    );
  });

  it("has a fallback when no count is set", () => {
    expect(blockedMessage({ activeBookings: 0, pendingBookings: 0, unpaidInvoices: 0 })).toMatch(/contact WorkNest/i);
  });
});

describe("isDeleteConfirmed", () => {
  it.each([
    ["DELETE", true],
    [" delete ", true],
    ["Delete", true],
    ["DELETED", false],
    ["DEL", false],
    ["", false],
  ])("%p -> %p", (value, ok) => {
    expect(isDeleteConfirmed(value)).toBe(ok);
  });

  it("is false for no value", () => {
    expect(isDeleteConfirmed(null)).toBe(false);
    expect(isDeleteConfirmed(undefined)).toBe(false);
  });
});

describe("canSelfDelete", () => {
  it("only customers", () => {
    expect(canSelfDelete("general")).toBe(true);
    expect(canSelfDelete(undefined)).toBe(true);
    for (const role of ["admin", "super_admin", "sales_executive", "ceo", "sales_manager", "access_officer"]) {
      expect(canSelfDelete(role)).toBe(false);
    }
  });
});

describe("API calls", () => {
  it("GET the check, signed in", async () => {
    api.mockResolvedValueOnce({ canDelete: true, reasonCode: null });
    const check = await getDeleteCheck();
    expect(api).toHaveBeenCalledWith(ACCOUNT_ENDPOINTS.deleteCheck, { requiresAuth: true });
    expect(check.canDelete).toBe(true);
  });

  it("POST the deletion with the confirmation word and return the API's message", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Your WorkNest account has been deleted.", data: { deleted: true } });
    await expect(deleteMyAccount()).resolves.toBe("Your WorkNest account has been deleted.");
    expect(api).toHaveBeenCalledWith(ACCOUNT_ENDPOINTS.delete, {
      method: "POST",
      body: { confirm: "DELETE" },
      requiresAuth: true,
      unwrapData: false,
    });
  });

  it("a refusal keeps the API's message and its check", async () => {
    const payload = {
      isSuccessful: false,
      message: "You can't delete your account while you have an active booking.",
      data: { canDelete: false, reasonCode: "active_booking", activeBookings: 1 },
    };
    api.mockRejectedValueOnce(new ApiError(payload.message, 409, payload));
    const error = await deleteMyAccount().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    const check = refusalCheckOf(error);
    expect(check?.reasonCode).toBe("active_booking");
    expect(check?.canDelete).toBe(false);
  });

  it("no check on other errors", () => {
    expect(refusalCheckOf(new Error("x"))).toBeNull();
    expect(refusalCheckOf(new ApiError("offline", 0))).toBeNull();
    expect(refusalCheckOf(new ApiError("bad", 400, { message: "Type DELETE" }))).toBeNull();
  });
});
