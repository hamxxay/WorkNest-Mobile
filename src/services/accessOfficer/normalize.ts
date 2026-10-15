import { serverMessage } from "../apiClient";
import { isObject, list, optId, payload, section, type Row } from "../ceo/readers";
import { optNum, optStr, pick } from "../staff/normalize";
import type {
  AoCredentials,
  AoEnrolKind,
  AoEnrolResult,
  AoLookup,
  AoMachineResult,
  AoMatch,
  AoMatchState,
  AoPerson,
  AoRoomMachine,
  AoSeats,
  AoWriteResult,
} from "./types";

// Normalisers for the Access Officer API (pure, unit-tested in __tests__/normalize.test.ts). They never throw on a
// partial answer: a missing field gets a safe default (no credentials enrolled, no seats line, machine status
// unknown), a match without a bookingDetailId is dropped (no action could name its room), and anything that is not
// the expected shape becomes an empty lookup / a failed enrolment instead of a crash.

// ─── Small readers ───────────────────────────────────────────────────────────────────────────────────────

/** true / false when the field holds a boolean-ish value; null when missing or unreadable. */
export function optBool(row: Row | null | undefined, ...keys: string[]): boolean | null {
  const v = pick(row, ...keys);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : null;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return null;
}

const objectAt = (row: Row | null | undefined, ...keys: string[]): Row | null => {
  const v = pick(row, ...keys);
  return isObject(v) ? v : null;
};

// ─── Lookup ──────────────────────────────────────────────────────────────────────────────────────────────

export function normalizePerson(raw: unknown): AoPerson | null {
  if (!isObject(raw)) return null;
  const name = optStr(raw, "name", "fullName", "personName");
  const idNumber = optStr(raw, "idNumber", "cnic", "idNo");
  const personId = optId(raw, "personId", "id");
  // Nothing that identifies anyone: treat as no person.
  if (!name && !idNumber && personId == null) return null;
  return {
    personId,
    name: name ?? "",
    email: optStr(raw, "email"),
    phone: optStr(raw, "phone", "phoneNumber", "mobile"),
    idType: optStr(raw, "idType"),
    idNumber,
  };
}

const PENDING_STATES = new Set(["pending", "waiting", "requested", "request", "new", "awaiting"]);
const ASSIGNED_STATES = new Set(["assigned", "active", "verified", "approved", "onroom", "attendant", "added"]);

/**
 * "pending" | "assigned" from the match's state (other spellings accepted). Unknown or missing: "pending", the
 * cautious choice (its only action, Add to room, is refused with a clear 409 when the person is already on it).
 */
export function normalizeMatchState(value: unknown): AoMatchState {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (ASSIGNED_STATES.has(key)) return "assigned";
  if (PENDING_STATES.has(key)) return "pending";
  return "pending";
}

function normalizeCredentials(raw: Row | null): AoCredentials {
  return {
    face: raw ? optBool(raw, "face") === true : false,
    fingerprint: raw ? optBool(raw, "fingerprint", "finger") === true : false,
    card: raw ? optBool(raw, "card") === true : false,
  };
}

function normalizeRoomMachine(raw: Row | null): AoRoomMachine | null {
  if (!raw) return null;
  return {
    name: optStr(raw, "name", "device", "deviceName") ?? "Room machine",
    online: optBool(raw, "online", "isOnline"),
  };
}

function normalizeSeats(raw: Row | null): AoSeats | null {
  if (!raw) return null;
  const total = optNum(raw, "total", "seats", "capacity");
  if (total == null || total <= 0) return null;
  const used = Math.max(0, optNum(raw, "used", "taken") ?? 0);
  return { used, total };
}

/** One match; null when it has no bookingDetailId (no action could name its room). */
export function normalizeMatch(raw: unknown): AoMatch | null {
  if (!isObject(raw)) return null;
  const bookingDetailId = optId(raw, "bookingDetailId", "bookingDetailID");
  if (bookingDetailId == null) return null;
  const state = normalizeMatchState(pick(raw, "state", "status"));
  // Missing: assume on (the person was not removed); only an explicit false means "Access removed".
  const accessEnabled = optBool(raw, "accessEnabled", "isEnabled", "enabled") ?? true;
  return {
    bookingDetailId,
    bookingId: optId(raw, "bookingId"),
    personId: optId(raw, "personId"),
    room: optStr(raw, "room", "spaceName", "space") ?? "Room",
    spaceCode: optStr(raw, "spaceCode"),
    location: optStr(raw, "location", "locationName"),
    locationId: optId(raw, "locationId"),
    customer: optStr(raw, "customer", "customerName", "company"),
    bookingStatus: optStr(raw, "bookingStatus"),
    startOn: optStr(raw, "startOn", "startDate", "startDateTime"),
    endOn: optStr(raw, "endOn", "endDate", "endDateTime"),
    state,
    accessEnabled,
    credentials: normalizeCredentials(objectAt(raw, "credentials", "enrolled")),
    roomMachine: normalizeRoomMachine(objectAt(raw, "roomMachine", "machine")),
    seats: normalizeSeats(objectAt(raw, "seats")),
  };
}

