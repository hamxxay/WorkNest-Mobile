// Normalisers of the Access Officer API: the contract's JSON in, typed values out; missing fields get safe defaults
// and odd shapes never throw. config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));

import {
  isEnrolResultShape,
  normalizeEnrolResult,
  normalizeLookup,
  normalizeMatch,
  normalizeMatchState,
  normalizePerson,
  normalizeWriteResult,
  optBool,
} from "../normalize";

/** The contract's example answer of GET api/access-officer/lookup. */
const CONTRACT_LOOKUP = {
  isSuccessful: true,
  message: "Success",
  data: {
    cnic: "12345-1234567-1",
    person: { personId: 12, name: "Sara Khan", email: "sara@example.com", phone: "03001234567", idType: "CNIC", idNumber: "12345-1234567-1" },
    matches: [
      {
        bookingDetailId: 101,
        bookingId: 55,
        room: "Office 349",
        spaceCode: "O-349",
        location: "I-8",
        locationId: 1,
        customer: "SAC@WN",
        bookingStatus: "Confirmed",
        startOn: "2026-10-01",
        endOn: "2026-12-31",
        state: "assigned",
        accessEnabled: true,
        credentials: { face: true, fingerprint: false, card: false },
        roomMachine: { name: "Office 349", online: true },
        seats: { used: 3, total: 6 },
      },
      {
        bookingDetailId: 102,
        bookingId: 56,
        room: "Desk 12",
        location: "F-7",
        locationId: 2,
        customer: "Acme",
        bookingStatus: "Confirmed",
        startOn: "2026-11-01",
        endOn: "2027-01-31",
        state: "pending",
        accessEnabled: false,
        credentials: { face: false, fingerprint: false, card: false },
        roomMachine: null,
      },
    ],
  },
};

describe("normalizeLookup", () => {
  it("reads the contract's answer", () => {
    const l = normalizeLookup(CONTRACT_LOOKUP);
    expect(l.cnic).toBe("12345-1234567-1");
    expect(l.person).toEqual({
      personId: 12,
      name: "Sara Khan",
      email: "sara@example.com",
      phone: "03001234567",
      idType: "CNIC",
      idNumber: "12345-1234567-1",
    });
    expect(l.matches).toHaveLength(2);
    expect(l.matches[0]).toEqual({
      bookingDetailId: 101,
      bookingId: 55,
      personId: null,
      room: "Office 349",
      spaceCode: "O-349",
      location: "I-8",
      locationId: 1,
      customer: "SAC@WN",
      bookingStatus: "Confirmed",
      startOn: "2026-10-01",
      endOn: "2026-12-31",
      state: "assigned",
      accessEnabled: true,
      credentials: { face: true, fingerprint: false, card: false },
      roomMachine: { name: "Office 349", online: true },
      seats: { used: 3, total: 6 },
    });
    expect(l.matches[1]).toMatchObject({ bookingDetailId: 102, state: "pending", roomMachine: null, seats: null, spaceCode: null });
  });

  it("accepts a bare object and a null person (only pending requests)", () => {
    const l = normalizeLookup({ cnic: "12345-1234567-1", person: null, matches: [{ bookingDetailId: 7, state: "pending" }] });
    expect(l.person).toBeNull();
    expect(l.matches[0]).toMatchObject({ bookingDetailId: 7, state: "pending", room: "Room" });
  });

  it("falls back to the person's number, then to what was asked, for the CNIC", () => {
    expect(normalizeLookup({ person: { name: "A", idNumber: "AB1234567" }, matches: [] }).cnic).toBe("AB1234567");
    expect(normalizeLookup({ matches: [] }, " 12345-1234567-1 ").cnic).toBe("12345-1234567-1");
  });

  it("never throws on odd answers", () => {
    for (const raw of [null, undefined, "", 42, [], "oops", { data: null }, { isSuccessful: true, data: [] }, { matches: "x" }, { matches: [null, 1, "a"] }]) {
      const l = normalizeLookup(raw, "12345");
      expect(l.matches).toEqual([]);
      expect(l.person).toBeNull();
    }
  });

  it("drops matches without a bookingDetailId (no action could name the room)", () => {
    const l = normalizeLookup({ matches: [{ room: "No id" }, { bookingDetailId: 0 }, { bookingDetailId: -3 }, { bookingDetailId: "8", room: "Kept" }] });
    expect(l.matches.map((m) => [m.bookingDetailId, m.room])).toEqual([[8, "Kept"]]);
  });
});

