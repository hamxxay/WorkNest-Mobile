// Access Officer calls against a mocked transport: the right path, method and body, authenticated, the raw envelope
// kept and normalised, the long time limit on enrolment, 404 as "not found", and a 503 ("needs the database update
// AO_01") turned into a clear message. The real apiClient is used except for apiRequest; config / authStorage are
// mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));
jest.mock("../../apiClient", () => ({ ...jest.requireActual("../../apiClient"), apiRequest: jest.fn() }));

import { ApiError, apiRequest } from "../../apiClient";
import {
  ACCESS_OFFICER_ENDPOINTS,
  AO_ENROL_TIMEOUT_MS,
  addToRoom,
  enrol,
  getMyLocationNames,
  lookupByCnic,
  normalizeLocationNames,
  removeAccess,
  restoreAccess,
} from "../api";
import {
  AO_CONFLICT_MESSAGE,
  AO_DB_UPDATE_MESSAGE,
  AO_ENROL_NO_ANSWER_MESSAGE,
  AO_FORBIDDEN_MESSAGE,
  AO_GONE_MESSAGE,
  AO_NOT_FOUND_MESSAGE,
  AO_OFFLINE_MESSAGE,
  accessOfficerActionMessage,
  accessOfficerEnrolMessage,
  accessOfficerErrorView,
  aoDatabaseUpdateMessage,
  aoDatabaseUpdateOf,
  toAccessOfficerError,
} from "../errors";

const api = apiRequest as jest.Mock;

beforeEach(() => api.mockReset());

const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const MATCH = {
  bookingDetailId: 101,
  bookingId: 55,
  room: "Office 349",
  location: "I-8",
  customer: "SAC@WN",
  state: "assigned",
  accessEnabled: true,
  credentials: { face: false, fingerprint: true, card: false },
  roomMachine: { name: "Office 349", online: true },
};

