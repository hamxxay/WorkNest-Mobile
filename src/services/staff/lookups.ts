import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, num, optNum, optStr, pick, str, toList, toPage, unwrapEnvelope, withQuery, type Page } from "./normalize";

// Lookups for the staff forms and the read-only Locations / Spaces screens, loaded the way the CMS quotation and
// booking forms load them (manage.ts openAdminQuotationForm): GET location, floor?locationId, spacetype, space
// (limit 1000), filtered on the device. The API has no "spaces of this location and type" endpoint, and
// api/location / api/space filter admins / sales executives to their locations AFTER paging (so `total` is not
// the global count): load one big page, as the CMS does.
// Roles: location / spacetype / space / space-config: any signed-in user; floor: staff.

export { getCities, type City } from "./customers";
export { getOfferingTypes, offeringTypesForLocation, type OfferingType } from "./quotations";

const BIG_PAGE = 1000;

// ─── Locations ────────────────────────────────────────────────────────────────────────────────────────────

export type StaffLocation = {
  id: number;
  idGuid: string | null;
  name: string;
  address: string | null;
  cityName: string | null;
  branchName: string | null;
  openingTime: string | null;
  closingTime: string | null;
  isActive: boolean;
};

export function normalizeLocation(raw: any): StaffLocation {
  const status = pick(raw, "isActive", "status");
  return {
    id: num(raw, "id"),
    idGuid: optStr(raw, "idGuid", "idGUID", "publicId"),
    name: str(raw, "name"),
    address: optStr(raw, "address"),
    cityName: optStr(raw, "cityName", "city"),
    branchName: optStr(raw, "branchName"),
    openingTime: optStr(raw, "openingTime"),
    closingTime: optStr(raw, "closingTime"),
    isActive: status == null ? true : status === true || status === 1 || String(status).toLowerCase() === "true",
  };
}

/** GET location?page=1&limit=1000 — locations the user may see (admins / sales executives: their own), A-Z. */
export async function getLocations(): Promise<StaffLocation[]> {
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.lookups.locations, { page: 1, limit: BIG_PAGE }));
  return toList(raw, normalizeLocation)
    .filter((l) => l.id > 0 && l.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Floors ───────────────────────────────────────────────────────────────────────────────────────────────

export type Floor = { id: number; name: string; floorNumber: number | null };

/** CMS floor label: name, floorName, "Floor N" or "Floor #id". */
export function floorLabel(raw: any): string {
  const name = optStr(raw, "name", "floorName");
  if (name) return name;
  const n = optNum(raw, "floorNumber");
  return n != null ? `Floor ${n}` : `Floor #${num(raw, "id")}`;
}

/**
 * GET floor?locationId= — floors of a location. Admins / sales executives get 403 for a location that isn't
 * theirs; without a location they get their primary location's floors.
 */
export async function getFloors(locationId?: number | null): Promise<Floor[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.lookups.floors, { locationId: locationId && locationId > 0 ? locationId : undefined }),
  );
  return toList(raw, (f) => ({ id: num(f, "id"), name: floorLabel(f), floorNumber: optNum(f, "floorNumber") })).filter(
    (f) => f.id > 0,
  );
}

// ─── Space types and spaces ───────────────────────────────────────────────────────────────────────────────

/** The three space groups the CMS forms offer. */
export type SpaceGroup = "private" | "shared" | "meeting";

export const SPACE_GROUP_LABELS: Record<SpaceGroup, string> = {
  private: "Private Room",
  shared: "Shared Space",
  meeting: "Meeting Room",
};

export type SpaceType = { id: number; name: string; capacity: number | null; isActive: boolean; group: SpaceGroup | null };

/** CMS populateSpaceTypeOptions: group a space type by its name. */
export function spaceTypeGroup(name: string | null | undefined): SpaceGroup | null {
  const l = (name ?? "").toLowerCase();
  if (l.includes("private") || l.includes("office") || l.includes("desk")) return "private";
  if (l.includes("meeting") || l.includes("conference") || l.includes("board")) return "meeting";
  if (l.includes("shared") || l.includes("co-working") || l.includes("coworking") || l.includes("open")) return "shared";
  return null;
}

/** GET spacetype?page=1&limit=1000 (the API ignores search). */
export async function getSpaceTypes(): Promise<SpaceType[]> {
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.lookups.spaceTypes, { page: 1, limit: BIG_PAGE }));
  return toList(raw, (t) => {
    const name = str(t, "name", "displayName", "description");
    const active = pick(t, "isActive", "status");
    return {
      id: num(t, "id"),
      name,
      capacity: optNum(t, "capacity"),
      isActive: active == null ? true : active === true || active === 1 || String(active).toLowerCase() === "true",
      group: spaceTypeGroup(name),
    };
  }).filter((t) => t.id > 0);
}

export type StaffSpace = {
  id: number;
  idGuid: string | null;
  name: string;
  code: string | null;
  locationId: number | null;
  locationIdGuid: string | null;
  locationName: string | null;
  spaceTypeId: number | null;
  spaceTypeName: string | null;
  categoryCode: string | null;
  capacity: number;
  /** Price as the API lists it (`price`). */
  price: number;
  pricePerHour: number;
  pricePerDay: number;
  pricePerMonth: number;
  seatPrice: number;
  /** Available | Booked | Occupied ... */
  status: string;
  bookedTill: string | null;
  floorId: number | null;
  floor: string | null;
  imageUrl: string | null;
};