/** GET api/access-officer/lookup answer (envelope or bare object). `asked` fills `cnic` when the server sends none. */
export function normalizeLookup(raw: unknown, asked = ""): AoLookup {
  const d = payload(raw);
  const matches = list(d, "matches", (m) => m)
    .map(normalizeMatch)
    .filter((m): m is AoMatch => m !== null);
  const person = normalizePerson(pick(d, "person"));
  return { cnic: optStr(d, "cnic", "idNumber") ?? person?.idNumber ?? asked.trim(), person, matches };
}

// ─── Enrolment and writes ────────────────────────────────────────────────────────────────────────────────

export function normalizeMachineResult(raw: Row): AoMachineResult {
  const queued = optBool(raw, "queued") === true;
  return {
    deviceId: optId(raw, "deviceId", "id"),
    device: optStr(raw, "device", "deviceName", "name") ?? "Machine",
    ok: optBool(raw, "ok", "success") === true,
    queued,
    error: optStr(raw, "error", "message"),
    verified: optBool(raw, "verified"),
  };
}

/** True when `value` (bare or inside an envelope) looks like an enrolment result (it has `ok` or `devices`). */
export function isEnrolResultShape(value: unknown): boolean {
  const d = payload(value);
  return Array.isArray(pick(d, "devices")) || typeof pick(d, "ok") === "boolean";
}

/**
 * POST api/access-officer/enroll/{kind} answer (HikEnrollResultDto, bare or in the envelope). Missing ok: true only
 * when some machine saved it and none failed; counts fall back to the per-machine list.
 */
export function normalizeEnrolResult(raw: unknown, kind: AoEnrolKind): AoEnrolResult {
  const d = payload(raw);
  const devices = list(d, "devices", normalizeMachineResult);
  const anyFailed = devices.some((x) => !x.ok && !x.queued);
  const anySaved = devices.some((x) => x.ok || x.queued);
  const ok = optBool(d, "ok", "success") ?? (anySaved && !anyFailed);
  const envelopeMessage = isObject(raw) && "isSuccessful" in raw ? serverMessage(raw) : null;
  const error = optStr(d, "error") ?? (!ok ? envelopeMessage : null);
  return {
    ok,
    kind,
    error: ok ? null : error,
    summary: optStr(d, "summary"),
    machineId: optStr(d, "machineId"),
    quality: optStr(d, "quality"),
    devices,
    verifiedCount: Math.max(0, optNum(d, "verifiedCount") ?? devices.filter((x) => x.verified === true).length),
    targetCount: Math.max(0, optNum(d, "targetCount") ?? devices.filter((x) => !x.queued).length),
    queuedCount: Math.max(0, optNum(d, "queuedCount") ?? devices.filter((x) => x.queued).length),
  };
}

/**
 * add-to-room / remove-access / restore-access answer: the server's message (else `fallback`), the updated match
 * when sent (as `data` for add-to-room, `data.match` for remove / restore, or `data.matches[0]`), and the machines'
 * results when sent (`data.machines.devices` for remove / restore, or `data.devices`).
 */
export function normalizeWriteResult(raw: unknown, fallback: string): AoWriteResult {
  const d = payload(raw);
  const sent = serverMessage(raw);
  const message = sent && sent.toLowerCase() !== "success" ? sent : fallback;
  const candidates: unknown[] = [pick(d, "match"), d];
  const first = pick(d, "matches");
  if (Array.isArray(first) && first.length) candidates.push(first[0]);
  let match: AoMatch | null = null;
  for (const c of candidates) {
    match = normalizeMatch(c);
    if (match) break;
  }
  const machines = section(d, "machines");
  const devices = machines ? list(machines, "devices", normalizeMachineResult) : list(d, "devices", normalizeMachineResult);
  return { message, match, devices, machinesError: machines ? optStr(machines, "error") : null };
}