describe("normalizeMatch: safe defaults", () => {
  it("a bare id gets: pending, access on, nothing enrolled, no machine, no seats", () => {
    expect(normalizeMatch({ bookingDetailId: 5 })).toEqual({
      bookingDetailId: 5,
      bookingId: null,
      personId: null,
      room: "Room",
      spaceCode: null,
      location: null,
      locationId: null,
      customer: null,
      bookingStatus: null,
      startOn: null,
      endOn: null,
      state: "pending",
      accessEnabled: true,
      credentials: { face: false, fingerprint: false, card: false },
      roomMachine: null,
      seats: null,
    });
  });

  it("a machine without an online flag has an unknown status; seats need a total", () => {
    const m = normalizeMatch({ bookingDetailId: 5, roomMachine: { name: "Office 1" }, seats: { used: 2 } });
    expect(m?.roomMachine).toEqual({ name: "Office 1", online: null });
    expect(m?.seats).toBeNull();
    expect(normalizeMatch({ bookingDetailId: 5, roomMachine: {} })?.roomMachine).toEqual({ name: "Room machine", online: null });
    expect(normalizeMatch({ bookingDetailId: 5, seats: { used: -1, total: "4" } })?.seats).toEqual({ used: 0, total: 4 });
  });

  it("reads PascalCase, strings and other spellings", () => {
    const m = normalizeMatch({
      BookingDetailId: "101",
      PersonId: 12,
      SpaceName: "Office 349",
      LocationName: "I-8",
      CustomerName: "SAC@WN",
      State: "Assigned",
      AccessEnabled: "false",
      Credentials: { Face: 1, Fingerprint: "true" },
      RoomMachine: { Name: "Office 349", Online: "0" },
    });
    expect(m).toMatchObject({
      bookingDetailId: 101,
      personId: 12,
      room: "Office 349",
      location: "I-8",
      customer: "SAC@WN",
      state: "assigned",
      accessEnabled: false,
      credentials: { face: true, fingerprint: true, card: false },
      roomMachine: { name: "Office 349", online: false },
    });
  });

  it("returns null for anything that is not a match", () => {
    expect(normalizeMatch(null)).toBeNull();
    expect(normalizeMatch([])).toBeNull();
    expect(normalizeMatch("x")).toBeNull();
  });
});

describe("normalizeMatchState", () => {
  it.each([
    ["pending", "pending"],
    ["Pending", "pending"],
    ["waiting", "pending"],
    ["assigned", "assigned"],
    ["ASSIGNED", "assigned"],
    ["active", "assigned"],
    ["on_room", "assigned"],
    ["", "pending"],
    [null, "pending"],
    ["something else", "pending"],
  ])("%p -> %p", (value, expected) => {
    expect(normalizeMatchState(value)).toBe(expected);
  });
});

describe("normalizePerson", () => {
  it("needs a name, a number or an id", () => {
    expect(normalizePerson({})).toBeNull();
    expect(normalizePerson(null)).toBeNull();
    expect(normalizePerson({ email: "x@y.z" })).toBeNull();
    expect(normalizePerson({ idNumber: "12345-1234567-1" })).toMatchObject({ name: "", personId: null, email: null, phone: null });
    expect(normalizePerson({ Name: "Ali", PhoneNumber: "0300" })).toMatchObject({ name: "Ali", phone: "0300" });
  });
});

