import { getToken } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import {
  addAttendanceHoliday,
  addDays,
  ATTENDANCE_ENDPOINTS,
  attendanceErrorMessage,
  attendanceToday,
  buildShiftBody,
  clockText,
  crossesMidnight,
  dayNotes,
  dayStatusColor,
  dayStatusLabel,
  durationText,
  employeeShiftText,
  getAttendanceReport,
  getAttendanceStatus,
  inOutText,
  normalizeDay,
  normalizeDayStatus,
  normalizeEmployees,
  normalizeHolidays,
  normalizeReport,
  normalizeShift,
  normalizeTime,
  normalizeWorkDays,
  NOT_AVAILABLE_MESSAGE,
  NOT_ENABLED_MESSAGE,
  parseMinutes,
  rangeDays,
  saveAttendanceShift,
  scanTimeText,
  setEmployeeShift,
  shiftLengthMinutes,
  shiftTimesText,
  thisMonthRange,
  totalSummary,
  validateRange,
  validateShift,
  workDaysText,
  type AttendanceShiftInput,
} from "./attendanceService";

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

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionExpiredState();
  setSessionRefresher(null);
  (getToken as jest.Mock).mockResolvedValue("api-jwt");
});

const SHIFT_INPUT: AttendanceShiftInput = {
  name: "  Day  ",
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 15,
  halfDayMinutes: null,
  workDays: ["Fri", "Mon", "Tue"],
  isDefault: true,
};

describe("endpoints", () => {
  it("are the API's routes under attendance/my", () => {
    expect(ATTENDANCE_ENDPOINTS.status).toBe("/attendance/my/status");
    expect(ATTENDANCE_ENDPOINTS.report("2026-10-01", "2026-10-28")).toBe("/attendance/my/report?from=2026-10-01&to=2026-10-28");
    expect(ATTENDANCE_ENDPOINTS.report("2026-10-01", "2026-10-28", 9)).toBe(
      "/attendance/my/report?from=2026-10-01&to=2026-10-28&personId=9",
    );
    expect(ATTENDANCE_ENDPOINTS.employees).toBe("/attendance/my/employees");
    expect(ATTENDANCE_ENDPOINTS.employeeShift(9)).toBe("/attendance/my/employees/9/shift");
    expect(ATTENDANCE_ENDPOINTS.shifts).toBe("/attendance/my/shifts");
    expect(ATTENDANCE_ENDPOINTS.shift(3)).toBe("/attendance/my/shifts/3");
    expect(ATTENDANCE_ENDPOINTS.holidays(2026)).toBe("/attendance/my/holidays?year=2026");
    expect(ATTENDANCE_ENDPOINTS.holidays()).toBe("/attendance/my/holidays");
    expect(ATTENDANCE_ENDPOINTS.holiday(4)).toBe("/attendance/my/holidays/4");
  });
});

