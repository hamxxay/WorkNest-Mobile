import { getToken } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import {
  accessLabels,
  ADDED_MESSAGE,
  addBookingEmployee,
  buildAddEmployeeBody,
  displayIdNumber,
  EMPLOYEES_UNAVAILABLE,
  employeesButtonLabel,
  firstEmployeeFormError,
  formatPassportInput,
  getBookingEmployees,
  getEmployeeSummary,
  isEmployeesUnavailable,
  normalizeBookingEmployees,
  normalizeEmployee,
  PASSPORT_ERROR,
  READ_ONLY_REASON,
  REMOVED_MESSAGE,
  removeBookingEmployee,
  seatsUsedLabel,
  showsEmployees,
  toEmployeeAddedBy,
  toEmployeeStatus,
  validateEmployeeForm,
  type EmployeeForm,
} from "./employeeService";
import { CNIC_ERROR } from "../utils/cnic";
import { PHONE_ERROR } from "../utils/phone";

jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null } as unknown as Headers,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function installFetch(...responses: Partial<Response>[]): FetchMock {
  const fetchMock: FetchMock = jest.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

const CONTRACT_EXAMPLE = {
  bookingId: 557,
  space: "Office 309",
  location: "I-8",
  seats: 4,
  used: 2,
  canManage: true,
  reason: null,
  employees: [
    {
      personId: 12,
      name: "Ali Khan",
      email: "ali@x.com",
      phone: "03001234567",
      idType: "CNIC",
      idNumber: "61101-1234567-1",
      addedOn: "2026-10-14",
      status: "active",
      addedBy: "customer",
      access: { fingerprint: true, face: false, card: true },
    },
    {
      personId: 13,
      name: "Bilal",
      idType: "CNIC",
      idNumber: "6110112345671",
      status: "pending",
      addedBy: "customer",
      access: { fingerprint: true, face: true, card: true },
    },
  ],
  savedEmployees: [{ personId: 9, name: "Sara", idType: "CNIC", idNumber: "61101-7654321-2" }],
};

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionExpiredState();
  setSessionRefresher(null);
  (getToken as jest.Mock).mockResolvedValue("api-jwt");
});