describe("optBool", () => {
  it("reads booleans, 1 / 0 and words; null otherwise", () => {
    expect(optBool({ a: true }, "a")).toBe(true);
    expect(optBool({ a: 0 }, "a")).toBe(false);
    expect(optBool({ a: "Yes" }, "a")).toBe(true);
    expect(optBool({ a: "false" }, "a")).toBe(false);
    expect(optBool({ a: "maybe" }, "a")).toBeNull();
    expect(optBool({}, "a")).toBeNull();
    expect(optBool(null, "a")).toBeNull();
  });
});

describe("normalizeEnrolResult", () => {
  const RESULT = {
    ok: true,
    type: "face",
    machineId: "100012",
    devices: [
      { deviceId: 3, device: "Office 349", ok: true, queued: false, error: null, verified: true },
      { deviceId: 1, device: "Entrance 1", ok: true, queued: false, verified: true },
      { deviceId: 2, device: "Entrance 2", ok: true, queued: true, error: "Machine offline — queued", verified: null },
    ],
    verifiedCount: 2,
    targetCount: 2,
    queuedCount: 1,
    summary: "Saved on 2 of 2 machines · 1 offline (queued)",
  };

  it("reads HikEnrollResultDto, bare or in the envelope", () => {
    for (const raw of [RESULT, { isSuccessful: true, message: "Success", data: RESULT }]) {
      const r = normalizeEnrolResult(raw, "face");
      expect(r).toMatchObject({ ok: true, kind: "face", error: null, machineId: "100012", verifiedCount: 2, targetCount: 2, queuedCount: 1 });
      expect(r.summary).toBe("Saved on 2 of 2 machines · 1 offline (queued)");
      expect(r.devices[2]).toEqual({ deviceId: 2, device: "Entrance 2", ok: true, queued: true, error: "Machine offline — queued", verified: null });
    }
  });

  it("a failed enrolment keeps the server's error", () => {
    const r = normalizeEnrolResult({ ok: false, type: "fingerprint", error: "No finger was placed in time.", devices: [] }, "fingerprint");
    expect(r).toMatchObject({ ok: false, kind: "fingerprint", error: "No finger was placed in time." });
  });

  it("missing ok: true only when something saved and nothing failed; counts from the list", () => {
    const saved = normalizeEnrolResult({ devices: [{ device: "A", ok: true, verified: true }, { device: "B", queued: true }] }, "face");
    expect(saved).toMatchObject({ ok: true, verifiedCount: 1, targetCount: 1, queuedCount: 1 });
    const failed = normalizeEnrolResult({ devices: [{ device: "A", ok: true }, { device: "B", ok: false, error: "x" }] }, "face");
    expect(failed.ok).toBe(false);
    expect(normalizeEnrolResult({}, "face").ok).toBe(false);
  });

  it("a refused envelope with no result reads its message as the error", () => {
    const r = normalizeEnrolResult({ isSuccessful: false, message: "Access for this person is turned off.", data: null }, "face");
    expect(r).toMatchObject({ ok: false, error: "Access for this person is turned off.", devices: [] });
  });

  it("never throws", () => {
    for (const raw of [null, undefined, 1, "x", [], { devices: "x" }, { devices: [null, 3] }]) {
      expect(normalizeEnrolResult(raw, "face")).toMatchObject({ ok: false, devices: [] });
    }
  });

  it("isEnrolResultShape", () => {
    expect(isEnrolResultShape(RESULT)).toBe(true);
    expect(isEnrolResultShape({ isSuccessful: false, data: { ok: false } })).toBe(true);
    expect(isEnrolResultShape({ message: "Bad request" })).toBe(false);
    expect(isEnrolResultShape(null)).toBe(false);
  });
});

