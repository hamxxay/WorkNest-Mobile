import type { AoMatch, AoPerson } from "../types";

// Shared test data: a match as the normalisers produce it, overridable per test.

export const person = (over: Partial<AoPerson> = {}): AoPerson => ({
  personId: 12,
  name: "Sara Khan",
  email: "sara@example.com",
  phone: "0300 1234567",
  idType: "CNIC",
  idNumber: "12345-1234567-1",
  ...over,
});

export const match = (over: Partial<AoMatch> = {}): AoMatch => ({
  bookingDetailId: 101,
  bookingId: 55,
  // Every match carries its own person id (the API sends it; 0 / missing for a pending match becomes null).
  personId: 12,
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
  credentials: { face: false, fingerprint: false, card: false },
  roomMachine: { name: "Office 349", online: true },
  seats: { used: 3, total: 6 },
  ...over,
});