describe("normalizeBookingEmployees", () => {
  it("reads the contract example", () => {
    const data = normalizeBookingEmployees(CONTRACT_EXAMPLE);
    expect(data).toMatchObject({
      bookingId: 557,
      space: "Office 309",
      location: "I-8",
      seats: 4,
      used: 2,
      pendingCount: 1,
      canManage: true,
      reason: null,
      seatsFull: false,
      canAdd: true,
    });
    expect(data.employees[0]).toEqual({
      personId: 12,
      status: "active",
      addedBy: "customer",
      name: "Ali Khan",
      email: "ali@x.com",
      phone: "03001234567",
      idType: "CNIC",
      idNumber: "61101-1234567-1",
      addedOn: "2026-10-14",
      access: { fingerprint: true, face: false, card: true },
    });
    expect(data.savedEmployees).toEqual([{ personId: 9, name: "Sara", idType: "CNIC", idNumber: "61101-7654321-2" }]);
  });

  it("never shows access for a pending person and formats a bare CNIC", () => {
    const pending = normalizeBookingEmployees(CONTRACT_EXAMPLE).employees[1];
    expect(pending.status).toBe("pending");
    expect(pending.access).toEqual({ fingerprint: false, face: false, card: false });
    expect(pending.idNumber).toBe("61101-1234567-1");
  });

  it("keeps people sales added (addedBy staff) on the list", () => {
    const data = normalizeBookingEmployees({
      seats: 2,
      canManage: true,
      employees: [{ personId: 5, name: "Staff Added", status: "active", addedBy: "staff" }],
    });
    expect(data.employees).toHaveLength(1);
    expect(data.employees[0]).toMatchObject({ personId: 5, status: "active", addedBy: "staff" });
  });

  it("falls back safely when fields are missing", () => {
    for (const input of [undefined, null, {}, "oops", []]) {
      const data = normalizeBookingEmployees(input, 77);
      expect(data).toEqual({
        bookingId: 77,
        space: null,
        location: null,
        seats: null,
        used: 0,
        pendingCount: 0,
        canManage: false,
        reason: READ_ONLY_REASON,
        seatsFull: false,
        canAdd: false,
        employees: [],
        savedEmployees: [],
      });
    }
  });

  it("fills in missing employee fields", () => {
    const e = normalizeEmployee({ personId: "4" });
    expect(e).toEqual({
      personId: 4,
      status: "active",
      addedBy: "customer",
      name: "Employee",
      email: null,
      phone: null,
      idType: "CNIC",
      idNumber: "",
      addedOn: null,
      access: { fingerprint: false, face: false, card: false },
    });
    expect(normalizeEmployee(null).personId).toBe(0);
  });

  it("reads PascalCase fields and string flags", () => {
    const data = normalizeBookingEmployees({
      BookingId: "12",
      Space: "Desk 4",
      Seats: "3",
      Used: "1",
      CanManage: "true",
      Employees: [{ PersonId: 1, Name: "A B", IdType: "passport", IdNumber: "ab12345", Status: "Pending", AddedBy: "Sales" }],
    });
    expect(data).toMatchObject({ bookingId: 12, space: "Desk 4", seats: 3, used: 1, canManage: true, canAdd: true });
    expect(data.employees[0]).toMatchObject({ personId: 1, idType: "Passport", idNumber: "AB12345", status: "pending", addedBy: "staff" });
  });

  it("is read-only with the API's reason when canManage is false", () => {
    const data = normalizeBookingEmployees({
      seats: 4,
      used: 1,
      canManage: false,
      reason: "Employees can be added once the booking is confirmed.",
      employees: [{ personId: 1, name: "A" }],
    });
    expect(data.canManage).toBe(false);
    expect(data.canAdd).toBe(false);
    expect(data.reason).toBe("Employees can be added once the booking is confirmed.");
  });

  it("uses a default reason when canManage is false without one, and none when it can manage", () => {
    expect(normalizeBookingEmployees({ canManage: false, reason: "  " }).reason).toBe(READ_ONLY_REASON);
    expect(normalizeBookingEmployees({ canManage: true, reason: "ignored" }).reason).toBeNull();
  });

  it("marks the seats full and disables Add", () => {
    const data = normalizeBookingEmployees({
      seats: 2,
      used: 2,
      canManage: true,
      employees: [
        { personId: 1, name: "A", status: "active" },
        { personId: 2, name: "B", status: "pending" },
      ],
    });
    expect(data.seatsFull).toBe(true);
    expect(data.canAdd).toBe(false);
    expect(data.canManage).toBe(true);
  });

  it("counts pending and active rows when `used` is missing or too low", () => {
    const rows = [
      { personId: 1, status: "active" },
      { personId: 2, status: "pending" },
      { personId: 3, status: "pending" },
    ];
    expect(normalizeBookingEmployees({ seats: 3, canManage: true, employees: rows })).toMatchObject({
      used: 3,
      pendingCount: 2,
      seatsFull: true,
      canAdd: false,
    });
    expect(normalizeBookingEmployees({ seats: 5, used: 1, employees: rows }).used).toBe(3);
  });

  it("shows no seat limit when seats is missing or zero", () => {
    for (const seats of [undefined, 0, "", "x"]) {
      const data = normalizeBookingEmployees({ seats, canManage: true, employees: [{ personId: 1 }] });
      expect(data.seats).toBeNull();
      expect(data.seatsFull).toBe(false);
      expect(data.canAdd).toBe(true);
    }
  });

  it("never offers someone already on the booking (or twice, or without an id) as added before", () => {
    const data = normalizeBookingEmployees({
      employees: [{ personId: 12, name: "Ali" }],
      savedEmployees: [
        { personId: 12, name: "Ali" },
        { personId: 9, name: "Sara" },
        { personId: 9, name: "Sara again" },
        { name: "No id" },
      ],
    });
    expect(data.savedEmployees.map((p) => p.personId)).toEqual([9]);
  });
});

