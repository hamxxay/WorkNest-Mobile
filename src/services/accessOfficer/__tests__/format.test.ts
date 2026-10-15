// The Access screen's ID field (CNIC mask, passport text, the check before Find) and the words on a match card and
// in the enrolment sheet.

import { match } from "../__fixtures__";
import {
  AO_CNIC_INCOMPLETE,
  AO_ID_REQUIRED,
  AO_PASSPORT_INVALID,
  bookingDatesText,
  checkAoId,
  clampFinger,
  credentialChips,
  enrolPrompt,
  enrolResultTitle,
  enrolSummary,
  ENROL_WAIT_NOTE,
  formatAoIdInput,
  formatPassportInput,
  machineLines,
  machineStatusChip,
  matchStatusChip,
  personWords,
  queuedNote,
  seatsText,
  switchAoIdMode,
  writeNotice,
} from "../format";
import type { AoEnrolResult, AoMachineResult } from "../types";

describe("formatAoIdInput: CNIC mode", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["12345", "12345"],
    ["123451", "12345-1"],
    ["123451234567", "12345-1234567"],
    ["1234512345671", "12345-1234567-1"],
    // Pasted with dashes or spaces, or too long.
    ["12345-1234567-1", "12345-1234567-1"],
    ["12345 1234567 1", "12345-1234567-1"],
    ["12345123456719999", "12345-1234567-1"],
    // Deleting the last digit after a dash.
    ["12345-", "12345"],
    ["12345-1234567-", "12345-1234567"],
  ])("%p shows %p", (typed, shown) => {
    expect(formatAoIdInput(typed, "cnic")).toBe(shown);
  });

  it("keeps a pasted passport number (letters) as typed, in upper case", () => {
    expect(formatAoIdInput("ab1234567", "cnic")).toBe("AB1234567");
    expect(formatAoIdInput(" AB 123 4567 ", "cnic")).toBe("AB1234567");
  });

  it("is safe with nothing", () => {
    expect(formatAoIdInput(undefined as unknown as string, "cnic")).toBe("");
  });
});

describe("formatAoIdInput: passport mode", () => {
  it("keeps letters, digits and dashes, upper case, at most 30 letters and digits (the API's limit)", () => {
    expect(formatAoIdInput("ab123", "passport")).toBe("AB123");
    expect(formatAoIdInput("x-99 88", "passport")).toBe("X-9988");
    expect(formatAoIdInput("123456789", "passport")).toBe("123456789");
    expect(formatAoIdInput("a!b@c#1$2%", "passport")).toBe("ABC12");
    expect(formatPassportInput("A".repeat(40))).toHaveLength(30);
    // Dashes do not count towards the 30.
    expect(formatPassportInput(`AB-${"1".repeat(40)}`)).toBe(`AB-${"1".repeat(28)}`);
  });
});

describe("switchAoIdMode", () => {
  it("a CNIC keeps its digits, a passport number keeps its text", () => {
    expect(switchAoIdMode("12345-1234567-1", "passport")).toBe("12345-1234567-1");
    expect(switchAoIdMode("1234512345671", "cnic")).toBe("12345-1234567-1");
    expect(switchAoIdMode("AB1234567", "cnic")).toBe("");
    expect(switchAoIdMode("ab12", "passport")).toBe("AB12");
  });
});

describe("checkAoId (before Find)", () => {
  it("needs something", () => {
    expect(checkAoId("", "cnic")).toEqual({ ok: false, error: AO_ID_REQUIRED });
    expect(checkAoId("   ", "passport")).toEqual({ ok: false, error: AO_ID_REQUIRED });
  });

  it("a CNIC needs all 13 digits and is sent with dashes", () => {
    expect(checkAoId("12345-123456", "cnic")).toEqual({ ok: false, error: AO_CNIC_INCOMPLETE });
    expect(checkAoId("1234512345671", "cnic")).toEqual({ ok: true, value: "12345-1234567-1", kind: "cnic" });
    expect(checkAoId(" 12345-1234567-1 ", "cnic")).toEqual({ ok: true, value: "12345-1234567-1", kind: "cnic" });
  });

  it("a passport number is 5 to 30 letters and digits, sent in upper case", () => {
    expect(checkAoId("ab123", "passport")).toEqual({ ok: true, value: "AB123", kind: "passport" });
    expect(checkAoId("AB12", "passport")).toEqual({ ok: false, error: AO_PASSPORT_INVALID });
    expect(checkAoId("AB-1-2", "passport")).toEqual({ ok: false, error: AO_PASSPORT_INVALID });
    expect(checkAoId("A".repeat(30), "passport")).toEqual({ ok: true, value: "A".repeat(30), kind: "passport" });
    expect(AO_PASSPORT_INVALID).toMatch(/5 to 30 letters and digits/);
    expect(checkAoId("--AB1234567--", "passport")).toEqual({ ok: true, value: "AB1234567", kind: "passport" });
    // Digits only are fine for a foreign passport.
    expect(checkAoId("123456789", "passport")).toEqual({ ok: true, value: "123456789", kind: "passport" });
  });

  it("letters in CNIC mode (pasted) are checked as a passport number", () => {
    expect(checkAoId("AB1234567", "cnic")).toEqual({ ok: true, value: "AB1234567", kind: "passport" });
  });
});

