import { formatCnicInput } from "../../utils/cnic";
import { formatDate, formatDateRange } from "../../utils/format";
import type { AoCredentials, AoEnrolKind, AoEnrolResult, AoIdMode, AoMachineResult, AoMatch, AoRoomMachine } from "./types";

// Words and input rules of the Access screen. Pure (unit-tested in __tests__/format.test.ts). No emojis: every
// label pairs with an Ionicons name.

// ─── The ID field ────────────────────────────────────────────────────────────────────────────────────────

/** Letters and digits a passport (or other) number may have: 5 to 30, as the API accepts (WN_Persons.IdNumber). */
export const PASSPORT_MIN_LENGTH = 5;
export const PASSPORT_MAX_LENGTH = 30;

const hasLetters = (text: string) => /[a-z]/i.test(text);

/**
 * A passport number as typed: upper case, letters / digits / dashes only (spaces and other signs dropped), at most
 * 30 letters and digits.
 */
export function formatPassportInput(text: string): string {
  let out = "";
  let count = 0;
  for (const ch of (text ?? "").toUpperCase()) {
    if (ch === "-") out += ch;
    else if (/[A-Z0-9]/.test(ch)) {
      if (count >= PASSPORT_MAX_LENGTH) break;
      out += ch;
      count += 1;
    }
  }
  return out;
}

/**
 * What the ID field shows while the officer types. CNIC mode: digits only, dashes inserted as 12345-1234567-1 (at
 * most 13 digits); text with letters in it (a pasted passport number) is kept as a passport number. Passport mode:
 * as typed (upper case, letters / digits / dashes).
 */
export function formatAoIdInput(text: string, mode: AoIdMode): string {
  const raw = text ?? "";
  if (mode === "passport" || hasLetters(raw)) return formatPassportInput(raw);
  return formatCnicInput(raw);
}

/** The field's text when the officer switches mode (a CNIC keeps its digits; a passport number keeps its text). */
export function switchAoIdMode(text: string, to: AoIdMode): string {
  return to === "cnic" ? formatCnicInput(hasLetters(text ?? "") ? "" : text) : formatPassportInput(text);
}

export type AoIdCheck = { ok: true; value: string; kind: AoIdMode } | { ok: false; error: string };

export const AO_ID_REQUIRED = "Enter a CNIC or passport number.";
export const AO_CNIC_INCOMPLETE = "A CNIC has 13 digits, e.g. 12345-1234567-1.";
export const AO_PASSPORT_INVALID = `Enter the passport number as printed (${PASSPORT_MIN_LENGTH} to ${PASSPORT_MAX_LENGTH} letters and digits).`;

/**
 * Checks the field before Find and returns the value to send: a CNIC as 12345-1234567-1, or a passport number in
 * upper case (the server compares letters and digits only, so dashes do not matter; it accepts 5 to 30 of them).
 */
export function checkAoId(text: string, mode: AoIdMode): AoIdCheck {
  const raw = (text ?? "").trim();
  if (!raw) return { ok: false, error: AO_ID_REQUIRED };
  if (mode === "cnic" && !hasLetters(raw)) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 13) return { ok: false, error: AO_CNIC_INCOMPLETE };
    return { ok: true, value: formatCnicInput(digits), kind: "cnic" };
  }
  const value = formatPassportInput(raw).replace(/^-+|-+$/g, "");
  const compact = value.replace(/-/g, "");
  if (compact.length < PASSPORT_MIN_LENGTH || compact.length > PASSPORT_MAX_LENGTH) {
    return { ok: false, error: AO_PASSPORT_INVALID };
  }
  return { ok: true, value, kind: "passport" };
}

// ─── Chips and lines on a match card ─────────────────────────────────────────────────────────────────────

export type AoChipTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export type AoChip = { label: string; icon: string; tone: AoChipTone };

/** Waiting for CNIC check / Has access / Access removed. */
export function matchStatusChip(match: Pick<AoMatch, "state" | "accessEnabled">): AoChip {
  if (match.state === "pending") return { label: "Waiting for CNIC check", icon: "time-outline", tone: "warning" };
  if (match.accessEnabled) return { label: "Has access", icon: "checkmark-circle-outline", tone: "success" };
  return { label: "Access removed", icon: "close-circle-outline", tone: "danger" };
}

