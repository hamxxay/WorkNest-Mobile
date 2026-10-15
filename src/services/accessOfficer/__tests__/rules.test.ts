// Which buttons a match card shows: pending / assigned + on / assigned + off / machine offline or missing; and that
// every action takes the MATCH's own person id (one CNIC can be on several rooms).

import { match, person } from "../__fixtures__";
import {
  AO_NO_PERSON_REASON,
  actionsNote,
  createActionLock,
  enrolBlockedReason,
  matchActions,
  personIdFor,
  removeAccessQuestion,
  withUpdatedMatch,
  type AoAction,
} from "../rules";

const kinds = (actions: AoAction[]) => actions.map((a) => a.kind);
const enabled = (actions: AoAction[]) => actions.filter((a) => !a.disabledReason).map((a) => a.kind);

describe("matchActions", () => {
  it("pending: Add to room only (primary), whatever the machine, access flag or person id", () => {
    for (const m of [
      match({ state: "pending", personId: null }),
      match({ state: "pending", roomMachine: null }),
      match({ state: "pending", roomMachine: { name: "Office 349", online: false } }),
      match({ state: "pending", accessEnabled: false }),
    ]) {
      const actions = matchActions(m);
      expect(kinds(actions)).toEqual(["addToRoom"]);
      expect(actions[0]).toMatchObject({ label: "Add to room", variant: "primary", disabledReason: null });
    }
  });

  it("assigned + access on + machine online: Enrol face, Enrol fingerprint, Remove access, all enabled", () => {
    const actions = matchActions(match());
    expect(kinds(actions)).toEqual(["enrolFace", "enrolFingerprint", "removeAccess"]);
    expect(enabled(actions)).toEqual(["enrolFace", "enrolFingerprint", "removeAccess"]);
    expect(actions.map((a) => a.label)).toEqual(["Enrol face", "Enrol fingerprint", "Remove access"]);
    expect(actions.map((a) => a.variant)).toEqual(["primary", "secondary", "danger"]);
    expect(actionsNote(actions)).toBeNull();
  });

  it("assigned + access on + machine status unknown: enrolment allowed (the server decides)", () => {
    const actions = matchActions(match({ roomMachine: { name: "Office 349", online: null } }));
    expect(enabled(actions)).toEqual(["enrolFace", "enrolFingerprint", "removeAccess"]);
  });

  it("assigned + access on + machine offline: enrolment off with the reason; Remove access still works", () => {
    const actions = matchActions(match({ roomMachine: { name: "Office 349", online: false } }));
    expect(kinds(actions)).toEqual(["enrolFace", "enrolFingerprint", "removeAccess"]);
    expect(enabled(actions)).toEqual(["removeAccess"]);
    expect(actionsNote(actions)).toBe("The Office 349 machine is offline. Enrolment needs it online: try again when it is back.");
  });

  it("assigned + access on + no machine for the room: enrolment off with the reason", () => {
    const actions = matchActions(match({ roomMachine: null }));
    expect(enabled(actions)).toEqual(["removeAccess"]);
    expect(actionsNote(actions)).toMatch(/^Office 349 has no door machine set up/);
  });

  it("assigned + access removed: Restore access only", () => {
    const actions = matchActions(match({ accessEnabled: false }));
    expect(kinds(actions)).toEqual(["restoreAccess"]);
    expect(actions[0]).toMatchObject({ label: "Restore access", variant: "primary", disabledReason: null });
    // The machine does not matter for restoring (offline machines get it from the queue).
    expect(enabled(matchActions(match({ accessEnabled: false, roomMachine: null })))).toEqual(["restoreAccess"]);
    expect(enabled(matchActions(match({ accessEnabled: false, roomMachine: { name: "X", online: false } })))).toEqual(["restoreAccess"]);
  });

  it("assigned without its own person id: the buttons are off and say to refresh", () => {
    const on = matchActions(match({ personId: null }));
    expect(kinds(on)).toEqual(["enrolFace", "enrolFingerprint", "removeAccess"]);
    expect(enabled(on)).toEqual([]);
    expect(actionsNote(on)).toBe(AO_NO_PERSON_REASON);
    const off = matchActions(match({ personId: null, accessEnabled: false }));
    expect(enabled(off)).toEqual([]);
    expect(actionsNote(off)).toBe(AO_NO_PERSON_REASON);
  });
});