describe("match card words", () => {
  it("status chip: waiting, has access, access removed", () => {
    expect(matchStatusChip({ state: "pending", accessEnabled: true }).label).toBe("Waiting for CNIC check");
    expect(matchStatusChip({ state: "pending", accessEnabled: false }).tone).toBe("warning");
    expect(matchStatusChip({ state: "assigned", accessEnabled: true })).toMatchObject({ label: "Has access", tone: "success" });
    expect(matchStatusChip({ state: "assigned", accessEnabled: false })).toMatchObject({ label: "Access removed", tone: "danger" });
  });

  it("enrolled chips in a fixed order, none when nothing is enrolled", () => {
    expect(credentialChips({ face: false, fingerprint: false, card: false })).toEqual([]);
    expect(credentialChips({ face: true, fingerprint: true, card: true }).map((c) => c.label)).toEqual(["Face", "Fingerprint", "Card"]);
    expect(credentialChips({ face: false, fingerprint: true, card: false }).map((c) => c.icon)).toEqual(["finger-print-outline"]);
  });

  it("machine status: online, offline, unknown, no machine", () => {
    expect(machineStatusChip({ name: "Office 349", online: true })).toMatchObject({ label: "Online", tone: "success" });
    expect(machineStatusChip({ name: "Office 349", online: false })).toMatchObject({ label: "Offline", tone: "danger" });
    expect(machineStatusChip({ name: "Office 349", online: null }).label).toBe("Status unknown");
    expect(machineStatusChip(null)).toMatchObject({ label: "No machine", tone: "neutral" });
  });

  it("booking dates and seats", () => {
    expect(bookingDatesText({ startOn: "2026-10-01", endOn: "2026-12-31" })).toBe("1 Oct – 31 Dec 2026");
    expect(bookingDatesText({ startOn: "2026-10-01", endOn: null })).toBe("From 1 Oct 2026");
    expect(bookingDatesText({ startOn: null, endOn: "2027-01-31" })).toBe("Until 31 Jan 2027");
    expect(bookingDatesText({ startOn: "not a date", endOn: null })).toBeNull();
    expect(seatsText({ seats: { used: 3, total: 6 } })).toBe("3 of 6 seats used");
    expect(seatsText({ seats: { used: 1, total: 1 } })).toBe("1 of 1 seat used");
    expect(seatsText({ seats: null })).toBeNull();
  });

  it("names a person, or says 'the person'", () => {
    expect(personWords(" Sara Khan ")).toBe("Sara Khan");
    expect(personWords("")).toBe("the person");
    expect(personWords(null)).toBe("the person");
  });
});

