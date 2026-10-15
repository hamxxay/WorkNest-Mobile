import { ApiError, apiRequest } from "../apiClient";
import { optStr, toList, withQuery } from "../staff/normalize";
import { AO_NOT_FOUND_MESSAGE, apiMessageOf, isNotFound, toAccessOfficerError } from "./errors";
import { isEnrolResultShape, normalizeEnrolResult, normalizeLookup, normalizeWriteResult } from "./normalize";
import type { AoEnrolKind, AoEnrolResult, AoLookupOutcome, AoWriteResult } from "./types";
import { clampFinger } from "./format";

// Access Officer calls (role "access_officer"). Same transport as the staff, CEO and Sales Manager apps (apiClient:
// Bearer JWT, one silent token renewal on 401, readable ApiError messages), with the raw envelope kept so the
// normalisers can read it. A 503 means the server still needs the database update AO_01 and is turned into that
// message (./errors.ts). Enrolment waits for the person at the room machine, so it gets a long time limit.

/** API paths (relative to API_BASE_URL, which already ends in /api). */
export const ACCESS_OFFICER_ENDPOINTS = {
  lookup: "/access-officer/lookup",
  addToRoom: "/access-officer/add-to-room",
  enroll: (kind: AoEnrolKind) => `/access-officer/enroll/${kind}`,
  removeAccess: "/access-officer/remove-access",
  restoreAccess: "/access-officer/restore-access",
  /** The officer's own locations (AllowAnonymous; narrowed to the JWT's locations for a location-bound role). */
  locations: "/location/all",
} as const;

/**
 * How long an enrolment may take: the room machine waits for the face / finger (up to about 90 s on the server),
 * then the entrances get a copy. 120 s leaves room for both.
 */
export const AO_ENROL_TIMEOUT_MS = 120_000;

type Method = "GET" | "POST";

async function aoRequest(path: string, method: Method, body?: unknown, timeoutMs?: number): Promise<unknown> {
  try {
    return await apiRequest<unknown>(path, { method, body, requiresAuth: true, unwrapData: false, timeoutMs });
  } catch (error) {
    throw toAccessOfficerError(error);
  }
}

/**
 * GET api/access-officer/lookup?cnic= — the person and every room they are on (or waiting for) at the officer's
 * locations. Nobody found (404, or no matches) is an answer, not an error: { found: false, message } with the API's
 * message (the contract's wording when it sent none).
 */
export async function lookupByCnic(cnic: string): Promise<AoLookupOutcome> {
  const asked = (cnic ?? "").trim();
  if (!asked) throw new Error("Enter a CNIC or passport number.");
  let raw: unknown;
  try {
    raw = await aoRequest(withQuery(ACCESS_OFFICER_ENDPOINTS.lookup, { cnic: asked }), "GET");
  } catch (error) {
    if (isNotFound(error)) return { found: false, cnic: asked, message: apiMessageOf(error) ?? AO_NOT_FOUND_MESSAGE };
    throw error;
  }
  const lookup = normalizeLookup(raw, asked);
  if (!lookup.matches.length) return { found: false, cnic: lookup.cnic, message: AO_NOT_FOUND_MESSAGE };
  return { found: true, lookup };
}

const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function requireId(value: unknown, what: string): number {
  const id = positive(value);
  if (id == null) throw new Error(`The ${what} is missing. Pull down to refresh, then try again.`);
  return id;
}

/** POST api/access-officer/add-to-room { bookingDetailId, cnic } — a pending person goes on the room. 409 if already on it. */
export async function addToRoom(input: { bookingDetailId: number; cnic: string; room?: string }): Promise<AoWriteResult> {
  const bookingDetailId = requireId(input.bookingDetailId, "room");
  const cnic = (input.cnic ?? "").trim();
  if (!cnic) throw new Error("Enter a CNIC or passport number.");
  const raw = await aoRequest(ACCESS_OFFICER_ENDPOINTS.addToRoom, "POST", { bookingDetailId, cnic });
  return normalizeWriteResult(raw, input.room ? `Added to ${input.room}.` : "Added to the room.");
}

