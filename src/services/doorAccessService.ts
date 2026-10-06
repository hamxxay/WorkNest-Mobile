import { Alert } from "react-native";
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

export type DoorAccess = DoorAccessResult & { selectedSpace: DoorAccessSpace | null };

/** Rooms the user may open: matched bookings with access allowed. */
export const allowedSpaces = (result: DoorAccessResult) => result.spaces.filter(sp => sp.isEnabled);

function withSelection(result: DoorAccessResult, selectedBookingDetailId: number | null): DoorAccess {
  const allowed = allowedSpaces(result);
  const selectedSpace = allowed.find(sp => sp.bookingDetailId === selectedBookingDetailId) ?? allowed[0] ?? null;
  return { ...result, selectedSpace };
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
  if (Date.now() - stored.checkedAt < RECHECK_MS) return withSelection(stored.result, selected);

  try {
    const result = await verifyDoorAccess(stored.details);
    if (!result.matched) {
      await clearDoorAccess(accountEmail);
      return null;
    }
    // If the chosen room was removed, withSelection falls back to another allowed room.
    await saveDoorAccess(accountEmail, stored.details, result, selected);
    return withSelection(result, selected);
  } catch {
    return withSelection(stored.result, selected);
  }
}

/** Placeholder until door unlocking through the access machines is built. */
export function openDoor(access?: DoorAccess | null) {
  const room = access?.selectedSpace?.spaceName ? ` for ${access.selectedSpace.spaceName}` : "";
  Alert.alert("Open Door", `Opening doors${room} from the app is coming soon. Use your card, fingerprint or face at the door for now.`);
}
