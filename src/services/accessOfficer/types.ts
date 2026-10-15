// Types of the Access Officer API (role "access_officer", WN_Roles.Id 19), from the shared contract:
//
//   GET  api/access-officer/lookup?cnic=...                   the person + one match per room they are on / waiting for
//   POST api/access-officer/add-to-room      { bookingDetailId, cnic }                 pending -> on the room
//   POST api/access-officer/enroll/{face|fingerprint} { bookingDetailId, personId, fingerNo }   per-machine results
//   POST api/access-officer/remove-access    { bookingDetailId, personId }             door access off (stays on booking)
//   POST api/access-officer/restore-access   { bookingDetailId, personId }             door access on again
//
// Answers: add-to-room -> the updated match; enroll -> HikEnrollResultDto (400 with it when the enrolment failed);
// remove / restore -> { match, machines } (machines = HikAccessSyncResultDto). 409 when the state does not allow it
// (already on the room, still pending, access already on / off). Every match carries its own personId: the enrol /
// remove / restore calls take that one (one CNIC can be on several rooms).
//
// Every answer is the usual envelope { isSuccessful, message, data } in camelCase. A 503 means the server still needs
// the database update AO_01. Only people already on a CONFIRMED / active booking at the officer's locations can be
// found ("pending": added by the customer, not yet checked; "assigned": on the room). There is no manual add.

/** The person found for a CNIC / passport number (null on a lookup when only pending requests exist). */
export type AoPerson = {
  /** WN_Persons id; null until the person is on a room (it comes back from add-to-room). */
  personId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** "CNIC", "Passport"... as the API sends it; null when not sent. */
  idType: string | null;
  /** The CNIC / passport number as stored ("12345-1234567-1"); null when not sent. */
  idNumber: string | null;
};

/** pending: the customer added this CNIC, not yet checked by staff. assigned: on the room (WN_BookingAttendants). */
export type AoMatchState = "pending" | "assigned";

/** What is enrolled for the person on the machines (best effort: the server's view). */
export type AoCredentials = { face: boolean; fingerprint: boolean; card: boolean };

/** The booked room's door machine. */
export type AoRoomMachine = {
  name: string;
  /** true online, false offline, null when the server did not say. */
  online: boolean | null;
};

export type AoSeats = { used: number; total: number };

/** One room the person is on (or waiting for), with its own actions. */
export type AoMatch = {
  /** The booked space (WN_BookingDetails.Id): every action is for this room. */
  bookingDetailId: number;
  bookingId: number | null;
  /** The person on this room (the id the enrol / remove / restore calls take); null for a pending match. */
  personId: number | null;
  /** Room name / number, e.g. "Office 349". */
  room: string;
  spaceCode: string | null;
  location: string | null;
  locationId: number | null;
  /** The booking owner (customer / company name). */
  customer: string | null;
  bookingStatus: string | null;
  /** yyyy-MM-dd (or a date-time), as sent. */
  startOn: string | null;
  endOn: string | null;
  state: AoMatchState;
  /** Assigned: the person's door access is on (false after Remove access). */
  accessEnabled: boolean;
  credentials: AoCredentials;
  /** null: no machine was found for this room. */
  roomMachine: AoRoomMachine | null;
  /** Seats used / total on the booking, when sent. */
  seats: AoSeats | null;
};

/** GET api/access-officer/lookup answer. */
export type AoLookup = {
  /** The CNIC / passport number the server matched (as it formats it), or what was asked for. */
  cnic: string;
  person: AoPerson | null;
  matches: AoMatch[];
};

/** A lookup either finds the person on at least one room, or says why not (404, or no matches). */
export type AoLookupOutcome =
  | { found: true; lookup: AoLookup }
  | { found: false; cnic: string; message: string };

export type AoEnrolKind = "face" | "fingerprint";

/** One machine's part in an enrolment or an access change (HikEnrollDeviceResultDto). */
export type AoMachineResult = {
  deviceId: number | null;
  /** Machine name, e.g. "Office 349" or "Entrance 1". */
  device: string;
  ok: boolean;
  /** The machine was offline: the change waits in the queue and applies when it reconnects. */
  queued: boolean;
  error: string | null;
  /** Read back after saving: true found there, false missing, null not checked. */
  verified: boolean | null;
};

/** POST api/access-officer/enroll/{kind} answer (HikEnrollResultDto). */
export type AoEnrolResult = {
  ok: boolean;
  kind: AoEnrolKind;
  /** The server's error when the enrolment did not finish (e.g. "No finger was placed in time."). */
  error: string | null;
  /** The server's one-line summary, e.g. "Saved on 3 of 3 machines". */
  summary: string | null;
  /** The person's number on the machines (WN_HIK_PersonMap.MachineID). */
  machineId: string | null;
  quality: string | null;
  devices: AoMachineResult[];
  verifiedCount: number;
  targetCount: number;
  queuedCount: number;
};

/** Answer of add-to-room / remove-access / restore-access. */
export type AoWriteResult = {
  /** Readable outcome (the server's message, or ours). */
  message: string;
  /** The updated match, when the server sent one. */
  match: AoMatch | null;
  /** Per-machine results, when the server sent them (remove / restore: blocked, unblocked or queued). */
  devices: AoMachineResult[];
  /** The machines could not be updated at all (remove / restore: `machines.error`), or null. */
  machinesError: string | null;
};

/** How the officer is typing the ID: a CNIC (number pad, 12345-1234567-1 mask) or a passport number (as typed). */
export type AoIdMode = "cnic" | "passport";
