import { ApiError, serverMessage } from "../apiClient";
import { isObject, list, payload, section } from "../ceo/readers";
import { AO_ENROL_TIMEOUT_MS } from "../accessOfficer/api";
import { normalizeMachineResult, optBool } from "../accessOfficer/normalize";
import type { AoMachineResult } from "../accessOfficer/types";
import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet, staffRequest } from "./http";
import { optNum, optStr, pick } from "./normalize";

// The door machines behind a booked room, for the staff Room Access screen (CMS attendant-management): what the
// machines did after door access on / off or Remove (HikAccessSyncResultDto), the room machine an enrolment captures
// on (GET bookings/{id}/room-machine), and fingerprint / face / card enrolment
// (POST bookings/{id}/attendants/{personId}/hik/{kind}, HikEnrollRequest { fingerNo, cardNo? }). Pure helpers are
// unit-tested in __tests__/staffOps.test.ts.

// ─── Access on / off and Remove: what the machines did ──────────────────────────────────────────────────────

/** HikAccessSyncResultDto: the machines' side of an access change. */
export type MachineSync = {
  /** The access the change asked for (true = on). */
  enabled: boolean;
  /** People that exist on the machines (enrolled at least once). */
  people: number;
  /** People skipped because they were never enrolled on a machine. */
  notEnrolled: number;
  /** The booking is suspended for an overdue challan: the machines keep everyone blocked. */
  suspended: boolean;
  /** The machines could not be updated at all. */
  error: string | null;
  devices: AoMachineResult[];
};

/** The `machines` object of an access-status / remove answer (bare or in an envelope); null when not sent. */
export function normalizeMachineSync(raw: unknown): MachineSync | null {
  const m = section(payload(raw), "machines");
  if (!m) return null;
  return {
    enabled: optBool(m, "enabled") === true,
    people: Math.max(0, optNum(m, "people") ?? 0),
    notEnrolled: Math.max(0, optNum(m, "notEnrolled") ?? 0),
    suspended: optBool(m, "suspended") === true,
    error: optStr(m, "error"),
    devices: list(m, "devices", normalizeMachineResult),
  };
}

export type MachineNoticeTone = "success" | "warning" | "danger";

/** One machine that did not take the change (shown under the notice). */
export type MachineProblem = { device: string; status: string; queued: boolean };

export type MachineNotice = {
  tone: MachineNoticeTone;
  message: string;
  /** Machines that were offline (queued) or failed; [] when every machine took the change. */
  problems: MachineProblem[];
};

/** What was done, for the notice: door access on / off for someone, or someone removed from the room. */
export type MachineChange = "enable" | "disable" | "remove";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The notice after door access on / off or Remove, like the CMS reportMachineSync: success when every machine took
 * it (or the person was never enrolled, so there was nothing to change at the door); a warning when the booking is
 * suspended (doors stay blocked), or machines were offline (queued) or failed, naming them.
 */
export function machineSyncNotice(sync: MachineSync | null, who: string, change: MachineChange): MachineNotice {
  const name = who.trim();
  const done =
    change === "remove"
      ? `${name || "This person"} removed from the room`
      : `Door access turned ${change === "enable" ? "on" : "off"} for ${name || "this person"}`;
  if (change === "enable" && sync?.suspended) {
    return {
      tone: "warning",
      message: `${done}, but the doors stay blocked while the challan is overdue. Access comes back when the challan is paid or access is extended.`,
      problems: [],
    };
  }
  if (sync?.error && !sync.devices.length) {
    return { tone: "warning", message: `${done}, but the door machines could not be updated: ${sync.error}`, problems: [] };
  }
  if (!sync || sync.people === 0) {
    const nothing = change === "enable" ? "nothing to change at the door" : "nothing to block at the door";
    return { tone: "success", message: `${done}. Not enrolled on any machine yet, so there was ${nothing}.`, problems: [] };
  }
  const failed = sync.devices.filter((d) => !d.ok && !d.queued);
  const queued = sync.devices.filter((d) => d.queued);
  const problems: MachineProblem[] = [
    ...failed.map((d) => ({ device: d.device, status: d.error ? `Failed: ${d.error}` : "Failed", queued: false })),
    ...queued.map((d) => ({ device: d.device, status: "Offline: the change is queued and applies when it reconnects", queued: true })),
  ];
  const notEnrolled = sync.notEnrolled > 0 ? ` ${plural(sync.notEnrolled, "person", "people")} not enrolled yet.` : "";
  const onMachines = (n: number) => (change === "remove" ? ` and blocked on ${plural(n, "machine")}` : ` on ${plural(n, "machine")}`);
  if (failed.length) {
    return {
      tone: "danger",
      message: `${done}, but ${plural(failed.length, "machine")} could not be updated: ${failed.map((d) => d.device).join(", ")}.${notEnrolled}`,
      problems,
    };
  }
  if (queued.length) {
    const live = sync.devices.length - queued.length;
    return {
      tone: "warning",
      message: `${done}${onMachines(live)}. ${plural(queued.length, "offline machine")} will update when ${queued.length === 1 ? "it reconnects" : "they reconnect"}: ${queued.map((d) => d.device).join(", ")}.${notEnrolled}`,
      problems,
    };
  }
  return { tone: "success", message: `${done}${onMachines(sync.devices.length)}.${notEnrolled}`, problems: [] };
}