describe("the API's own shapes (api-ao)", () => {
  it("every match carries its personId; a pending one sends 0 (no person yet)", () => {
    const l = normalizeLookup({
      isSuccessful: true,
      data: {
        cnic: "12345-1234567-1",
        person: { personId: 12, name: "Sara Khan", idType: "CNIC", idNumber: "12345-1234567-1" },
        matches: [
          { bookingDetailId: 101, bookingId: 55, personId: 12, room: "Office 349", state: "assigned", accessEnabled: true, roomMachine: { name: "Office 349", online: false } },
          { bookingDetailId: 140, bookingId: 60, personId: 31, room: "Office 12", state: "assigned", accessEnabled: false, roomMachine: null },
          { bookingDetailId: 150, bookingId: 61, personId: 0, room: "Desk 4", state: "pending", accessEnabled: false },
        ],
      },
    });
    expect(l.matches.map((m) => [m.bookingDetailId, m.personId, m.state, m.accessEnabled])).toEqual([
      [101, 12, "assigned", true],
      [140, 31, "assigned", false],
      [150, null, "pending", false],
    ]);
    expect(l.matches[0].roomMachine).toEqual({ name: "Office 349", online: false });
  });

  it("remove / restore answer { match, machines: HikAccessSyncResultDto }", () => {
    const r = normalizeWriteResult(
      {
        isSuccessful: true,
        message: "Sara Khan's door access to Office 349 and the entrances is removed. They stay on SAC@WN's booking.",
        data: {
          match: { bookingDetailId: 101, personId: 12, room: "Office 349", state: "assigned", accessEnabled: false },
          machines: {
            enabled: false,
            people: 1,
            notEnrolled: 0,
            suspended: false,
            error: null,
            devices: [
              { deviceId: 3, device: "Office 349", ok: true, queued: false },
              { deviceId: 1, device: "Entrance 1", ok: true, queued: true, error: "Machine offline — queued" },
            ],
          },
        },
      },
      "Removed.",
    );
    expect(r.message).toMatch(/^Sara Khan's door access to Office 349/);
    expect(r.match).toMatchObject({ bookingDetailId: 101, personId: 12, accessEnabled: false });
    expect(r.devices.map((d) => [d.device, d.ok, d.queued])).toEqual([
      ["Office 349", true, false],
      ["Entrance 1", true, true],
    ]);
    expect(r.machinesError).toBeNull();

    const unreachable = normalizeWriteResult(
      { isSuccessful: true, data: { match: null, machines: { enabled: true, error: "The door machines could not be updated right away.", devices: [] } } },
      "Restored.",
    );
    expect(unreachable).toEqual({ message: "Restored.", match: null, devices: [], machinesError: "The door machines could not be updated right away." });
  });
});

describe("normalizeWriteResult", () => {
  it("the server's message and the updated match (as data, data.match or data.matches[0])", () => {
    const match = { bookingDetailId: 101, personId: 12, room: "Office 349", state: "assigned", accessEnabled: true };
    for (const data of [match, { match }, { matches: [match] }]) {
      const r = normalizeWriteResult({ isSuccessful: true, message: "Sara Khan is now on Office 349.", data }, "Added.");
      expect(r.message).toBe("Sara Khan is now on Office 349.");
      expect(r.match).toMatchObject({ bookingDetailId: 101, personId: 12, state: "assigned" });
    }
  });

  it("our message when the server sent none (or just 'Success'); no match, no devices", () => {
    expect(normalizeWriteResult({ isSuccessful: true, message: "Success", data: null }, "Door access removed.")).toEqual({
      message: "Door access removed.",
      match: null,
      devices: [],
      machinesError: null,
    });
    expect(normalizeWriteResult(null, "Done.")).toEqual({ message: "Done.", match: null, devices: [], machinesError: null });
  });

  it("per-machine results of a remove / restore", () => {
    const r = normalizeWriteResult(
      { isSuccessful: true, data: { enabled: false, devices: [{ deviceId: 1, device: "Entrance 1", ok: true, queued: true }] } },
      "Removed.",
    );
    expect(r.devices).toEqual([{ deviceId: 1, device: "Entrance 1", ok: true, queued: true, error: null, verified: null }]);
    expect(r.match).toBeNull();
  });
});
