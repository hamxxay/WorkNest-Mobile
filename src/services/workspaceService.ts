import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { formatMoney } from "../utils/format";

export type ApiLocation = {
  id: number;
  idGuid: string;
  name: string;
  city?: string;
  address?: string;
  status?: number;
};

/**
 * One card on Home / Spaces: a space category (type) at one location, summarising every space of that type there
 * (GET /space/available lists the individual spaces; booking picks one of them at that location).
 */
export type Workspace = {
  /** Id of one space of the category (stable list key; booking does not use it). */
  id: number;
  /** The category's name, e.g. "Private Office" (not one space's name: the API assigns the space). */
  name: string;
  type: "Private Office" | "Co-Working Space" | "Meeting Room" | "Event Space";
  location: string;
  /** The location's id (WN_Locations.Id): availability and the booking stay at this location. */
  locationId?: number;
  /** Ids of the spaces the card stands for (gallery photos linked to one of them are shown on the card). */
  spaceIds: number[];
  /** Spaces of the category free right now (not booked at this moment). */
  availableCount: number;
  totalCount: number;
  /**
   * True when the API listed the spaces booked right now too (GET /space/available?includeOccupied=true, QA_03):
   * then a card with availableCount 0 is "Fully booked now" but can still be booked for a later period.
   */
  occupancyKnown: boolean;
  /**
   * Lowest listed price among the category's spaces free now (all of them when none is), per billing period (see
   * priceUnit): what one booking period of a space costs (a private office: the whole office, seat price x seats;
   * other spaces: the seat price). 0 when the API has no active price.
   */
  price: number;
  /** Highest listed price among the same spaces ("From" is shown only when prices differ). */
  maxPrice?: number;
  /** Billing period of `price` from the API (e.g. Monthly, Hourly). */
  priceUnit?: string;
  /** API category code (SharedSpace / PrivateOffice / MeetingRoom ...), used for smart booking. */
  categoryCode?: string;
  /** Seats per space across the category: "5" or "1-9" (see capacityLabel). */
  capacity?: string;
  minCapacity?: number;
  maxCapacity?: number;
  securityDeposit?: number;
  /** Amenities offered by the category's spaces (no duplicates; empty when the API sent none). */
  amenities: string[];
  image: string;
  /** Free right now (availableCount > 0). Whether a chosen period is free is checked when booking. */
  available: boolean;
  /** Has a listed price, so it can be booked in the app (otherwise: book a tour / contact us). */
  bookable: boolean;
};

export type ApiWorkspace = {
  id?: number | string;
  numericId?: number;
  idGuid?: string;
  publicId?: string;
  name?: string;
  locationId?: number | string | null;
  locationName?: string;
  spaceTypeName?: string;
  categoryCode?: string | null;
  categoryLabel?: string | null;
  capacity?: number | string | null;
  amenities?: string | null;
  seatPrice?: number | null;
  roomPrice?: number | null;
  securityDeposit?: number | null;
  billingPeriodCode?: string | null;
  pricePerDay?: number | null;
  status?: string | number | null;
  spaceStatus?: string | null;
  /** QA_03: booked at this moment (only sent with includeOccupied=true). */
  occupiedNow?: boolean | number | null;
  imageUrl?: string | null;
};

/** A photo from GET /gallery/all, linked to a space or a location (or neither). */
export type ApiGalleryPhoto = {
  imageUrl?: string | null;
  spaceId?: number | string | null;
  locationId?: number | string | null;
  isActive?: boolean | null;
};

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isFreeNow(item: ApiWorkspace): boolean {
  if (item.occupiedNow === true || item.occupiedNow === 1) return false;
  const raw = item.spaceStatus ?? item.status;
  return raw == null ? true : String(raw).toLowerCase() === "available" || raw === 1;
}

function amenitiesOf(item: ApiWorkspace): string[] {
  return item.amenities ? item.amenities.split(",").map((part) => part.trim()).filter(Boolean) : [];
}

/** True for the API's private office category (rented whole: priced per office, not per seat). */
export function isPrivateOfficeCategory(categoryCode?: string | null): boolean {
  const code = (categoryCode ?? "").toLowerCase();
  return code === "privateoffice" || code === "private";
}

/**
 * What one booking period of a space costs, the way the booking is charged (WN_Bookings_Insert): a private office
 * is rented whole (room price = seat price x seats); shared desks and meeting rooms are charged the seat price.
 * Older servers without a seat price: pricePerDay. 0 when the API sent no price.
 */