describe("enrolment words", () => {
  it("tells the officer what to ask the person", () => {
    expect(enrolPrompt("face", "Sara Khan", match())).toBe("Ask Sara Khan to stand at the Office 349 machine and look at the camera.");
    expect(enrolPrompt("fingerprint", "Sara Khan", match(), 3)).toBe(
      "Ask Sara Khan to stand at the Office 349 machine and place finger 3 on the reader.",
    );
    expect(enrolPrompt("fingerprint", null, match({ roomMachine: { name: "Room machine", online: true } }), 99)).toBe(
      "Ask the person to stand at the Office 349 machine and place finger 1 on the reader.",
    );
  });

  it("the waiting note allows for the long capture", () => {
    expect(ENROL_WAIT_NOTE).toMatch(/up to 2 minutes/);
  });

  it("finger numbers are 1-10, default 1", () => {
    expect(clampFinger(7)).toBe(7);
    expect(clampFinger("10")).toBe(10);
    expect(clampFinger(0)).toBe(1);
    expect(clampFinger(11)).toBe(1);
    expect(clampFinger(2.5)).toBe(1);
    expect(clampFinger(undefined)).toBe(1);
  });

  const device = (over: Partial<AoMachineResult>): AoMachineResult => ({
    deviceId: 1,
    device: "Office 349",
    ok: true,
    queued: false,
    error: null,
    verified: true,
    ...over,
  });

  const result = (over: Partial<AoEnrolResult>): AoEnrolResult => ({
    ok: true,
    kind: "face",
    error: null,
    summary: null,
    machineId: "100012",
    quality: null,
    devices: [],
    verifiedCount: 0,
    targetCount: 0,
    queuedCount: 0,
    ...over,
  });

  it("result title", () => {
    expect(enrolResultTitle(result({ ok: true, kind: "face" }), "Sara Khan")).toBe("Face enrolled for Sara Khan");
    expect(enrolResultTitle(result({ ok: true, kind: "fingerprint" }), "Sara Khan", 2)).toBe("Fingerprint (finger 2) enrolled for Sara Khan");
    expect(enrolResultTitle(result({ ok: false, kind: "face" }), "Sara Khan")).toBe("Face enrolment did not finish");
  });

  it("summary: the server's, else built from the machines", () => {
    expect(enrolSummary(result({ summary: "Saved on 3 of 3 machines" }))).toBe("Saved on 3 of 3 machines");
    expect(enrolSummary(result({}))).toBeNull();
    const devices = [device({}), device({ deviceId: 2, device: "Entrance 1" }), device({ deviceId: 3, device: "Entrance 2", ok: true, queued: true })];
    expect(enrolSummary(result({ devices, queuedCount: 1 }))).toBe("Saved on 2 of 2 machines · 1 offline (queued)");
  });

  it("per-machine lines: room machine captured, entrances copied / queued / failed", () => {
    const lines = machineLines(
      [
        device({ device: "Entrance 1", deviceId: 2 }),
        device({ device: "office 349" }),
        device({ device: "Entrance 2", deviceId: 3, queued: true, ok: true, verified: null }),
        device({ device: "Entrance 3", deviceId: 4, ok: false, error: "Login failed", verified: null }),
        device({ device: "Entrance 4", deviceId: 5, verified: false }),
      ],
      "Office 349",
    );
    expect(lines.map((l) => [l.device, l.role, l.status, l.tone])).toEqual([
      ["Entrance 1", "Entrance", "Copied", "success"],
      ["office 349", "Room machine", "Captured and saved", "success"],
      ["Entrance 2", "Entrance", "Offline: queued, applies when it reconnects", "warning"],
      ["Entrance 3", "Entrance", "Failed: Login failed", "danger"],
      ["Entrance 4", "Entrance", "Saved, but not found when checked", "warning"],
    ]);
  });

  it("without a room machine name, the first machine is the room machine", () => {
    const lines = machineLines([device({ device: "Room 7" }), device({ device: "Entrance", deviceId: 2 })], null);
    expect(lines.map((l) => l.role)).toEqual(["Room machine", "Entrance"]);
    expect(machineLines([], "Office 349")).toEqual([]);
  });

  it("remove / restore words the machines that took the change", () => {
    const lines = machineLines([device({ device: "Office 349" }), device({ device: "Entrance 1", deviceId: 2 })], "Office 349", {
      room: "Access removed",
      entrance: "Access removed",
    });
    expect(lines.map((l) => l.status)).toEqual(["Access removed", "Access removed"]);
  });

  it("write notice: success when every machine took it, a warning with the machine lines otherwise", () => {
    const ok = writeNotice({ message: "Removed.", devices: [device({}), device({ device: "Entrance 1", deviceId: 2 })], machinesError: null }, "Office 349", false);
    expect(ok).toEqual({ tone: "success", message: "Removed.", lines: [] });

    const queued = writeNotice(
      { message: "Removed.", devices: [device({}), device({ device: "Entrance 1", deviceId: 2, queued: true, verified: null })], machinesError: null },
      "Office 349",
      false,
    );
    expect(queued.tone).toBe("warning");
    expect(queued.message).toBe("Removed. 1 machine was offline: the change is queued and applies when it reconnects.");
    expect(queued.lines.map((l) => [l.role, l.status])).toEqual([
      ["Room machine", "Access removed"],
      ["Entrance", "Offline: queued, applies when it reconnects"],
    ]);

    const failed = writeNotice(
      {
        message: "Back on. Some door machines could not be updated; see the machine list.",
        devices: [device({ ok: false, error: "Login failed", verified: null })],
        machinesError: null,
      },
      "Office 349",
      true,
    );
    expect(failed.tone).toBe("warning");
    expect(failed.lines[0]).toMatchObject({ role: "Room machine", status: "Failed: Login failed", tone: "danger" });

    const unreachable = writeNotice({ message: "Removed.", devices: [], machinesError: "The door machines could not be updated right away." }, null, false);
    expect(unreachable).toEqual({ tone: "warning", message: "Removed. The door machines could not be updated right away.", lines: [] });

    // Add to room changes no machine: no lines.
    expect(writeNotice({ message: "Sara is on Office 349 now.", devices: [], machinesError: null }, "Office 349", null)).toEqual({
      tone: "success",
      message: "Sara is on Office 349 now.",
      lines: [],
    });
  });

  it("queued note for remove / restore", () => {
    expect(queuedNote([])).toBeNull();
    expect(queuedNote([device({ queued: false })])).toBeNull();
    expect(queuedNote([device({ queued: true })])).toBe("1 machine was offline: the change is queued and applies when it reconnects.");
    expect(queuedNote([device({ queued: true }), device({ queued: true })])).toMatch(/^2 machines were offline/);
  });
});
