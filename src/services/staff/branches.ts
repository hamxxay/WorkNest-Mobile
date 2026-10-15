import { isLocationBound, type UserRole } from "../../context/roles";
import { idList } from "./normalize";

// Branch routing: tour inquiries and complaints go to the staff of their branch (WN_Locations). The API scopes the
// lists: location-bound staff (admins, sales executives) get the items of their locations plus every item with no
// branch; super admins get everything. Inquiries carry locationId / locationName; complaints carry the branch name
// (WN_Complaints.Branch) and, when the API can resolve it, a locationId. These pure helpers decide what the
// screens show and offer; the API enforces the same rules itself.

/** Shown (muted) for an item that has no branch yet. */
export const NO_BRANCH_LABEL = "No branch";

export type BranchLocation = { id: number; name: string; isActive: boolean };

/** A positive whole id, or null (missing, blank, 0, negative or not a number). */
export function toBranchId(value: unknown): number | null {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && value.trim() === "")) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const nameKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

/** The location whose name matches a branch name (trimmed, case-insensitive, as the API matches it); null if none. */
export function locationIdByName(locations: readonly BranchLocation[], name: string | null | undefined): number | null {
  const key = nameKey(name);
  if (!key) return null;
  return locations.find((l) => nameKey(l.name) === key)?.id ?? null;
}

/** The location an item belongs to: its own locationId, else the location its branch name matches; null = no branch. */
export function resolveBranchId(
  item: { locationId?: number | null; branch?: string | null },
  locations: readonly BranchLocation[],
): number | null {
  return toBranchId(item.locationId) ?? locationIdByName(locations, item.branch);
}

/**
 * The branch name to show for an item: its own name, else the name of its location id, else "Location {id}";
 * null when the item has no branch (the screen shows "No branch").
 */
export function branchDisplayName(
  item: { locationId?: number | null; name?: string | null },
  locations: readonly BranchLocation[],
): string | null {
  const name = item.name?.trim();
  if (name) return name;
  const id = toBranchId(item.locationId);
  if (id == null) return null;
  return locations.find((l) => l.id === id)?.name || `Location ${id}`;
}

export type BranchChoice<L extends BranchLocation = BranchLocation> = {
  /** Branches the user may choose (A-Z as given). */
  options: L[];
  /** Set when the branch is fixed: a location-bound user with exactly one location. */
  fixed: L | null;
};

/**
 * Which branches a form offers (the CMS rule): a location-bound user (admin, sales executive) with one location
 * gets it fixed; with several, only theirs; anyone else (super admin) every active location. `assignedIds` are
 * the user's locations from their profile; while those are unknown the API-scoped location list is used.
 */
export function branchChoice<L extends BranchLocation>(
  role: UserRole | null | undefined,
  assignedIds: readonly number[] | null | undefined,
  locations: readonly L[],
): BranchChoice<L> {
  if (isLocationBound(role)) {
    const ids = idList(assignedIds ?? []);
    const own = ids.length ? locations.filter((l) => ids.includes(l.id)) : [...locations];
    return { options: own, fixed: own.length === 1 ? own[0] : null };
  }
  return { options: locations.filter((l) => l.isActive), fixed: null };
}

/** The branch a form sends: the fixed one, else the picked one while it is still offered; null = none chosen. */
export function chosenBranchId(choice: BranchChoice, picked: number | null | undefined): number | null {
  if (choice.fixed) return choice.fixed.id;
  const id = toBranchId(picked);
  return id != null && choice.options.some((o) => o.id === id) ? id : null;
}

/** True when the user can move an item to a branch other than its current one. */
export function canMoveBranch(currentId: number | null | undefined, options: readonly BranchLocation[]): boolean {
  const current = toBranchId(currentId);
  return options.some((o) => o.id !== current);
}

/**
 * Location filter chips of the Inquiries / Complaints lists: only when the user sees more than one location.
 * Value 0 = every location the user may see (no ?locationId=).
 */
export function branchFilterOptions(
  role: UserRole | null | undefined,
  locations: readonly BranchLocation[],
): { label: string; value: number }[] {
  if (locations.length < 2) return [];
  return [
    { label: isLocationBound(role) ? "All my locations" : "All locations", value: 0 },
    ...locations.map((l) => ({ label: l.name, value: l.id })),
  ];
}

/**
 * What saving the complaint sheet sends: the branch move (only when a different branch was picked) and the
 * status update (when status or notes changed, or when nothing else is sent, as before).
 */
export function complaintSavePlan(input: {
  currentBranchId: number | null;
  pickedBranchId: number | null;
  statusChanged: boolean;
}): { moveTo: number | null; updateStatus: boolean } {
  const picked = toBranchId(input.pickedBranchId);
  const moveTo = picked != null && picked !== toBranchId(input.currentBranchId) ? picked : null;
  return { moveTo, updateStatus: input.statusChanged || moveTo == null };
}