describe("reading the API", () => {
  it("reads times and work days", () => {
    expect(normalizeTime("09:00:00")).toBe("09:00");
    expect(normalizeTime("9:05")).toBe("09:05");
    expect(normalizeTime("25:00")).toBe("");
    expect(normalizeTime(null)).toBe("");
    expect(normalizeWorkDays(["Fri", "mon", "Monday", "xyz"])).toEqual(["Mon", "Fri"]);
    expect(normalizeWorkDays("Mon,Tue,Wed")).toEqual(["Mon", "Tue", "Wed"]);
    expect(normalizeWorkDays(null)).toEqual([]);
  });

  it("reads a shift (PascalCase too) and works out a night shift", () => {
    expect(
      normalizeShift({
        Id: 3,
        Name: "Night",
        StartTime: "22:00:00",
        EndTime: "06:00:00",
        GraceMinutes: 10,
        HalfDayMinutes: 240,
        WorkDays: "Mon,Tue",
        IsDefault: 1,
        EmployeeCount: 4,
      }),
    ).toEqual({
      id: 3,
      name: "Night",
      startTime: "22:00",
      endTime: "06:00",
      graceMinutes: 10,
      halfDayMinutes: 240,
      workDays: ["Mon", "Tue"],
      isDefault: true,
      crossesMidnight: true,
      employeeCount: 4,
    });
    expect(normalizeShift({ id: 1, startTime: "09:00", endTime: "18:00", crossesMidnight: false }).crossesMidnight).toBe(false);
  });

  it("reads holidays earliest first, dropping rows without an id or date", () => {
    expect(
      normalizeHolidays([
        { id: 2, date: "2026-12-25T00:00:00", name: "Quaid Day" },
        { id: 1, date: "2026-11-09", name: "Iqbal Day" },
        { id: 0, date: "2026-01-01", name: "x" },
        { id: 5, date: "", name: "y" },
      ]),
    ).toEqual([
      { id: 1, date: "2026-11-09", name: "Iqbal Day" },
      { id: 2, date: "2026-12-25", name: "Quaid Day" },
    ]);
  });

  it("reads employees, current ones first", () => {
    const list = normalizeEmployees([
      { personId: 2, name: "Zara", rooms: ["Office 313"], shiftId: null, usesDefaultShift: true, active: true, enrolled: true },
      { personId: 3, name: "Ali", rooms: [], active: false, enrolled: false },
      { personId: 4, name: "Bilal", idNumberMasked: "35202-*****-1", shiftId: 3, shiftName: "Night" },
      { name: "no id" },
    ]);
    expect(list.map((e) => e.personId)).toEqual([4, 2, 3]);
    expect(list[0]).toMatchObject({ active: true, shiftId: 3, shiftName: "Night", idNumberMasked: "35202-*****-1", enrolled: false });
    expect(list[1]).toMatchObject({ rooms: ["Office 313"], usesDefaultShift: true, enrolled: true });
  });

  it("reads statuses in any spelling", () => {
    expect(normalizeDayStatus("HalfDay")).toBe("HalfDay");
    expect(normalizeDayStatus("half_day")).toBe("HalfDay");
    expect(normalizeDayStatus("Missing Out")).toBe("MissingOut");
    expect(normalizeDayStatus("weird", true)).toBe("Present");
    expect(normalizeDayStatus("", false)).toBe("Pending");
  });

  it("reads a day", () => {
    expect(
      normalizeDay({
        personId: 2,
        name: "Zara",
        date: "2026-10-28",
        checkIn: "2026-10-28T09:04:11",
        checkOut: null,
        workedMinutes: null,
        scans: 1,
        status: "MissingOut",
        lateMinutes: 4,
        onHoliday: false,
        shiftName: "Day",
        room: "Office 313",
      }),
    ).toEqual({
      personId: 2,
      name: "Zara",
      date: "2026-10-28",
      checkIn: "2026-10-28T09:04:11",
      checkOut: null,
      workedMinutes: null,
      scans: 1,
      status: "MissingOut",
      lateMinutes: 4,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      onHoliday: false,
      onOffDay: false,
      shiftName: "Day",
      room: "Office 313",
    });
    expect(normalizeDay({ personId: 1, date: "2026-10-01", workedMinutes: 0 }).workedMinutes).toBe(0);
  });

  it("reads a report: days newest first, summaries by name, fallback range", () => {
    const r = normalizeReport(
      {
        customerId: 7,
        customerName: "Acme",
        days: [
          { personId: 1, name: "Bilal", date: "2026-10-01", status: "Present" },
          { personId: 2, name: "Ali", date: "2026-10-02", status: "Late" },
          { personId: 1, name: "Bilal", date: "2026-10-02", status: "Absent" },
          { personId: 0, date: "2026-10-03" },
        ],
        summary: [
          { personId: 1, name: "Bilal", present: 1, absent: 1, workedMinutes: 480 },
          { personId: 2, name: "Ali", late: 1, workedMinutes: 300, overtimeMinutes: 20 },
        ],
      },
      { from: "2026-10-01", to: "2026-10-28" },
    );
    expect(r.from).toBe("2026-10-01");
    expect(r.to).toBe("2026-10-28");
    expect(r.days.map((d) => `${d.date} ${d.name}`)).toEqual(["2026-10-02 Ali", "2026-10-02 Bilal", "2026-10-01 Bilal"]);
    expect(r.summary.map((s) => s.name)).toEqual(["Ali", "Bilal"]);
    expect(totalSummary(r.summary)).toMatchObject({ present: 1, late: 1, absent: 1, workedMinutes: 780, overtimeMinutes: 20 });
  });
});

