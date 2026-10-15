import type { AoLookup, AoMatch } from "./types";

// Which buttons a match card shows, and why one is off. Pure (unit-tested in __tests__/rules.test.ts); the server
// checks every rule again, these only keep the officer from pressing something that cannot work.
//
//   pending                     -> Add to room
//   assigned, access on         -> Enrol face, Enrol fingerprint, Remove access
//                                  (enrolment off, with the reason, when the room machine is offline or missing:
//                                  the capture happens on that machine. Remove access still works: offline
//                                  machines get it from the queue when they reconnect.)
//   assigned, access removed    -> Restore access
//   assigned without a person id (an answer the app cannot act on yet) -> the same buttons, off, "pull to refresh".
//
// The person id is always the MATCH's own (one CNIC can be on several rooms, each with its own person record), never
// the looked-up person's.

export type AoActionKind = "addToRoom" | "enrolFace" | "enrolFingerprint" | "removeAccess" | "restoreAccess";

export type AoAction = {
  kind: AoActionKind;
  label: string;
  /** Ionicons name. */
  icon: string;
  variant: "primary" | "secondary" | "danger";
  /** Why the button is off; null when it can be pressed. */
  disabledReason: string | null;
};

export const AO_ACTION_LABELS: Record<AoActionKind, string> = {
  addToRoom: "Add to room",
  enrolFace: "Enrol face",
  enrolFingerprint: "Enrol fingerprint",
  removeAccess: "Remove access",
  restoreAccess: "Restore access",
};

const ICONS: Record<AoActionKind, string> = {
  addToRoom: "person-add-outline",
  enrolFace: "scan-outline",
  enrolFingerprint: "finger-print-outline",
  removeAccess: "lock-closed-outline",
  restoreAccess: "lock-open-outline",
};

export const AO_NO_PERSON_REASON = "This person's record has not loaded yet. Pull down to refresh, then try again.";

/** The person id an action on this match uses: the match's own (null for a pending match, or when it is missing). */
export function personIdFor(match: Pick<AoMatch, "personId">): number | null {
  return match.personId ?? null;
}

/** Why face / fingerprint enrolment cannot start on this room right now, or null when it can. */
export function enrolBlockedReason(match: Pick<AoMatch, "room" | "roomMachine">): string | null {
  if (!match.roomMachine) {
    return `${match.room} has no door machine set up, so nothing can be captured. Ask an admin to add the room's machine.`;
  }
  if (match.roomMachine.online === false) {
    return `The ${match.room} machine is offline. Enrolment needs it online: try again when it is back.`;
  }
  return null;
}

const action = (kind: AoActionKind, variant: AoAction["variant"], disabledReason: string | null = null): AoAction => ({
  kind,
  label: AO_ACTION_LABELS[kind],
  icon: ICONS[kind],
  variant,
  disabledReason,
});

/** The buttons for one match card, in the order shown. */
export function matchActions(match: AoMatch): AoAction[] {
  if (match.state === "pending") return [action("addToRoom", "primary")];

  const noPerson = personIdFor(match) == null ? AO_NO_PERSON_REASON : null;
  if (!match.accessEnabled) return [action("restoreAccess", "primary", noPerson)];

  const enrolReason = noPerson ?? enrolBlockedReason(match);
  return [
    action("enrolFace", "primary", enrolReason),
    action("enrolFingerprint", "secondary", enrolReason),
    action("removeAccess", "danger", noPerson),
  ];
}

/** The reason shown under a card's buttons: the first one any button gives (they share it), or null. */
export function actionsNote(actions: AoAction[]): string | null {
  return actions.find((a) => a.disabledReason)?.disabledReason ?? null;
}

/** The Remove access question: "Remove Sara Khan's door access to Office 349 and the entrances? ...". */
export function removeAccessQuestion(name: string | null | undefined, match: Pick<AoMatch, "room" | "customer">): string {
  const who = (name ?? "").trim();
  const owner = match.customer?.trim();
  return (
    `Remove ${who ? `${who}'s` : "this person's"} door access to ${match.room} and the entrances? ` +
    `They stay on ${owner ? `${owner}'s` : "the customer's"} booking.`
  );
}

/**
 * The lookup after a write on one room: that match replaced by the server's updated copy, or patched (e.g.
 * { accessEnabled: false } after Remove access); the person's id filled in when the match brought one (after Add to
 * room). Other matches are left alone; an unknown bookingDetailId changes nothing.
 */
export function withUpdatedMatch(lookup: AoLookup, bookingDetailId: number, update: Partial<AoMatch> | null | undefined): AoLookup {
  if (!update || !lookup.matches.some((m) => m.bookingDetailId === bookingDetailId)) return lookup;
  const matches = lookup.matches.map((m) =>
    m.bookingDetailId === bookingDetailId ? { ...m, ...update, bookingDetailId, personId: update.personId ?? m.personId } : m,
  );
  const newId = update.personId ?? null;
  const person = lookup.person && lookup.person.personId == null && newId != null ? { ...lookup.person, personId: newId } : lookup.person;
  return { ...lookup, person, matches };
}