describe("status, labels and helpers", () => {
  it("maps statuses and who added", () => {
    expect(toEmployeeStatus("pending")).toBe("pending");
    expect(toEmployeeStatus("Pending")).toBe("pending");
    expect(toEmployeeStatus("active")).toBe("active");
    expect(toEmployeeStatus("Verified")).toBe("active");
    expect(toEmployeeStatus(undefined)).toBe("active");
    expect(toEmployeeAddedBy("staff")).toBe("staff");
    expect(toEmployeeAddedBy("sales_executive")).toBe("staff");
    expect(toEmployeeAddedBy("customer")).toBe("customer");
    expect(toEmployeeAddedBy(null)).toBe("customer");
  });

  it("labels seats and the Employees button", () => {
    expect(seatsUsedLabel({ seats: 4, used: 2 })).toBe("2 of 4 seats used");
    expect(seatsUsedLabel({ seats: 1, used: 0 })).toBe("0 of 1 seat used");
    expect(seatsUsedLabel({ seats: null, used: 1 })).toBe("1 employee");
    expect(employeesButtonLabel({ seats: 4, used: 2 })).toBe("Employees 2/4");
    expect(employeesButtonLabel({ seats: null, used: 3 })).toBe("Employees 3");
    expect(employeesButtonLabel(null)).toBe("Employees");
  });

  it("lists enrolled access in a fixed order", () => {
    expect(accessLabels({ fingerprint: true, face: true, card: true })).toEqual(["Fingerprint", "Face", "Card"]);
    expect(accessLabels({ fingerprint: false, face: false, card: false })).toEqual([]);
  });

  it("shows Employees on confirmed bookings only", () => {
    expect(showsEmployees({ status: "Confirmed" })).toBe(true);
    expect(showsEmployees({ status: "Booked", statusCode: "CONFIRMED" })).toBe(true);
    expect(showsEmployees({ status: "Checked In" })).toBe(true);
    expect(showsEmployees({ status: "Pending" })).toBe(false);
    expect(showsEmployees({ status: "Cancelled" })).toBe(false);
    expect(showsEmployees({ status: "Completed" })).toBe(false);
    expect(showsEmployees({})).toBe(false);
  });

  it("formats ID numbers for display and passport input", () => {
    expect(displayIdNumber("CNIC", "6110112345671")).toBe("61101-1234567-1");
    expect(displayIdNumber("CNIC", "123")).toBe("123");
    expect(displayIdNumber("Passport", "ab123456")).toBe("AB123456");
    expect(formatPassportInput("ab-12 34/56cd")).toBe("AB123456CD");
    expect(formatPassportInput("A".repeat(30))).toHaveLength(20);
  });
});