// ─── The room machine (enrolment captures there) ────────────────────────────────────────────────────────────

export type RoomMachineStatus = {
  /** False: the server could not tell (nobody in the room yet); the enrolment itself then reports any problem. */
  checked: boolean;
  /** The capture machine's name; null when no machine is linked to the room. */
  name: string | null;
  online: boolean;
  canEnrol: boolean;
  /** Why enrolment can't start ("... is offline"), or null. */
  reason: string | null;
};

export function normalizeRoomMachine(raw: unknown): RoomMachineStatus | null {
  const d = payload(raw);
  if (!Object.keys(d).length) return null;
  const checked = optBool(d, "checked") === true;
  const online = optBool(d, "online") === true;
  return {
    checked,
    name: optStr(d, "name"),
    online,
    canEnrol: checked ? optBool(d, "canEnrol") ?? online : true,
    reason: checked ? optStr(d, "reason") : null,
  };
}

/**
 * GET bookings/{bookingDetailId}/room-machine. Best effort: null when it can't be read (older server, offline), so
 * the enrol buttons stay on and the enrolment answers with the reason itself.
 */
export async function getRoomMachine(bookingDetailId: number): Promise<RoomMachineStatus | null> {
  try {
    return normalizeRoomMachine(await staffGet(STAFF_ENDPOINTS.attendants.roomMachine(bookingDetailId)));
  } catch {
    return null;
  }
}

/** Whether the enrol buttons are off, and why (null = they can be used). */
export function enrolBlockedReason(machine: RoomMachineStatus | null): string | null {
  if (!machine || !machine.checked || machine.canEnrol) return null;
  return machine.reason ?? "The booked room's machine is offline. Enrolment can start when it is back online.";
}

// ─── Enrolment ──────────────────────────────────────────────────────────────────────────────────────────────

export type StaffEnrolKind = "fingerprint" | "face" | "card";

