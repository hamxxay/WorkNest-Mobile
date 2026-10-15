import { isLocationBound, normalizeRoleName, type UserRole } from "../../context/roles";
import { phoneError } from "../../utils/phone";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPut, type ActionResult } from "./http";
import { idList, optNum, optStr, pick, str, unwrapEnvelope } from "./normalize";

// The signed-in staff member's own profile (GET / PUT auth/me, as the CMS profile page and AuthService do).
// locationIds are the locations an admin / sales executive works in (empty for super admins = all locations):
// the dashboard location picker uses them. The API enforces the scope itself; this is for display / defaults.

export type StaffProfile = {
  id: string | null;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  /** Primary location (null for super admins). */
  locationId: number | null;
  /** Every location the user may work in (primary first); empty = not location-bound. */
  locationIds: number[];
};

export function normalizeProfile(raw: any): StaffProfile {
  const ids = pick(raw, "locationIds");
  const locationId = optNum(raw, "locationId");
  const list = Array.isArray(ids) ? idList(ids.map(Number)) : [];
  return {
    id: optStr(raw, "id"),
    email: str(raw, "email"),
    name: str(raw, "name"),
    phone: optStr(raw, "phone"),
    role: str(raw, "role"),
    locationId,
    locationIds: list.length ? list : locationId && locationId > 0 ? [locationId] : [],
  };
}

/**
 * The "Locations" line of a staff profile. Super admins (and the CEO) are not tied to locations: "All locations",
 * even when the account still has a main location stored (WN_Users.LocationId). Location-bound staff: their
 * locations by name (from the API's location list), "Not assigned" when they have none.
 */
export function assignedLocationsLabel(
  role: UserRole | string | null | undefined,
  locationIds: readonly number[] | null | undefined,
  locations: readonly { id: number; name: string }[],
): string {
  const r = typeof role === "string" ? normalizeRoleName(role) ?? null : null;
  if (!isLocationBound(r)) return "All locations";
  const ids = locationIds ?? [];
  if (!ids.length) return "Not assigned";
  return ids.map((id) => locations.find((l) => l.id === id)?.name ?? `Location ${id}`).join(", ");
}

/** GET auth/me */
export async function getStaffProfile(): Promise<StaffProfile> {
  return normalizeProfile(unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.auth.me)));
}

/** PUT auth/me { name, phone } — only name and phone can change (role / location stay as they are). */
export async function updateStaffProfile(input: { name: string; phone?: string }): Promise<ActionResult<StaffProfile>> {
  const name = input.name?.trim() ?? "";
  if (!name) throw new Error("Name is required.");
  if (name.length > 200) throw new Error("Name must be 200 characters or fewer.");
  const phone = input.phone?.trim() || null;
  const invalid = phone ? phoneError(phone) : null;
  if (invalid) throw new Error(invalid);
  const raw = await staffPut(STAFF_ENDPOINTS.auth.me, { name, phone });
  const result = actionResult<any>(raw, "Profile updated.");
  return { message: result.message, data: normalizeProfile(result.data) };
}