export function normalizeSpace(raw: any): StaffSpace {
  return {
    id: num(raw, "id"),
    idGuid: optStr(raw, "idGuid", "idGUID", "publicId"),
    name: str(raw, "name"),
    code: optStr(raw, "code"),
    locationId: optNum(raw, "locationIdInt", "locationId"),
    locationIdGuid: optStr(raw, "locationIdGuid", "locationGuid"),
    locationName: optStr(raw, "locationName"),
    spaceTypeId: optNum(raw, "spaceTypeId"),
    spaceTypeName: optStr(raw, "spaceTypeName", "spaceType"),
    categoryCode: optStr(raw, "categoryCode"),
    capacity: num(raw, "capacity"),
    price: num(raw, "price"),
    pricePerHour: num(raw, "pricePerHour"),
    pricePerDay: num(raw, "pricePerDay"),
    pricePerMonth: num(raw, "pricePerMonth"),
    seatPrice: num(raw, "seatPrice"),
    status: str(raw, "status") || "Available",
    bookedTill: optStr(raw, "bookedTill", "bookedUntil", "endOn"),
    floorId: optNum(raw, "floorId"),
    floor: optStr(raw, "floor", "floorName"),
    imageUrl: optStr(raw, "imageUrl"),
  };
}

/** GET space?page=&limit=&search= — admins / sales executives: their locations only (filtered after paging). */
export async function listSpaces(query: { page?: number; limit?: number; search?: string } = {}): Promise<Page<StaffSpace>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? BIG_PAGE;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.lookups.spaces, { page, limit, search: query.search?.trim() }));
  return toPage(raw, normalizeSpace, { page, limit });
}

/** Every space the user may see (one 1000-row page, as the CMS forms load them). */
export async function getAllSpaces(): Promise<StaffSpace[]> {
  return (await listSpaces({ page: 1, limit: BIG_PAGE })).items;
}

/** CMS filteredQuotationSpaceOptions: does the space belong to the group? */
export function spaceInGroup(space: Pick<StaffSpace, "categoryCode" | "spaceTypeName" | "name">, group: SpaceGroup): boolean {
  const category = (space.categoryCode ?? "").toLowerCase();
  const type = (space.spaceTypeName ?? "").toLowerCase();
  const name = (space.name ?? "").toLowerCase();
  switch (group) {
    case "meeting":
      return category.includes("meeting") || type.includes("meeting") || type.includes("conference") || name.includes("meeting") || name.includes("conference");
    case "private":
      return category.includes("private") || type.includes("private") || type.includes("office");
    case "shared":
      return category.includes("shared") || category.includes("coworking") || type.includes("shared") || type.includes("co-working");
  }
}

/** The spaces a form offers for a location + group (+ capacity for private rooms), like the CMS picker. */
export function filterSpaces(
  spaces: StaffSpace[],
  filter: { locationId?: number | null; group: SpaceGroup; capacity?: number | null },
): StaffSpace[] {
  return spaces.filter(
    (s) =>
      (!filter.locationId || s.locationId === filter.locationId) &&
      spaceInGroup(s, filter.group) &&
      (filter.group !== "private" || !filter.capacity || s.capacity === filter.capacity),
  );
}

/** Private-room sizes at a location (CMS availableQuotationCapacities), ascending. */
export function privateRoomCapacities(spaces: StaffSpace[], locationId?: number | null): number[] {
  const caps = new Set<number>();
  for (const s of spaces) {
    if ((s.spaceTypeName ?? "").toLowerCase().includes("private") && s.capacity > 0 && (!locationId || s.locationId === locationId)) {
      caps.add(s.capacity);
    }
  }
  return [...caps].sort((a, b) => a - b);
}

/**
 * Standard monthly price per seat of a space, as the CMS quotation form reads it (getSpacePrice): pricePerMonth,
 * else pricePerDay, seatPrice, price. The API refuses a base price below the standard one.
 */
export function spaceMonthlyPrice(space: Pick<StaffSpace, "pricePerMonth" | "pricePerDay" | "seatPrice" | "price">): number {
  return space.pricePerMonth || space.pricePerDay || space.seatPrice || space.price || 0;
}

/** True when the space is taken now (status Booked / Occupied). */
export function isSpaceBooked(space: Pick<StaffSpace, "status">): boolean {
  const s = space.status.trim().toLowerCase();
  return s === "booked" || s === "occupied";
}

/** GET space/{id or guid}/summary — one space (there is no GET space/{id}). */
export async function getSpace(idOrGuid: number | string): Promise<StaffSpace> {
  return normalizeSpace(unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.lookups.spaceSummary(idOrGuid))));
}

// ─── Space config and billing periods ─────────────────────────────────────────────────────────────────────

export type SpaceConfig = {
  spaceCategory: string;
  openingTime: string | null;
  closingTime: string | null;
  securityDeposit: number | null;
  price: number | null;
  billingPeriodId: number | null;
  raw: Record<string, any>;
};

/** GET space-config — per category (meeting / private / shared): opening hours for meeting-room slots, deposit, price. */
export async function getSpaceConfig(): Promise<SpaceConfig[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.lookups.spaceConfig), (c) => ({
    spaceCategory: str(c, "spaceCategory", "category", "name"),
    openingTime: optStr(c, "openingTime"),
    closingTime: optStr(c, "closingTime"),
    securityDeposit: optNum(c, "securityDeposit"),
    price: optNum(c, "price"),
    billingPeriodId: optNum(c, "billingPeriodId"),
    raw: c ?? {},
  }));
}

export type BillingPeriod = { id: number; code: string; label: string; durationDays: number; isActive: boolean };

/** GET billing-periods */
export async function getBillingPeriods(): Promise<BillingPeriod[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.lookups.billingPeriods), (b) => ({
    id: num(b, "id"),
    code: str(b, "code"),
    label: str(b, "label"),
    durationDays: num(b, "durationDays"),
    isActive: b?.isActive == null && b?.IsActive == null ? true : bool(b, "isActive"),
  }));
}