describe("lookupByCnic", () => {
  it("GET access-officer/lookup?cnic=, authenticated, envelope kept and normalised", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: { cnic: "12345-1234567-1", person: { personId: 12, name: "Sara Khan" }, matches: [MATCH] },
    });
    const outcome = await lookupByCnic(" 12345-1234567-1 ");
    expect(lastCall()).toMatchObject({
      path: "/access-officer/lookup?cnic=12345-1234567-1",
      method: "GET",
      requiresAuth: true,
      unwrapData: false,
    });
    expect(outcome.found).toBe(true);
    if (!outcome.found) return;
    expect(outcome.lookup.person?.name).toBe("Sara Khan");
    expect(outcome.lookup.matches[0]).toMatchObject({ bookingDetailId: 101, state: "assigned", credentials: { fingerprint: true } });
  });

  it("encodes a passport number", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { matches: [MATCH] } });
    await lookupByCnic("AB 12/34");
    expect(lastCall().path).toBe("/access-officer/lookup?cnic=AB%2012%2F34");
  });

  it("404: not found, with the API's message", async () => {
    const message = "No customer has added this CNIC to a confirmed booking at your locations. Ask the customer to add them.";
    api.mockRejectedValueOnce(new ApiError(message, 404, { isSuccessful: false, message, data: null }));
    expect(await lookupByCnic("12345-1234567-1")).toEqual({ found: false, cnic: "12345-1234567-1", message });
  });

  it("404 without a message, or no matches: the contract's not-found wording", async () => {
    api.mockRejectedValueOnce(new ApiError("This isn't available right now. Please try again later.", 404, null));
    expect(await lookupByCnic("12345-1234567-1")).toEqual({ found: false, cnic: "12345-1234567-1", message: AO_NOT_FOUND_MESSAGE });
    api.mockResolvedValueOnce({ isSuccessful: true, data: { cnic: "12345-1234567-1", person: null, matches: [] } });
    expect(await lookupByCnic("1234512345671")).toEqual({ found: false, cnic: "12345-1234567-1", message: AO_NOT_FOUND_MESSAGE });
  });

  it("other errors are thrown (503 rewritten to AO_01)", async () => {
    api.mockRejectedValueOnce(new ApiError("Forbidden", 403, { message: "Not your location." }));
    await expect(lookupByCnic("12345-1234567-1")).rejects.toMatchObject({ status: 403 });
    api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, null));
    await expect(lookupByCnic("12345-1234567-1")).rejects.toMatchObject({ status: 503, message: AO_DB_UPDATE_MESSAGE });
  });

  it("refuses an empty ID without calling the API", async () => {
    await expect(lookupByCnic("  ")).rejects.toThrow("Enter a CNIC or passport number.");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  it("POST add-to-room { bookingDetailId, cnic } and reads the updated match", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Sara Khan is now on Office 349.", data: { ...MATCH, personId: 12 } });
    const r = await addToRoom({ bookingDetailId: 101, cnic: "12345-1234567-1", room: "Office 349" });
    expect(lastCall()).toMatchObject({
      path: "/access-officer/add-to-room",
      method: "POST",
      body: { bookingDetailId: 101, cnic: "12345-1234567-1" },
      requiresAuth: true,
      unwrapData: false,
    });
    expect(lastCall().timeoutMs).toBeUndefined();
    expect(r.message).toBe("Sara Khan is now on Office 349.");
    expect(r.match).toMatchObject({ bookingDetailId: 101, personId: 12 });
  });

  it("our message when the server sends none", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Success", data: null });
    expect((await addToRoom({ bookingDetailId: 101, cnic: "12345-1234567-1", room: "Office 349" })).message).toBe("Added to Office 349.");
    api.mockResolvedValueOnce({ isSuccessful: true, data: null });
    expect((await removeAccess({ bookingDetailId: 101, personId: 12, room: "Office 349" })).message).toBe("Door access to Office 349 removed.");
    api.mockResolvedValueOnce({ isSuccessful: true, data: null });
    expect((await restoreAccess({ bookingDetailId: 101, personId: 12 })).message).toBe("Door access restored.");
  });

  it("POST remove-access / restore-access { bookingDetailId, personId }", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: { match: { ...MATCH, personId: 12, accessEnabled: false }, machines: { enabled: false, devices: [{ deviceId: 1, device: "Entrance 1", ok: true, queued: true }] } },
    });
    const removed = await removeAccess({ bookingDetailId: 101, personId: 12 });
    expect(lastCall()).toMatchObject({ path: "/access-officer/remove-access", method: "POST", body: { bookingDetailId: 101, personId: 12 } });
    expect(removed.devices[0]).toMatchObject({ device: "Entrance 1", queued: true });
    expect(removed.match).toMatchObject({ bookingDetailId: 101, personId: 12, accessEnabled: false });

    api.mockResolvedValueOnce({ isSuccessful: true, data: null });
    await restoreAccess({ bookingDetailId: 101, personId: 12 });
    expect(lastCall()).toMatchObject({ path: "/access-officer/restore-access", method: "POST", body: { bookingDetailId: 101, personId: 12 } });
  });

  it("refuses missing ids without calling the API", async () => {
    await expect(addToRoom({ bookingDetailId: 0, cnic: "12345-1234567-1" })).rejects.toThrow(/room is missing/);
    await expect(addToRoom({ bookingDetailId: 101, cnic: " " })).rejects.toThrow("Enter a CNIC or passport number.");
    await expect(removeAccess({ bookingDetailId: 101, personId: NaN })).rejects.toThrow(/person is missing/);
    await expect(restoreAccess({ bookingDetailId: -1, personId: 12 })).rejects.toThrow(/room is missing/);
    expect(api).not.toHaveBeenCalled();
  });

  it("409 / 403 keep the server's message for the screen", async () => {
    api.mockRejectedValueOnce(new ApiError("Sara Khan is already on Office 349.", 409, { message: "Sara Khan is already on Office 349." }));
    const error = await addToRoom({ bookingDetailId: 101, cnic: "12345-1234567-1" }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(accessOfficerActionMessage(error)).toBe("Sara Khan is already on Office 349.");
  });
});