/** The enrolment result an error carries (a 400 / refused envelope with the per-machine results), or null. */
function enrolResultFromError(error: unknown, kind: AoEnrolKind): AoEnrolResult | null {
  if (!(error instanceof ApiError) || error.status === 503 || error.status === 0) return null;
  if (!isEnrolResultShape(error.details)) return null;
  const result = normalizeEnrolResult(error.details, kind);
  // An error answer is never a success, whatever the body says.
  return { ...result, ok: false, error: result.error ?? apiMessageOf(error) ?? error.message };
}

/**
 * POST api/access-officer/enroll/{face|fingerprint} { bookingDetailId, personId, fingerNo } — captures on the room
 * machine (the person must be standing there), then copies to every Entrance machine. Waits up to 120 s. A refused
 * enrolment that still reports per-machine results resolves with ok: false (so they can be shown); anything else
 * throws.
 */
export async function enrol(input: {
  kind: AoEnrolKind;
  bookingDetailId: number;
  personId: number;
  fingerNo?: number;
}): Promise<AoEnrolResult> {
  const kind: AoEnrolKind = input.kind === "fingerprint" ? "fingerprint" : "face";
  const bookingDetailId = requireId(input.bookingDetailId, "room");
  const personId = requireId(input.personId, "person");
  const body =
    kind === "fingerprint" ? { bookingDetailId, personId, fingerNo: clampFinger(input.fingerNo) } : { bookingDetailId, personId };
  try {
    const raw = await aoRequest(ACCESS_OFFICER_ENDPOINTS.enroll(kind), "POST", body, AO_ENROL_TIMEOUT_MS);
    return normalizeEnrolResult(raw, kind);
  } catch (error) {
    const result = enrolResultFromError(error, kind);
    if (result) return result;
    throw error;
  }
}

/**
 * POST api/access-officer/remove-access { bookingDetailId, personId } — door access off on the room and Entrance
 * machines (queued for offline ones); the person stays on the booking. Answers { match, machines }. 409 if already off.
 */
export async function removeAccess(input: { bookingDetailId: number; personId: number; room?: string }): Promise<AoWriteResult> {
  const bookingDetailId = requireId(input.bookingDetailId, "room");
  const personId = requireId(input.personId, "person");
  const raw = await aoRequest(ACCESS_OFFICER_ENDPOINTS.removeAccess, "POST", { bookingDetailId, personId });
  return normalizeWriteResult(raw, input.room ? `Door access to ${input.room} removed.` : "Door access removed.");
}

/** POST api/access-officer/restore-access { bookingDetailId, personId } — door access on again. Answers { match, machines }. */
export async function restoreAccess(input: { bookingDetailId: number; personId: number; room?: string }): Promise<AoWriteResult> {
  const bookingDetailId = requireId(input.bookingDetailId, "room");
  const personId = requireId(input.personId, "person");
  const raw = await aoRequest(ACCESS_OFFICER_ENDPOINTS.restoreAccess, "POST", { bookingDetailId, personId });
  return normalizeWriteResult(raw, input.room ? `Door access to ${input.room} restored.` : "Door access restored.");
}

/** Location names from GET api/location/all (an array, or an envelope / { items } / { data } around one), deduplicated. */
export function normalizeLocationNames(raw: unknown): string[] {
  const names: string[] = [];
  for (const row of toList<unknown>(raw, (r) => r)) {
    const name = row && typeof row === "object" ? optStr(row, "name", "locationName", "title") : null;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The officer's location names, for the header and the profile (GET api/location/all, which the API narrows to the
 * signed-in officer's locations). Best effort: [] when it cannot be loaded (the page works without it).
 */
export async function getMyLocationNames(): Promise<string[]> {
  try {
    const raw = await apiRequest<unknown>(ACCESS_OFFICER_ENDPOINTS.locations, { requiresAuth: true, unwrapData: false });
    return normalizeLocationNames(raw);
  } catch {
    return [];
  }
}