describe("requests", () => {
  it("loads the status and the report with the sign-in token", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, { isSuccessful: true, data: { enabled: true, customerId: 7, customerName: "Acme" } }),
      jsonResponse(200, { isSuccessful: true, data: { days: [], summary: [] } }),
    );
    await expect(getAttendanceStatus()).resolves.toEqual({ enabled: true, customerId: 7, customerName: "Acme" });
    await expect(getAttendanceReport("2026-10-01", "2026-10-28", 4)).resolves.toMatchObject({ from: "2026-10-01", days: [] });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/attendance\/my\/status$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/attendance\/my\/report\?from=2026-10-01&to=2026-10-28&personId=4$/);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer api-jwt");
  });

  it("sends shifts, employee shifts and holidays with the right method and body", async () => {
    const fetchMock = installFetch(
      jsonResponse(201, { isSuccessful: true, message: "Shift saved." }),
      jsonResponse(200, { isSuccessful: true, message: "Shift saved." }),
      jsonResponse(200, { isSuccessful: true }),
      jsonResponse(201, { isSuccessful: true }),
    );
    await expect(saveAttendanceShift(null, SHIFT_INPUT)).resolves.toBe("Shift saved.");
    await saveAttendanceShift(3, SHIFT_INPUT);
    await setEmployeeShift(9, null);
    await addAttendanceHoliday("2026-11-09", " Iqbal Day ");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/attendance\/my\/shifts$/);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      name: "Day",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 15,
      halfDayMinutes: null,
      workDays: ["Mon", "Tue", "Fri"],
      isDefault: true,
    });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/attendance\/my\/shifts\/3$/);
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/attendance\/my\/employees\/9\/shift$/);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toEqual({ shiftId: null });
    expect(JSON.parse(String(fetchMock.mock.calls[3][1].body))).toEqual({ date: "2026-11-09", name: "Iqbal Day" });
  });

  it("turns 403 and 503 into friendly messages", async () => {
    installFetch(
      jsonResponse(403, { message: "Attendance is not enabled for your account" }),
      jsonResponse(503, { message: "Attendance is not installed yet (run ATT_01)" }),
    );
    const notEnabled = await getAttendanceReport("2026-10-01", "2026-10-28").catch((e) => e);
    const notInstalled = await getAttendanceReport("2026-10-01", "2026-10-28").catch((e) => e);
    expect(attendanceErrorMessage(notEnabled)).toBe(NOT_ENABLED_MESSAGE);
    expect(attendanceErrorMessage(notInstalled)).toBe(NOT_AVAILABLE_MESSAGE);
    expect(attendanceErrorMessage(new ApiError("Shift name is taken.", 400))).toBe("Shift name is taken.");
  });
});