const isPositiveId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** A finger number 1-10 (anything else: 1, the default). */
export function fingerOrOne(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

/** Same time limit as the Access Officer: the room machine waits for the person (up to about 90 s). */
export const STAFF_ENROL_TIMEOUT_MS = AO_ENROL_TIMEOUT_MS;

export const STAFF_ENROL_TITLES: Record<StaffEnrolKind, string> = {
  fingerprint: "Enrol fingerprint",
  face: "Enrol face",
  card: "Add card",
};

/** A typed card number: 1-32 letters or digits (the API's rule). */
export function cardNumberError(cardNo: string): string | null {
  const v = (cardNo ?? "").trim();
  if (!v) return "Enter the card number.";
  if (!/^[0-9A-Za-z]{1,32}$/.test(v)) return "Enter a valid card number (1 to 32 letters or digits).";
  return null;
}

/** "the Office 329 machine" (the machine's own name when it is not just the room). */
function machineWords(roomName: string, machineName?: string | null): string {
  const room = roomName.trim() || "room";
  const name = machineName?.trim();
  return name && name.toLowerCase() !== room.toLowerCase() ? `the ${name} machine (${room})` : `the ${room} machine`;
}

/**
 * What staff tell the person while the room machine waits: "Ask Sara Khan to stand at the Office 329 machine and
 * place finger 2 on the reader." A typed card number needs nobody at the machine.
 */
export function staffEnrolPrompt(
  kind: StaffEnrolKind,
  name: string,
  roomName: string,
  options: { machineName?: string | null; fingerNo?: number; cardNo?: string } = {},
): string {
  const who = name.trim() || "the person";
  const where = machineWords(roomName, options.machineName);
  if (kind === "face") return `Ask ${who} to stand at ${where} and look at the camera.`;
  if (kind === "card") {
    const typed = options.cardNo?.trim();
    return typed ? `Saving card ${typed} for ${who} on the machines.` : `Ask ${who} to stand at ${where} and tap the card on the reader.`;
  }
  return `Ask ${who} to stand at ${where} and place finger ${fingerOrOne(options.fingerNo)} on the reader.`;
}

export type StaffEnrolResult = {
  ok: boolean;
  kind: StaffEnrolKind;
  error: string | null;
  summary: string | null;
  cardNo: string | null;
  devices: AoMachineResult[];
  queuedCount: number;
};

/** True when the value (bare or in an envelope) is an enrolment result (it has `ok` or `devices`). */
function isEnrolShape(value: unknown): boolean {
  const d = payload(value);
  return Array.isArray(pick(d, "devices")) || typeof pick(d, "ok") === "boolean";
}

/** HikEnrollResultDto (bare or in an envelope). Missing ok: true only when a machine saved it and none failed. */
export function normalizeStaffEnrolResult(raw: unknown, kind: StaffEnrolKind): StaffEnrolResult {
  const d = payload(raw);
  const devices = list(d, "devices", normalizeMachineResult);
  const anyFailed = devices.some((x) => !x.ok && !x.queued);
  const anySaved = devices.some((x) => x.ok || x.queued);
  const ok = optBool(d, "ok", "success") ?? (anySaved && !anyFailed);
  return {
    ok,
    kind,
    error: ok ? null : optStr(d, "error") ?? (isObject(raw) ? serverMessage(raw) : null),
    summary: optStr(d, "summary"),
    cardNo: optStr(d, "cardNo"),
    devices,
    queuedCount: Math.max(0, optNum(d, "queuedCount") ?? devices.filter((x) => x.queued).length),
  };
}

/** "Saved on 3 of 3 machines · 1 offline (queued)" (the server's own summary when it sent one). */
export function staffEnrolSummary(result: StaffEnrolResult): string | null {
  if (result.summary) return result.summary;
  if (!result.devices.length) return null;
  const saved = result.devices.filter((x) => x.ok && !x.queued).length;
  const online = result.devices.filter((x) => !x.queued).length;
  const parts = [`Saved on ${saved} of ${online} machine${online === 1 ? "" : "s"}`];
  if (result.queuedCount > 0) parts.push(`${result.queuedCount} offline (queued)`);
  return parts.join(" · ");
}

/**
 * POST bookings/{bookingDetailId}/attendants/{personId}/hik/{fingerprint|face|card} { fingerNo, cardNo? }: captures
 * on the room machine (the person must be standing there; a typed card number is saved directly), then copies it to
 * every Entrance machine. Waits up to 120 s. A refused enrolment that still reports per-machine results (400 with the
 * result) resolves with ok: false so they can be shown; anything else throws.
 */
export async function enrolAttendant(input: {
  bookingDetailId: number;
  personId: number;
  kind: StaffEnrolKind;
  fingerNo?: number;
  cardNo?: string;
}): Promise<StaffEnrolResult> {
  const { bookingDetailId, personId } = input;
  if (!isPositiveId(bookingDetailId) || !isPositiveId(personId)) {
    throw new Error("The person or room is missing. Pull down to refresh, then try again.");
  }
  const body: Record<string, unknown> = { fingerNo: input.kind === "fingerprint" ? fingerOrOne(input.fingerNo) : 1 };
  if (input.kind === "card" && input.cardNo?.trim()) {
    const invalid = cardNumberError(input.cardNo);
    if (invalid) throw new Error(invalid);
    body.cardNo = input.cardNo.trim();
  }
  try {
    const raw = await staffRequest(STAFF_ENDPOINTS.attendants.enrol(bookingDetailId, personId, input.kind), "POST", body, {
      timeoutMs: STAFF_ENROL_TIMEOUT_MS,
    });
    return normalizeStaffEnrolResult(raw, input.kind);
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && isEnrolShape(error.details)) {
      const result = normalizeStaffEnrolResult(error.details, input.kind);
      return { ...result, ok: false, error: result.error ?? error.message };
    }
    if (error instanceof ApiError && error.status === 0 && /too long/i.test(error.message)) {
      throw new ApiError(
        "No answer in time. The enrolment may still have finished on the machine: pull down to refresh, then try again if needed.",
        0,
        error.details,
      );
    }
    throw error;
  }
}