describe("validateEmployeeForm", () => {
  const valid: EmployeeForm = {
    mode: "new",
    fullName: "Ali Khan",
    email: "",
    phone: "",
    idType: "CNIC",
    idNumber: "61101-1234567-1",
  };

  it("accepts a new person with only name and CNIC (email and phone are optional)", () => {
    expect(validateEmployeeForm(valid)).toEqual({});
    expect(validateEmployeeForm({ ...valid, email: "ali@x.com", phone: "0300 1234567" })).toEqual({});
    expect(validateEmployeeForm({ ...valid, idNumber: "6110112345671" })).toEqual({});
  });

  it("checks the full name length (2-150, the API's limit)", () => {
    expect(validateEmployeeForm({ ...valid, fullName: "  " }).fullName).toBe("Enter the employee's full name.");
    expect(validateEmployeeForm({ ...valid, fullName: "A" }).fullName).toMatch(/at least 2/);
    expect(validateEmployeeForm({ ...valid, fullName: "A".repeat(151) }).fullName).toBe("Full name must be 150 characters or fewer.");
    expect(validateEmployeeForm({ ...valid, fullName: "A".repeat(150) }).fullName).toBeUndefined();
    expect(validateEmployeeForm({ ...valid, fullName: "Al" }).fullName).toBeUndefined();
  });

  it("limits the email to 150 characters like the API", () => {
    const at150 = `${"a".repeat(140)}@email.com`;
    expect(at150).toHaveLength(150);
    expect(validateEmployeeForm({ ...valid, email: at150 }).email).toBeUndefined();
    expect(validateEmployeeForm({ ...valid, email: `a${at150}` }).email).toBe("Email must be 150 characters or fewer.");
  });

  it("checks email and phone only when given", () => {
    expect(validateEmployeeForm({ ...valid, email: "not-an-email" }).email).toMatch(/valid email/);
    expect(validateEmployeeForm({ ...valid, phone: "12345" }).phone).toBe(PHONE_ERROR);
    expect(validateEmployeeForm({ ...valid, phone: "0300abc1234" }).phone).toBe(PHONE_ERROR);
  });

  it("requires a valid CNIC", () => {
    expect(validateEmployeeForm({ ...valid, idNumber: "" }).idNumber).toBe("Enter the CNIC number.");
    expect(validateEmployeeForm({ ...valid, idNumber: "61101-123456-1" }).idNumber).toBe(CNIC_ERROR);
  });

  it("requires a passport number of 6-20 letters and numbers", () => {
    const passport: EmployeeForm = { ...valid, idType: "Passport" };
    expect(validateEmployeeForm({ ...passport, idNumber: "" }).idNumber).toBe("Enter the passport number.");
    expect(validateEmployeeForm({ ...passport, idNumber: "AB123" }).idNumber).toBe(PASSPORT_ERROR);
    expect(validateEmployeeForm({ ...passport, idNumber: "AB-12345" }).idNumber).toBe(PASSPORT_ERROR);
    expect(validateEmployeeForm({ ...passport, idNumber: "A".repeat(21) }).idNumber).toBe(PASSPORT_ERROR);
    expect(validateEmployeeForm({ ...passport, idNumber: "AB123456" })).toEqual({});
  });

  it("needs a chosen person in existing mode, and nothing else", () => {
    expect(validateEmployeeForm({ mode: "existing", personId: null }).personId).toBe("Choose the person to add.");
    expect(validateEmployeeForm({ mode: "existing", personId: 9 })).toEqual({});
  });

  it("reports the first problem in field order", () => {
    expect(firstEmployeeFormError({ ...valid, fullName: "", phone: "1" })).toBe("Enter the employee's full name.");
    expect(firstEmployeeFormError(valid)).toBeNull();
  });
});

describe("buildAddEmployeeBody", () => {
  it("sends a new person with the CNIC formatted and empty optional fields as null", () => {
    expect(
      buildAddEmployeeBody({
        mode: "new",
        fullName: "  Ali   Khan ",
        email: " Ali@X.com ",
        phone: "",
        idType: "CNIC",
        idNumber: "6110112345671",
      }),
    ).toEqual({
      mode: "new",
      fullName: "Ali Khan",
      email: "ali@x.com",
      phone: null,
      idType: "CNIC",
      idNumber: "61101-1234567-1",
    });
  });

  it("sends a passport upper case, and an existing person by id", () => {
    expect(
      buildAddEmployeeBody({ mode: "new", fullName: "Sam", idType: "Passport", idNumber: "ab123456", phone: "03001234567" }),
    ).toMatchObject({ idType: "Passport", idNumber: "AB123456", phone: "03001234567", email: null });
    expect(buildAddEmployeeBody({ mode: "existing", personId: 9 })).toEqual({ mode: "existing", personId: 9 });
  });
});