describe("helpers", () => {
  it("personIdFor: the match's own id only (never the looked-up person's)", () => {
    expect(personIdFor(match({ personId: 9 }))).toBe(9);
    expect(personIdFor(match({ personId: null }))).toBeNull();
    expect(personIdFor({ personId: undefined as unknown as null })).toBeNull();
  });

  it("enrolBlockedReason", () => {
    expect(enrolBlockedReason(match())).toBeNull();
    expect(enrolBlockedReason(match({ roomMachine: { name: "X", online: null } }))).toBeNull();
    expect(enrolBlockedReason(match({ roomMachine: { name: "X", online: false } }))).toMatch(/offline/);
    expect(enrolBlockedReason(match({ roomMachine: null }))).toMatch(/no door machine/);
  });

  it("the Remove access question names the person, the room and the customer", () => {
    expect(removeAccessQuestion("Sara Khan", match())).toBe(
      "Remove Sara Khan's door access to Office 349 and the entrances? They stay on SAC@WN's booking.",
    );
    expect(removeAccessQuestion("", match({ customer: null }))).toBe(
      "Remove this person's door access to Office 349 and the entrances? They stay on the customer's booking.",
    );
  });
});

describe("withUpdatedMatch (after a write)", () => {
  const lookup = () => ({
    cnic: "12345-1234567-1",
    person: person({ personId: null }),
    matches: [match({ bookingDetailId: 101, state: "pending", personId: null }), match({ bookingDetailId: 102, room: "Desk 12", personId: 30 })],
  });

  it("replaces the room's match with the server's copy (add to room) and fills in the person's id", () => {
    const next = withUpdatedMatch(lookup(), 101, match({ bookingDetailId: 101, state: "assigned", personId: 12 }));
    expect(next.matches[0]).toMatchObject({ bookingDetailId: 101, state: "assigned", personId: 12 });
    expect(next.matches[1]).toMatchObject({ room: "Desk 12", personId: 30 });
    expect(next.person?.personId).toBe(12);
  });

  it("patches one field (Remove access) and keeps the rest", () => {
    const next = withUpdatedMatch(lookup(), 102, { accessEnabled: false });
    expect(next.matches[1]).toMatchObject({ bookingDetailId: 102, accessEnabled: false, room: "Desk 12", state: "assigned", personId: 30 });
    expect(next.matches[0].state).toBe("pending");
    expect(next.person?.personId).toBeNull();
  });

  it("an unknown room or no update changes nothing", () => {
    const l = lookup();
    expect(withUpdatedMatch(l, 999, { accessEnabled: false })).toBe(l);
    expect(withUpdatedMatch(l, 101, null)).toBe(l);
  });

  it("never loses a known person id or the room id", () => {
    const l = { ...lookup(), person: person({ personId: 12 }) };
    const next = withUpdatedMatch(l, 102, { personId: null, bookingDetailId: 5 } as never);
    expect(next.matches[1]).toMatchObject({ bookingDetailId: 102, personId: 30 });
    expect(next.person?.personId).toBe(12);
  });
});

describe("createActionLock (one write or enrolment at a time)", () => {
  it("a second take while held is refused at once; release frees it", () => {
    const lock = createActionLock();
    expect(lock.held).toBe(false);
    expect(lock.take()).toBe(true);
    // The fast second tap, before any re-render.
    expect(lock.take()).toBe(false);
    expect(lock.held).toBe(true);
    lock.release();
    expect(lock.held).toBe(false);
    expect(lock.take()).toBe(true);
  });

  it("each screen has its own lock", () => {
    const a = createActionLock();
    const b = createActionLock();
    expect(a.take()).toBe(true);
    expect(b.take()).toBe(true);
  });
});