export function periodPrice(item: {
  categoryCode?: string | null;
  seatPrice?: number | null;
  roomPrice?: number | null;
  capacity?: number | string | null;
  pricePerDay?: number | null;
}): number {
  const seat = numberOrUndefined(item.seatPrice ?? item.pricePerDay);
  const room = numberOrUndefined(item.roomPrice);
  if (isPrivateOfficeCategory(item.categoryCode)) {
    if (room && room > 0) return room;
    const seats = numberOrUndefined(item.capacity);
    if (seat && seat > 0) return seats && seats > 0 ? seat * seats : seat;
    return 0;
  }
  if (seat && seat > 0) return seat;
  return room && room > 0 ? room : 0;
}

/** The card's type from the API's category code (SharedSpace, PrivateOffice, MeetingRoom...), else from its name. */
export function normalizeSpaceType(item: {
  categoryCode?: string | null;
  spaceTypeName?: string | null;
  categoryLabel?: string | null;
}): Workspace["type"] {
  const code = (item.categoryCode ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (code === "privateoffice" || code === "private") return "Private Office";
  if (code === "sharedspace" || code === "shared" || code === "coworking") return "Co-Working Space";
  if (code === "meetingroom" || code === "meeting" || code === "conference") return "Meeting Room";
  if (code === "event" || code === "eventspace") return "Event Space";
  // No (known) code: whole words of the name. "co" alone is no longer enough ("Conference", "Corner office").
  const value = ` ${(item.spaceTypeName ?? item.categoryLabel ?? "").toLowerCase()} `;
  if (/\b(meeting|conference|board ?room)\b/.test(value)) return "Meeting Room";
  if (/\b(shared|co-?working|hot ?desk)\b/.test(value)) return "Co-Working Space";
  if (/\bevent\b/.test(value)) return "Event Space";
  return "Private Office";
}

/** The photo for a card: the first space's own image, else a gallery photo of one of its spaces, else of its location. */
function cardImage(spaces: ApiWorkspace[], locationId: number | undefined, gallery: ApiGalleryPhoto[]): string {
  for (const space of spaces) {
    const own = resolveMediaUrl(space.imageUrl ?? undefined);
    if (own) return own;
  }
  const ids = new Set(spaces.map((s) => numberOrUndefined(s.numericId ?? s.id)).filter((n): n is number => n !== undefined));
  const usable = gallery.filter((photo) => photo.isActive !== false && resolveMediaUrl(photo.imageUrl ?? undefined));
  const ofSpace = usable.find((photo) => {
    const spaceId = numberOrUndefined(photo.spaceId);
    return spaceId !== undefined && ids.has(spaceId);
  });
  const ofLocation =
    locationId === undefined
      ? undefined
      : usable.find((photo) => numberOrUndefined(photo.spaceId) === undefined && numberOrUndefined(photo.locationId) === locationId);
  const photo = ofSpace ?? ofLocation;
  // No stock photo when nothing matches: the image component shows a neutral placeholder.
  return photo ? resolveMediaUrl(photo.imageUrl ?? undefined) || "" : "";
}

/** One card for all the spaces of a category at a location (`spaces` is never empty). */
function mapCategory(spaces: ApiWorkspace[], gallery: ApiGalleryPhoto[]): Workspace {
  const free = spaces.filter(isFreeNow);
  // Prices and seats describe what can be booked now; a category fully booked right now still shows its listing.
  const pool = free.length ? free : spaces;
  const first = pool[0];
  const type = normalizeSpaceType(first);

  const prices = pool.map(periodPrice).filter((p) => p > 0);
  const cheapest = pool.reduce<ApiWorkspace | null>((best, item) => {
    const price = periodPrice(item);
    if (!(price > 0)) return best;
    return !best || price < periodPrice(best) ? item : best;
  }, null);
  const seats = pool.map((item) => numberOrUndefined(item.capacity)).filter((n): n is number => !!n && n > 0);
  const minCapacity = seats.length ? Math.min(...seats) : undefined;
  const maxCapacity = seats.length ? Math.max(...seats) : undefined;
  const deposits = pool
    .map((item) => numberOrUndefined(item.securityDeposit))
    .filter((n): n is number => n !== undefined && n > 0);
  const locationId = numberOrUndefined(first.locationId);
  const price = cheapest ? periodPrice(cheapest) : 0;

  return {
    id: Number(first.numericId ?? first.id ?? 0),
    name: type,
    type,
    location: first.locationName ?? "",
    locationId: locationId && locationId > 0 ? locationId : undefined,
    spaceIds: spaces.map((s) => numberOrUndefined(s.numericId ?? s.id)).filter((n): n is number => n !== undefined),
    availableCount: free.length,
    totalCount: spaces.length,
    occupancyKnown: spaces.some((s) => s.occupiedNow !== undefined && s.occupiedNow !== null),
    price,
    maxPrice: prices.length ? Math.max(...prices) : undefined,
    priceUnit: (cheapest ?? first).billingPeriodCode ?? undefined,
    categoryCode: first.categoryCode ?? undefined,
    capacity:
      minCapacity === undefined || maxCapacity === undefined
        ? undefined
        : minCapacity === maxCapacity
          ? String(minCapacity)
          : `${minCapacity}-${maxCapacity}`,
    minCapacity,
    maxCapacity,
    securityDeposit: deposits.length ? Math.min(...deposits) : undefined,
    amenities: Array.from(new Set(spaces.flatMap(amenitiesOf))),
    image: cardImage(spaces, locationId, gallery),
    available: free.length > 0,
    bookable: price > 0,
  };
}

/** "1-9 seats", "5 seats", "1 seat" (empty when the API sent no capacity). */
export function capacityLabel(workspace: Pick<Workspace, "minCapacity" | "maxCapacity" | "capacity">): string {
  const { minCapacity: min, maxCapacity: max } = workspace;
  if (min !== undefined && max !== undefined) {
    if (min === max) return `${min} ${min === 1 ? "seat" : "seats"}`;
    return `${min}-${max} seats`;
  }
  return workspace.capacity ? `${workspace.capacity} seats` : "";
}

/** Readable unit for a listed price: "month", "hour", ... (empty when the API sent none). */
export function priceUnitLabel(workspace: Pick<Workspace, "priceUnit">): string {
  const unit = (workspace.priceUnit ?? "").toLowerCase();
  if (unit.startsWith("month")) return "month";
  if (unit.startsWith("hour")) return "hour";
  if (unit.startsWith("day") || unit === "daily") return "day";
  if (unit.startsWith("week")) return "week";
  return unit;
}

/** "PKR 175,000 / month" (no "From"); "Price on request" without a price. */
export function formatPeriodPrice(price: number | null | undefined, priceUnit?: string | null): string {
  if (!(typeof price === "number" && price > 0)) return "Price on request";
  const unit = priceUnitLabel({ priceUnit: priceUnit ?? undefined });
  return `${formatMoney(price)}${unit ? ` / ${unit}` : ""}`;
}

/**
 * "From PKR 30,000 / month": the lowest listed price of the category ("From" when its spaces cost different
 * amounts), or "Price on request" when the API has none. The challan has the exact amount.
 */
export function listedRate(
  workspace: Pick<Workspace, "price" | "priceUnit"> & Partial<Pick<Workspace, "availableCount" | "totalCount" | "maxPrice">>,
): string {
  if (!(workspace.price > 0)) return "Price on request";
  const several =
    workspace.maxPrice !== undefined
      ? workspace.maxPrice > workspace.price
      : (workspace.availableCount ?? 0) > 1 || (workspace.totalCount ?? 0) > 1;
  return `${several ? "From " : ""}${formatPeriodPrice(workspace.price, workspace.priceUnit)}`;
}

function extractList<T>(payload: unknown, ...keys: string[]): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const p = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(p[key])) return p[key] as T[];
  }
  return [];
}