describe("enrol", () => {
  const RESULT = {
    ok: true,
    type: "fingerprint",
    devices: [
      { deviceId: 3, device: "Office 349", ok: true, verified: true },
      { deviceId: 1, device: "Entrance 1", ok: true, queued: true },
    ],
    summary: "Saved on 1 of 1 machines · 1 offline (queued)",
  };

  it("POST enroll/fingerprint with the finger, and a 120 s time limit", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: RESULT });
    const r = await enrol({ kind: "fingerprint", bookingDetailId: 101, personId: 12, fingerNo: 3 });
    expect(lastCall()).toMatchObject({
      path: "/access-officer/enroll/fingerprint",
      method: "POST",
      body: { bookingDetailId: 101, personId: 12, fingerNo: 3 },
      requiresAuth: true,
      unwrapData: false,
      timeoutMs: 120_000,
    });
    expect(AO_ENROL_TIMEOUT_MS).toBe(120_000);
    expect(r).toMatchObject({ ok: true, kind: "fingerprint", queuedCount: 1 });
    expect(r.devices.map((d) => d.device)).toEqual(["Office 349", "Entrance 1"]);
  });

  it("POST enroll/face without a finger; a bad finger number becomes 1", async () => {
    api.mockResolvedValueOnce({ ...RESULT, type: "face" });
    await enrol({ kind: "face", bookingDetailId: 101, personId: 12, fingerNo: 4 });
    expect(lastCall()).toMatchObject({ path: "/access-officer/enroll/face", body: { bookingDetailId: 101, personId: 12 } });
    expect(lastCall().body).not.toHaveProperty("fingerNo");

    api.mockResolvedValueOnce(RESULT);
    await enrol({ kind: "fingerprint", bookingDetailId: 101, personId: 12, fingerNo: 42 });
    expect(lastCall().body).toEqual({ bookingDetailId: 101, personId: 12, fingerNo: 1 });
    expect(ACCESS_OFFICER_ENDPOINTS.enroll("face")).toBe("/access-officer/enroll/face");
  });

  it("the API's failed enrolment: 400, envelope message = the error, data = HikEnrollResultDto", async () => {
    const data = { ok: false, type: "fingerprint", error: "No finger was placed in time.", devices: [{ deviceId: 3, device: "Office 349", ok: false, error: "Timeout" }] };
    api.mockRejectedValueOnce(new ApiError("No finger was placed in time.", 400, { isSuccessful: false, message: "No finger was placed in time.", data }));
    const r = await enrol({ kind: "fingerprint", bookingDetailId: 101, personId: 12, fingerNo: 2 });
    expect(r).toMatchObject({ ok: false, kind: "fingerprint", error: "No finger was placed in time." });
    expect(r.devices[0]).toMatchObject({ device: "Office 349", ok: false, error: "Timeout" });
  });

  it("the API's success: message = summary, data = HikEnrollResultDto", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Saved on 3 of 3 machines", data: { ok: true, type: "face", devices: [], summary: "Saved on 3 of 3 machines" } });
    const r = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 });
    expect(r).toMatchObject({ ok: true, summary: "Saved on 3 of 3 machines", error: null });
  });

  it("409 (access removed, still pending) throws with the server's words", async () => {
    const message = "Sara Khan's door access to Office 349 is removed. Restore access before enrolling.";
    api.mockRejectedValueOnce(new ApiError(message, 409, { isSuccessful: false, message, data: null }));
    const error = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 }).catch((e) => e);
    expect(accessOfficerEnrolMessage(error)).toBe(message);
  });

  it("a refused enrolment that reports per-machine results resolves with ok: false (400 body or refused envelope)", async () => {
    const failed = { ok: false, type: "face", error: "No face was captured in time.", devices: [{ deviceId: 3, device: "Office 349", ok: false, error: "Timeout" }] };
    api.mockRejectedValueOnce(new ApiError("No face was captured in time.", 400, failed));
    const r = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 });
    expect(r).toMatchObject({ ok: false, kind: "face", error: "No face was captured in time." });
    expect(r.devices).toHaveLength(1);

    api.mockRejectedValueOnce(new ApiError("Refused", 200, { isSuccessful: false, message: "Machine busy.", data: { ok: true, devices: [] } }));
    const refused = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 });
    expect(refused).toMatchObject({ ok: false, error: "Machine busy." });
  });

  it("other failures throw: 503 (AO_01), no answer, a plain 400", async () => {
    api.mockRejectedValueOnce(new ApiError("Unavailable", 503, { message: "The Access page needs the database update AO_01." }));
    await expect(enrol({ kind: "face", bookingDetailId: 101, personId: 12 })).rejects.toMatchObject({ status: 503, message: AO_DB_UPDATE_MESSAGE });

    api.mockRejectedValueOnce(new ApiError("The server took too long to respond. Please try again.", 0));
    const timeout = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 }).catch((e) => e);
    expect(accessOfficerEnrolMessage(timeout)).toBe(AO_ENROL_NO_ANSWER_MESSAGE);

    api.mockRejectedValueOnce(new ApiError("This person's access is turned off.", 400, { message: "This person's access is turned off." }));
    const plain = await enrol({ kind: "face", bookingDetailId: 101, personId: 12 }).catch((e) => e);
    expect(accessOfficerEnrolMessage(plain)).toBe("This person's access is turned off.");
  });

  it("refuses missing ids without calling the API", async () => {
    await expect(enrol({ kind: "face", bookingDetailId: 101, personId: 0 })).rejects.toThrow(/person is missing/);
    expect(api).not.toHaveBeenCalled();
  });
});