describe("employee requests", () => {
  it("GET employees for the booking with the sign-in token", async () => {
    const fetchMock = installFetch(jsonResponse(200, { isSuccessful: true, data: CONTRACT_EXAMPLE, message: "" }));
    const data = await getBookingEmployees(557);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/booking\/my\/557\/employees$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer api-jwt");
    expect(data.employees).toHaveLength(2);
  });

  it("POSTs a new employee and returns the API's message", async () => {
    const message = "Employee added. WorkNest will add their fingerprint or face at the branch.";
    const fetchMock = installFetch(jsonResponse(201, { isSuccessful: true, data: { personId: 12 }, message }));
    const result = await addBookingEmployee(557, {
      mode: "new",
      fullName: "Ali Khan",
      idType: "CNIC",
      idNumber: "6110112345671",
    });
    expect(result).toEqual({ personId: 12, message });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/booking\/my\/557\/employees$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      mode: "new",
      fullName: "Ali Khan",
      email: null,
      phone: null,
      idType: "CNIC",
      idNumber: "61101-1234567-1",
    });
  });

  it("falls back to the default message and the chosen person", async () => {
    installFetch(jsonResponse(201, { isSuccessful: true, data: null, message: "" }));
    await expect(addBookingEmployee(557, { mode: "existing", personId: 9 })).resolves.toEqual({
      personId: 9,
      message: ADDED_MESSAGE,
    });
  });

  it("does not send an invalid form", async () => {
    const fetchMock = installFetch();
    await expect(addBookingEmployee(557, { mode: "new", fullName: "A", idType: "CNIC", idNumber: "1" })).rejects.toThrow(
      /at least 2/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the API's refusal through as is (seats full)", async () => {
    installFetch(jsonResponse(400, { isSuccessful: false, data: null, message: "All 4 seats are taken. Remove an employee first." }));
    await expect(addBookingEmployee(557, { mode: "existing", personId: 9 })).rejects.toMatchObject({
      status: 400,
      message: "All 4 seats are taken. Remove an employee first.",
    });
  });

  it("DELETEs an employee and returns the API's message (or the default)", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, { isSuccessful: true, data: null, message: "Employee removed and their door access cancelled." }),
      jsonResponse(200, { isSuccessful: true, data: null }),
    );
    await expect(removeBookingEmployee(557, 12)).resolves.toBe("Employee removed and their door access cancelled.");
    await expect(removeBookingEmployee(557, 12)).resolves.toBe(REMOVED_MESSAGE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/booking\/my\/557\/employees\/12$/);
    expect(init.method).toBe("DELETE");
  });

  it("refuses bad ids without calling the API", async () => {
    const fetchMock = installFetch();
    await expect(getBookingEmployees(0)).rejects.toBeInstanceOf(ApiError);
    await expect(removeBookingEmployee(557, 0)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns a 503 (database update not installed) into a plain message", async () => {
    installFetch(
      jsonResponse(503, { isSuccessful: false, message: "Employees need the database update EMP_01_customer_employees_TEST.sql." }),
      jsonResponse(503, { isSuccessful: false, message: "Employees need the database update." }),
    );
    const error = await getBookingEmployees(557).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.message).toBe(EMPLOYEES_UNAVAILABLE);
    expect(isEmployeesUnavailable(error)).toBe(true);
    await expect(removeBookingEmployee(557, 12)).rejects.toMatchObject({ status: 503, message: EMPLOYEES_UNAVAILABLE });
  });

  it("summary: the count, or null on 404 / 503 so the entry is hidden; other errors throw", async () => {
    installFetch(
      jsonResponse(200, { isSuccessful: true, data: CONTRACT_EXAMPLE }),
      jsonResponse(404, { isSuccessful: false, message: "Booking not found." }),
      jsonResponse(503, { isSuccessful: false, message: "Employees need the database update." }),
      jsonResponse(500, { isSuccessful: false, message: "Something broke." }),
    );
    await expect(getEmployeeSummary(557)).resolves.toEqual({ seats: 4, used: 2, canManage: true });
    await expect(getEmployeeSummary(557)).resolves.toBeNull();
    await expect(getEmployeeSummary(557)).resolves.toBeNull();
    await expect(getEmployeeSummary(557)).rejects.toMatchObject({ status: 500 });
  });
});