/**
 * One Workspace card per location + space category, in the API's order, summarising all of its spaces. The
 * category code decides the group (the unit a booking picks from); `gallery` gives photos to cards without one.
 */
export function buildWorkspaceList(items: ApiWorkspace[], gallery: ApiGalleryPhoto[] = []): Workspace[] {
  const groups = new Map<string, ApiWorkspace[]>();
  for (const item of items) {
    const location = numberOrUndefined(item.locationId) ?? item.locationName ?? "";
    const key = `${location}||${item.categoryCode || normalizeSpaceType(item)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.values()).map((spaces) => mapCategory(spaces, gallery));
}

/** Gallery photos for the cards; never fails (no photos = placeholders). */
async function galleryPhotos(): Promise<ApiGalleryPhoto[]> {
  try {
    const payload = await apiRequest<unknown>(API_ENDPOINTS.gallery.list, { requiresAuth: true });
    return extractList<ApiGalleryPhoto>(payload, "data", "items", "images");
  } catch {
    return [];
  }
}

/**
 * GET /space/available?includeOccupied=true — every space type open for booking, one card per location + type,
 * including types whose spaces are all booked right now (the chosen period decides availability when booking).
 * A server without that option sends the spaces free now (as before). Throws a readable ApiError on failure
 * (callers show an error state, not an empty list).
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const [payload, gallery] = await Promise.all([
    apiRequest<unknown>(`${API_ENDPOINTS.workspaces.list}?includeOccupied=true`, { requiresAuth: true }),
    galleryPhotos(),
  ]);
  return buildWorkspaceList(extractList<ApiWorkspace>(payload, "data", "items", "workspaces"), gallery);
}

/** GET /location/all — active locations. Throws a readable ApiError on failure. */
export async function getLocations(): Promise<ApiLocation[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.locations.list, { requiresAuth: true });
  return extractList<ApiLocation>(payload, "data", "items");
}