describe("rules and formatting", () => {
  it("formats durations as 8h 05m", () => {
    expect(durationText(485)).toBe("8h 05m");
    expect(durationText(0)).toBe("0h 00m");
    expect(durationText(59)).toBe("0h 59m");
    expect(durationText(600)).toBe("10h 00m");
    expect(durationText(null)).toBe("—");
  });

  it("formats times as hh:mm a", () => {
    expect(clockText("09:00")).toBe("09:00 AM");
    expect(clockText("00:30")).toBe("12:30 AM");
    expect(clockText("12:00")).toBe("12:00 PM");
    expect(clockText("18:05:00")).toBe("06:05 PM");
    expect(clockText("x")).toBe("");
    expect(scanTimeText("2026-10-28T09:04:11")).toBe("09:04 AM");
    expect(scanTimeText(null)).toBe("");
    expect(inOutText({ checkIn: "2026-10-28T09:04:11", checkOut: "2026-10-28T18:10:00" })).toBe("09:04 AM → 06:10 PM");
    expect(inOutText({ checkIn: "2026-10-28T09:04:11", checkOut: null })).toBe("09:04 AM → —");
    expect(inOutText({ checkIn: null, checkOut: null })).toBe("");
  });

  it("knows night shifts and shift length", () => {
    expect(crossesMidnight("22:00", "06:00")).toBe(true);
    expect(crossesMidnight("09:00", "09:00")).toBe(true);
    expect(crossesMidnight("09:00", "18:00")).toBe(false);
    expect(shiftLengthMinutes("09:00", "18:00")).toBe(540);
    expect(shiftLengthMinutes("22:00", "06:00")).toBe(480);
    expect(shiftTimesText({ startTime: "22:00", endTime: "06:00" })).toBe("10:00 PM – 06:00 AM (next day)");
    expect(shiftTimesText({ startTime: "09:00", endTime: "18:00" })).toBe("09:00 AM – 06:00 PM");
  });

  it("describes work days", () => {
    expect(workDaysText(["Mon", "Tue", "Wed", "Thu", "Fri"])).toBe("Mon–Fri");
    expect(workDaysText(["Mon", "Wed", "Sat"])).toBe("Mon, Wed, Sat");
    expect(workDaysText(["Sat", "Sun"])).toBe("Sat, Sun");
    expect(workDaysText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).toBe("Every day");
    expect(workDaysText([])).toBe("No work days");
  });

  it("validates and builds a shift", () => {
    expect(validateShift(SHIFT_INPUT)).toBeNull();
    expect(validateShift({ ...SHIFT_INPUT, name: " " })).toMatch(/name/);
    expect(validateShift({ ...SHIFT_INPUT, endTime: "09:00" })).toMatch(/same/);
    expect(validateShift({ ...SHIFT_INPUT, workDays: [] })).toMatch(/work day/);
    expect(validateShift({ ...SHIFT_INPUT, graceMinutes: NaN })).toMatch(/Grace/);
    expect(validateShift({ ...SHIFT_INPUT, halfDayMinutes: 0 })).toMatch(/Half-day/);
    expect(validateShift({ ...SHIFT_INPUT, startTime: "22:00", endTime: "06:00" })).toBeNull();
    expect(buildShiftBody({ ...SHIFT_INPUT, halfDayMinutes: 240 }).halfDayMinutes).toBe(240);
    expect(parseMinutes("15")).toBe(15);
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("1.5")).toBeNaN();
  });

  it("works out date ranges in Pakistan time", () => {
    expect(attendanceToday(new Date("2026-10-27T19:30:00Z"))).toBe("2026-10-28");
    expect(thisMonthRange("2026-10-28")).toEqual({ from: "2026-10-01", to: "2026-10-28" });
    expect(rangeDays("2026-10-01", "2026-10-31")).toBe(31);
    expect(rangeDays("2026-10-02", "2026-10-01")).toBe(0);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(validateRange("2026-10-01", "2026-10-28")).toBeNull();
    expect(validateRange("2026-10-02", "2026-10-01")).toMatch(/before/);
    expect(validateRange("2026-09-01", "2026-11-01")).toBeNull(); // 62 days
    expect(validateRange("2026-09-01", "2026-11-02")).toBe("Choose at most 62 days.");
  });

  it("labels and colours statuses", () => {
    expect(dayStatusLabel("HalfDay")).toBe("Half day");
    expect(dayStatusLabel("MissingOut")).toBe("Missing out");
    expect(dayStatusColor("Present")).toBe("success");
    expect(dayStatusColor("Late")).toBe("warning");
    expect(dayStatusColor("HalfDay")).toBe("orange");
    expect(dayStatusColor("Absent")).toBe("danger");
    expect(dayStatusColor("OffDay")).toBe("neutral");
    expect(dayStatusColor("Pending")).toBe("info");
    const day = normalizeDay({ personId: 1, date: "2026-10-01", lateMinutes: 12, overtimeMinutes: 60, onHoliday: true });
    expect(dayNotes(day)).toEqual(["On a holiday", "Late 0h 12m", "Overtime 1h 00m"]);
  });

  it("describes an employee's shift", () => {
    const shifts = [
      normalizeShift({ id: 1, name: "Day", startTime: "09:00", endTime: "18:00", isDefault: true }),
      normalizeShift({ id: 2, name: "Night", startTime: "22:00", endTime: "06:00" }),
    ];
    const [own, byDefault] = normalizeEmployees([
      { personId: 1, name: "A", shiftId: 2, shiftName: "Night" },
      { personId: 2, name: "B", shiftId: 1, shiftName: "Day", usesDefaultShift: true },
    ]);
    expect(employeeShiftText(own, shifts)).toBe("Night");
    expect(employeeShiftText(byDefault, shifts)).toBe("Default (Day)");
    expect(employeeShiftText({ ...byDefault, usesDefaultShift: false, shiftId: null, shiftName: null }, [shifts[1]])).toBe("No shift");
  });
});
