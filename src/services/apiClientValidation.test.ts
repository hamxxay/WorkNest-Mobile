// apiClient: a refused request body (ASP.NET ProblemDetails "One or more validation errors occurred.") names the
// field to fix instead of the generic title; the API's own messages still win.

jest.mock("../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));

import { friendlyApiMessage, serverMessage, validationErrorsMessage } from "./apiClient";

const problem = (errors: Record<string, string[]>) => ({
  type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  title: "One or more validation errors occurred.",
  status: 400,
  errors,
});

describe("validation errors", () => {
  it("a value that could not be read names the field", () => {
    const body = problem({
      "$.securityDeposit": ["The JSON value could not be converted to System.Decimal. Path: $.securityDeposit | LineNumber: 0 | BytePositionInLine: 312."],
      request: ["The request field is required."],
    });
    expect(serverMessage(body)).toBe("Check the security deposit.");
    expect(friendlyApiMessage(400, body)).toBe("Check the security deposit.");
  });

  it("a plain field message is shown as it is", () => {
    expect(serverMessage(problem({ FeeAmount: ["Enter the fee."] }))).toBe("Enter the fee.");
  });

  it("only the whole body named: falls back as before", () => {
    expect(validationErrorsMessage({ request: ["The request field is required."] })).toBeNull();
  });

  it("the API's own message still wins", () => {
    expect(serverMessage({ isSuccessful: false, message: "Valid recurring fee amount is required." })).toBe("Valid recurring fee amount is required.");
    expect(serverMessage({ title: "Booking not found", errors: { x: ["y"] } })).toBe("Booking not found");
  });
});