/** What is enrolled (Face, Fingerprint, Card), in a fixed order; [] when nothing is. */
export function credentialChips(credentials: AoCredentials): AoChip[] {
  const chips: AoChip[] = [];
  if (credentials.face) chips.push({ label: "Face", icon: "scan-outline", tone: "primary" });
  if (credentials.fingerprint) chips.push({ label: "Fingerprint", icon: "finger-print-outline", tone: "primary" });
  if (credentials.card) chips.push({ label: "Card", icon: "card-outline", tone: "primary" });
  return chips;
}

/** Online / Offline / No machine (or Status unknown when the server did not say). */
export function machineStatusChip(machine: AoRoomMachine | null): AoChip {
  if (!machine) return { label: "No machine", icon: "remove-circle-outline", tone: "neutral" };
  if (machine.online === true) return { label: "Online", icon: "radio-outline", tone: "success" };
  if (machine.online === false) return { label: "Offline", icon: "cloud-offline-outline", tone: "danger" };
  return { label: "Status unknown", icon: "help-circle-outline", tone: "neutral" };
}

/** "1 Oct – 31 Dec 2026", "From 1 Oct 2026", "Until 31 Dec 2026" or null. */
export function bookingDatesText(match: Pick<AoMatch, "startOn" | "endOn">): string | null {
  const start = match.startOn ? formatDate(match.startOn, { fallback: "" }) : "";
  const end = match.endOn ? formatDate(match.endOn, { fallback: "" }) : "";
  if (start && end) return formatDateRange(match.startOn, match.endOn);
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

/** "3 of 6 seats used" or null. */
export function seatsText(match: Pick<AoMatch, "seats">): string | null {
  if (!match.seats) return null;
  return `${match.seats.used} of ${match.seats.total} seat${match.seats.total === 1 ? "" : "s"} used`;
}

/** The person's name for sentences ("Ask Sara Khan to..."), or "the person" when unknown. */
export function personWords(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n || "the person";
}

/** The room machine's name for sentences: its own name, else "<room> machine" wording. */
function machineWords(match: Pick<AoMatch, "room" | "roomMachine">): string {
  const name = match.roomMachine?.name?.trim();
  return name && name !== "Room machine" ? name : match.room;
}

// ─── Enrolment ───────────────────────────────────────────────────────────────────────────────────────────

/** Finger numbers the fingerprint enrolment offers (the machine's slots). */
export const FINGER_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** A finger number 1-10 (anything else becomes 1, the default). */
export function clampFinger(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

export const ENROL_TITLES: Record<AoEnrolKind, string> = { face: "Enrol face", fingerprint: "Enrol fingerprint" };

/**
 * What the officer tells the person while the room machine waits:
 * "Ask Sara Khan to stand at the Office 349 machine and look at the camera." /
 * "Ask Sara Khan to stand at the Office 349 machine and place finger 3 on the reader."
 */
export function enrolPrompt(kind: AoEnrolKind, name: string | null | undefined, match: Pick<AoMatch, "room" | "roomMachine">, fingerNo = 1): string {
  const who = personWords(name);
  const where = `the ${machineWords(match)} machine`;
  return kind === "face"
    ? `Ask ${who} to stand at ${where} and look at the camera.`
    : `Ask ${who} to stand at ${where} and place finger ${clampFinger(fingerNo)} on the reader.`;
}

/** Shown under the prompt while the request is open. */
export const ENROL_WAIT_NOTE = "The machine waits for them. This can take up to 2 minutes; keep this screen open.";

/** "Face enrolled for Sara Khan" / "Fingerprint (finger 3) enrolled for Sara Khan" / "...did not finish". */
export function enrolResultTitle(result: Pick<AoEnrolResult, "ok" | "kind">, name: string | null | undefined, fingerNo = 1): string {
  const what = result.kind === "face" ? "Face" : `Fingerprint (finger ${clampFinger(fingerNo)})`;
  return result.ok ? `${what} enrolled for ${personWords(name)}` : `${what} enrolment did not finish`;
}

/** The server's summary, else one built from the counts: "Saved on 3 of 3 machines · 1 offline (queued)". */
export function enrolSummary(result: AoEnrolResult): string | null {
  if (result.summary) return result.summary;
  if (!result.devices.length) return null;
  const saved = result.devices.filter((d) => d.ok && !d.queued).length;
  const online = result.devices.filter((d) => !d.queued).length;
  const parts = [`Saved on ${saved} of ${online} machine${online === 1 ? "" : "s"}`];
  if (result.queuedCount > 0) parts.push(`${result.queuedCount} offline (queued)`);
  return parts.join(" · ");
}

export type AoMachineLine = {
  device: string;
  /** "Room machine" (captured there) or "Entrance" (copied there). */
  role: "Room machine" | "Entrance";
  status: string;
  icon: string;
  tone: AoChipTone;
};

const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** What a machine that took the change says: the room machine's word and the entrances' word. */
export type AoMachineVerbs = { room: string; entrance: string };

/** An enrolment: captured on the room machine, copied to the entrances. */
export const ENROL_VERBS: AoMachineVerbs = { room: "Captured and saved", entrance: "Copied" };

/** Remove access (blocked) / restore access (unblocked) on the machines. */
export const accessVerbs = (enable: boolean): AoMachineVerbs =>
  enable ? { room: "Access restored", entrance: "Access restored" } : { room: "Access removed", entrance: "Access removed" };

/**
 * Per-machine lines: the room machine (where the face / finger was captured) and the entrances (where it was copied,
 * or queued while offline). The room machine is the one named like the match's room machine; without a name match,
 * the first machine in the list (the server captures there first). `verbs` words a machine that took the change.
 */
export function machineLines(devices: AoMachineResult[], roomMachineName?: string | null, verbs: AoMachineVerbs = ENROL_VERBS): AoMachineLine[] {
  const roomIndex = Math.max(
    0,
    devices.findIndex((d) => sameName(d.device, roomMachineName)),
  );
  return devices.map((d, i) => {
    const room = i === roomIndex;
    const role = room ? "Room machine" : "Entrance";
    if (d.queued) {
      return { device: d.device, role, status: "Offline: queued, applies when it reconnects", icon: "time-outline", tone: "warning" };
    }
    if (!d.ok) {
      return { device: d.device, role, status: d.error ? `Failed: ${d.error}` : "Failed", icon: "alert-circle-outline", tone: "danger" };
    }
    if (d.verified === false) {
      return { device: d.device, role, status: "Saved, but not found when checked", icon: "warning-outline", tone: "warning" };
    }
    return {
      device: d.device,
      role,
      status: room ? verbs.room : verbs.entrance,
      icon: "checkmark-circle-outline",
      tone: "success",
    };
  });
}

/** A result shown on a match card after Add to room / Remove access / Restore access. */
export type AoCardNotice = {
  tone: "success" | "warning" | "danger";
  message: string;
  /** Per-machine lines, only when a machine was offline or failed (all fine: none, to keep the card short). */
  lines: AoMachineLine[];
};

/**
 * The card notice after a write: the server's message (plus the queued / failed machines' note), success when every
 * machine took the change, a warning when one was offline or failed, or the machines could not be reached at all.
 * `enable` words the machine lines (null for Add to room, which changes no machine).
 */
export function writeNotice(
  result: { message: string; devices: AoMachineResult[]; machinesError: string | null },
  roomMachineName: string | null | undefined,
  enable: boolean | null,
): AoCardNotice {
  const failed = result.devices.some((d) => !d.ok && !d.queued);
  const queued = result.devices.some((d) => d.queued);
  const trouble = failed || queued || !!result.machinesError;
  const extra = [result.machinesError, queued && !failed ? queuedNote(result.devices) : null].filter(Boolean);
  const message = [result.message, ...extra.filter((t) => !result.message.includes(String(t)))].join(" ");
  return {
    tone: trouble ? "warning" : "success",
    message,
    lines: trouble && enable !== null ? machineLines(result.devices, roomMachineName, accessVerbs(enable)) : [],
  };
}

/** One line about machines that were offline during a remove / restore ("2 machines were offline: ..."), or null. */
export function queuedNote(devices: AoMachineResult[]): string | null {
  const queued = devices.filter((d) => d.queued).length;
  if (!queued) return null;
  return queued === 1
    ? "1 machine was offline: the change is queued and applies when it reconnects."
    : `${queued} machines were offline: the change is queued and applies when they reconnect.`;
}
