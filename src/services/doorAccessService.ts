import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiPath } from "../config/api";
import { apiRequest } from "./apiClient";

export type DoorAccessDetails = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
};

export type DoorAccessSpace = {
  bookingDetailId: number;
  spaceName: string;
  isEnabled: boolean;
};

export type DoorAccessResult = {
  matched: boolean;
  canOpenDoor: boolean;
  message: string;
  personGuid?: string | null;
  name?: string | null;
  spaces: DoorAccessSpace[];
};

type StoredDoorAccess = {
  details: DoorAccessDetails;
  result: DoorAccessResult;
  /** Room the user picked (BookingDetailId); the door Open Door will unlock. */
  selectedBookingDetailId: number | null;
  checkedAt: number;
};

export type DoorAccess = DoorAccessResult & {
  selectedSpace: DoorAccessSpace | null;
  /** The verified details, sent again when listing / unlocking doors (the API re-checks them). */
  details: DoorAccessDetails;
};

export type DoorInfo = {
  deviceId: number;
  name: string;
  /** "room" = the booked office's door, "entrance" = building / floor entrance. */
  kind: "room" | "entrance";
  online: boolean;
};

export type DoorsResult = { ok: boolean; message: string; spaceName?: string | null; doors: DoorInfo[] };

/** Rooms the user may open: matched bookings with access allowed. */
export const allowedSpaces = (result: DoorAccessResult) => result.spaces.filter(sp => sp.isEnabled);

function withSelection(result: DoorAccessResult, selectedBookingDetailId: number | null, details: DoorAccessDetails): DoorAccess {
  const allowed = allowedSpaces(result);
  const selectedSpace = allowed.find(sp => sp.bookingDetailId === selectedBookingDetailId) ?? allowed[0] ?? null;
  return { ...result, selectedSpace, details };
}

// Re-check with the API at most this often; the verify endpoint shares the login rate limit.
const RECHECK_MS = 10 * 60 * 1000;

const storageKey = (accountEmail: string) => `door_access:${accountEmail.trim().toLowerCase()}`;

/** Matches the entered details against the access users added to bookings in Sales. */
export function verifyDoorAccess(details: DoorAccessDetails): Promise<DoorAccessResult> {
  return apiRequest<DoorAccessResult>(buildApiPath("mobile/access/verify"), {
    method: "POST",
    requiresAuth: true,
    body: details,
  });
}

export async function saveDoorAccess(
  accountEmail: string,
  details: DoorAccessDetails,
  result: DoorAccessResult,
  selectedBookingDetailId: number | null,
) {
  const value: StoredDoorAccess = { details, result, selectedBookingDetailId, checkedAt: Date.now() };
  try {
    await AsyncStorage.setItem(storageKey(accountEmail), JSON.stringify(value));
  } catch {}
}

export async function clearDoorAccess(accountEmail: string) {
  try {
    await AsyncStorage.removeItem(storageKey(accountEmail));
  } catch {}
}

/**
 * Stored access for this account, re-verified when stale so removed or blocked users lose Open Door.
 * Keeps the last known result if the API can't be reached.
 */
export async function getDoorAccess(accountEmail: string): Promise<DoorAccess | null> {
  let stored: StoredDoorAccess | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey(accountEmail));
    stored = raw ? (JSON.parse(raw) as StoredDoorAccess) : null;
  } catch {
    return null;
  }
  if (!stored) return null;
  const selected = stored.selectedBookingDetailId ?? null;
  if (Date.now() - stored.checkedAt < RECHECK_MS) return withSelection(stored.result, selected, stored.details);

  try {
    const result = await verifyDoorAccess(stored.details);
    if (!result.matched) {
      await clearDoorAccess(accountEmail);
      return null;
    }
    // If the chosen room was removed, withSelection falls back to another allowed room.
    await saveDoorAccess(accountEmail, stored.details, result, selected);
    return withSelection(result, selected, stored.details);
  } catch {
    return withSelection(stored.result, selected, stored.details);
  }
}

/** API answers { isSuccessful: false, message } when it refuses: turn that into an error with the message. */
function unwrap<T>(response: any): T {
  if (response && typeof response === "object" && response.isSuccessful === false) {
    throw new Error(response.message || "Please try again.");
  }
  return response as T;
}

/** Doors this verified access user may unlock for the selected room (room door first, then entrances). */
export async function getDoors(access: DoorAccess): Promise<DoorsResult> {
  if (!access.selectedSpace) throw new Error("Verify your access first.");
  const response = await apiRequest<any>(buildApiPath("mobile/access/doors"), {
    method: "POST",
    requiresAuth: true,
    body: { ...access.details, bookingDetailId: access.selectedSpace.bookingDetailId },
  });
  return unwrap<DoorsResult>(response);
}

/** Unlocks one door now; resolves with the API's message ("Main Entrance 1 is unlocked."). */
export async function unlockDoor(access: DoorAccess, deviceId: number): Promise<string> {
  if (!access.selectedSpace) throw new Error("Verify your access first.");
  const response = await apiRequest<any>(buildApiPath("mobile/access/open"), {
    method: "POST",
    requiresAuth: true,
    body: { ...access.details, bookingDetailId: access.selectedSpace.bookingDetailId, deviceId },
  });
  const result = unwrap<{ ok: boolean; message: string }>(response);
  return result?.message || "Door unlocked.";
}