describe("the officer's locations", () => {
  it("GET location/all, authenticated; names from an array, envelope, items or data", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: [{ id: 1, name: "I-8" }, { Id: 2, Name: "F-7" }, { id: 3, name: "I-8" }] });
    expect(await getMyLocationNames()).toEqual(["I-8", "F-7"]);
    expect(lastCall()).toMatchObject({ path: "/location/all", requiresAuth: true });
    expect(normalizeLocationNames([{ name: "G-11" }, null, 3])).toEqual(["G-11"]);
    expect(normalizeLocationNames({ items: [{ locationName: "Blue Area" }] })).toEqual(["Blue Area"]);
    expect(normalizeLocationNames({ data: [{ name: "E-11" }], total: 1 })).toEqual(["E-11"]);
    expect(normalizeLocationNames(null)).toEqual([]);
  });

  it("is best effort: [] when it fails", async () => {
    api.mockRejectedValueOnce(new ApiError("Forbidden", 403));
    expect(await getMyLocationNames()).toEqual([]);
  });
});

describe("503: the database update AO_01 has not been run", () => {
  it("names the update the server asked for, AO_01 otherwise", () => {
    expect(aoDatabaseUpdateOf(new ApiError("needs ao_02 first", 503))).toBe("AO_02");
    expect(aoDatabaseUpdateOf(new ApiError("Unavailable", 503, { message: "Please run AO_01" }))).toBe("AO_01");
    expect(aoDatabaseUpdateOf(new ApiError("Unavailable", 503))).toBe("AO_01");
    expect(aoDatabaseUpdateOf(null)).toBe("AO_01");
    // Whatever update the server names is kept (not only AO_xx).
    expect(aoDatabaseUpdateOf(new ApiError("Unavailable", 503, { message: "The Access page needs the database update EMP_01." }))).toBe("EMP_01");
    expect(aoDatabaseUpdateMessage(aoDatabaseUpdateOf(new ApiError("needs QA_07", 503)))).toMatch(/database update QA_07/);
    expect(aoDatabaseUpdateOf(new ApiError("Unavailable", 503, { message: "Something went wrong." }))).toBe("AO_01");
    expect(AO_DB_UPDATE_MESSAGE).toBe(aoDatabaseUpdateMessage("AO_01"));
    expect(AO_DB_UPDATE_MESSAGE).toMatch(/^The Access page needs the database update AO_01/);
  });

  it("toAccessOfficerError rewrites only a 503", () => {
    const other = new ApiError("Nope", 400);
    expect(toAccessOfficerError(other)).toBe(other);
    const rewritten = toAccessOfficerError(new ApiError("Unavailable", 503, { message: "x" })) as ApiError;
    expect(rewritten).toBeInstanceOf(ApiError);
    expect(rewritten.status).toBe(503);
    expect(rewritten.details).toEqual({ message: "x" });
  });

  it("every write and the lookup turn it into the clear message", async () => {
    const calls = [
      () => lookupByCnic("12345-1234567-1"),
      () => addToRoom({ bookingDetailId: 101, cnic: "12345-1234567-1" }),
      () => removeAccess({ bookingDetailId: 101, personId: 12 }),
      () => restoreAccess({ bookingDetailId: 101, personId: 12 }),
    ];
    for (const call of calls) {
      api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, { message: "Database update missing" }));
      const error = await call().catch((e) => e);
      expect(error.status).toBe(503);
      expect(error.message).toBe(AO_DB_UPDATE_MESSAGE);
      expect(accessOfficerActionMessage(error)).toBe(AO_DB_UPDATE_MESSAGE);
    }
  });
});

