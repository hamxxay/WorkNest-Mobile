import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
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
  /** When the user filled in Access Request; the verification lasts VERIFY_VALID_DAYS from then. */
  verifiedAt?: number;
  /** Saved on the server (the web shows "App verified"); older installs verified before this existed. */
  serverConfirmed?: boolean;
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
// Access Request is filled in once and lasts this long; after that the user verifies again.
export const VERIFY_VALID_DAYS = 30;
const VERIFY_VALID_MS = VERIFY_VALID_DAYS * 24 * 60 * 60 * 1000;

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
  verifiedAt: number = Date.now(),
  serverConfirmed: boolean = true,
) {
  const value: StoredDoorAccess = { details, result, selectedBookingDetailId, checkedAt: Date.now(), verifiedAt, serverConfirmed };
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
/** Tell every useDoorAccess on screen to re-check with the server now (e.g. after an unlock was refused). */
export const DOOR_ACCESS_CHANGED = "doorAccessChanged";
export function notifyDoorAccessChanged() {
  DeviceEventEmitter.emit(DOOR_ACCESS_CHANGED);
}

export async function getDoorAccess(accountEmail: string, forceRecheck = false): Promise<DoorAccess | null> {
  let stored: StoredDoorAccess | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey(accountEmail));
    stored = raw ? (JSON.parse(raw) as StoredDoorAccess) : null;
  } catch {
    return null;
  }
  if (!stored) return null;
  // The verification expires: after VERIFY_VALID_DAYS the user fills in Access Request again.
  const verifiedAt = stored.verifiedAt ?? stored.checkedAt;
  if (Date.now() - verifiedAt > VERIFY_VALID_MS) {
    await clearDoorAccess(accountEmail);
    return null;
  }
  const selected = stored.selectedBookingDetailId ?? null;
  // Verified before the server kept a record: save it once now so the web shows "App verified".
  if (!stored.serverConfirmed && selected != null) {
    try {
      await confirmDoorAccess(stored.details, selected);
      stored = { ...stored, serverConfirmed: true };
      await AsyncStorage.setItem(storageKey(accountEmail), JSON.stringify(stored));
    } catch {
      // Not saved (offline, or this login isn't the person's account): try again next time.
    }
  }
  if (!forceRecheck && Date.now() - stored.checkedAt < RECHECK_MS) return withSelection(stored.result, selected, stored.details);

  try {
    const result = await verifyDoorAccess(stored.details);
    if (!result.matched) {
      await clearDoorAccess(accountEmail);
      return null;
    }
    // If the chosen room was removed, withSelection falls back to another allowed room.
    await saveDoorAccess(accountEmail, stored.details, result, selected, verifiedAt, stored.serverConfirmed ?? false); // a re-check doesn't extend the 30 days
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

/** The room door this verified access user may unlock from the app (entrances use card / fingerprint / face). */
export async function getDoors(access: DoorAccess): Promise<DoorsResult> {
  if (!access.selectedSpace) throw new Error("Verify your access first.");
  const response = await apiRequest<any>(buildApiPath("mobile/access/doors"), {
    method: "POST",
    requiresAuth: true,
    body: { ...access.details, bookingDetailId: access.selectedSpace.bookingDetailId },
  });
  const result = unwrap<DoorsResult | null>(response);
  if (!result) throw new Error("Could not load your door. Please try again.");
  return result;
}

/** Unlocks one door now; resolves with the API's message ("Main Entrance 1 is unlocked."). */
export async function unlockDoor(access: DoorAccess, deviceId: number): Promise<string> {
  if (!access.selectedSpace) throw new Error("Verify your access first.");
  const response = await apiRequest<any>(buildApiPath("mobile/access/open"), {
    method: "POST",
    requiresAuth: true,
    body: { ...access.details, bookingDetailId: access.selectedSpace.bookingDetailId, deviceId },
  });
  const result = unwrap<{ ok: boolean; message: string } | null>(response);
  return result?.message || "Door unlocked.";
}

/** Access Request completed: the server records it (the web shows "App verified") for the next 30 days. */
export async function confirmDoorAccess(details: DoorAccessDetails, bookingDetailId: number): Promise<void> {
  const response = await apiRequest<any>(buildApiPath("mobile/access/confirm"), {
    method: "POST",
    requiresAuth: true,
    body: { ...details, bookingDetailId },
  });
  unwrap(response);
}

/** Home "Unlock Door": opens the room door straight away and resolves with the message to show. */
export async function unlockMyRoomDoor(access: DoorAccess): Promise<string> {
  const doors = await getDoors(access);
  const door = doors?.doors?.[0];
  if (!door) throw new Error(doors?.message || "No door machine is set up for your room yet.");
  return unlockDoor(access, door.deviceId);
}