describe("error views and action messages", () => {
  it("screen error view: AO_01, forbidden, offline, other", () => {
    const db = accessOfficerErrorView(new ApiError("x", 503, { message: "needs AO_01" }));
    expect(db).toMatchObject({ title: "Database update needed", databaseUpdate: true, icon: "construct-outline" });
    expect(db.message).toBe(AO_DB_UPDATE_MESSAGE);
    expect(accessOfficerErrorView(new ApiError("Forbidden", 403, null)).message).toBe(AO_FORBIDDEN_MESSAGE);
    expect(accessOfficerErrorView(new ApiError("Forbidden", 403, { message: "The Access Officer account can only open the Access page." })).message).toBe(
      "The Access Officer account can only open the Access page.",
    );
    expect(accessOfficerErrorView(new ApiError("Can't reach the server.", 0))).toMatchObject({ title: "Could not reach WorkNest", message: AO_OFFLINE_MESSAGE });
    expect(accessOfficerErrorView(new ApiError("Something went wrong on our side.", 500)).message).toBe("Something went wrong on our side.");
  });

  it("action messages: the server's words where it sent some, ours otherwise", () => {
    expect(accessOfficerActionMessage(new ApiError("x", 409, null))).toBe(AO_CONFLICT_MESSAGE);
    expect(accessOfficerActionMessage(new ApiError("x", 404, null))).toBe(AO_GONE_MESSAGE);
    expect(accessOfficerActionMessage(new ApiError("x", 403, null))).toBe(AO_FORBIDDEN_MESSAGE);
    expect(accessOfficerActionMessage(new ApiError("x", 0))).toBe(AO_OFFLINE_MESSAGE);
    expect(accessOfficerActionMessage(new ApiError("The booking is full (6 of 6 seats).", 400, { message: "The booking is full (6 of 6 seats)." }))).toBe(
      "The booking is full (6 of 6 seats).",
    );
    expect(accessOfficerActionMessage(new Error("The room is missing. Pull down to refresh, then try again."))).toBe(
      "The room is missing. Pull down to refresh, then try again.",
    );
    expect(accessOfficerActionMessage(null, "Could not add.")).toBe("Could not add.");
    expect(accessOfficerEnrolMessage(new ApiError("x", 504))).toBe(AO_ENROL_NO_ANSWER_MESSAGE);
    expect(accessOfficerEnrolMessage(new ApiError("x", 503))).toBe(AO_DB_UPDATE_MESSAGE);
  });
});
