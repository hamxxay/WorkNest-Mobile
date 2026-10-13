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
 * (GET /space/available lists the individual spaces; booking picks one of them).
 */
export type Workspace = {
  /** Id of one space of the category (stable list key; booking does not use it). */
  id: number;
  /** The category's name, e.g. "Private Office" (not one space's name: the API assigns the space). */
  name: string;
  type: "Private Office" | "Co-Working Space" | "Meeting Room" | "Event Space";
  location: string;
  availableCount: number;
  totalCount: number;
  /**
   * Lowest listed price among the category's available spaces (per billing period, see priceUnit): what one space
   * costs (the room price, or the seat price when the API has no room price). 0 when the API has no active price.
   */
  price: number;
  /** Billing period of `price` from the API (e.g. Monthly, Hourly). */
  priceUnit?: string;
  /** API category code (SharedSpace / PrivateOffice / MeetingRoom ...), used for smart booking. */
  categoryCode?: string;
  /** Seats per space across the category: "5" or "1-9" (see capacityLabel). */
  capacity?: string;
  minCapacity?: number;
  maxCapacity?: number;
  securityDeposit?: number;
  /** Amenities offered by the category's spaces (no duplicates). */
  amenities: string[];
  image: string;
  available: boolean;
};

export type ApiWorkspace = {
  id?: number | string;
  numericId?: number;
  idGuid?: string;
  publicId?: string;
  name?: string;
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
  imageUrl?: string | null;
};

function isAvailable(item: ApiWorkspace): boolean {
  const raw = item.spaceStatus ?? item.status;
  return raw == null ? true : String(raw).toLowerCase() === "available" || raw === 1;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function amenitiesOf(item: ApiWorkspace): string[] {
  return item.amenities ? item.amenities.split(",").map((part) => part.trim()).filter(Boolean) : [];
}

/** What one space costs per billing period: its room price, else its seat price (older servers: pricePerDay). */
function spacePrice(item: ApiWorkspace): number {
  const room = numberOrUndefined(item.roomPrice);
  if (room && room > 0) return room;
  const seat = numberOrUndefined(item.seatPrice ?? item.pricePerDay);
  return seat && seat > 0 ? seat : 0;
}

/** One card for all the spaces of a category at a location (`spaces` is never empty). */
function mapCategory(spaces: ApiWorkspace[]): Workspace {
  const available = spaces.filter(isAvailable);
  // Prices and seats describe what can still be booked; a fully booked category still shows its listing.
  const pool = available.length ? available : spaces;
  const first = pool[0];
  const type = normalizeSpaceType(first.spaceTypeName ?? first.categoryLabel ?? first.categoryCode ?? undefined);

  const priced = pool.filter((item) => spacePrice(item) > 0);
  const cheapest = priced.reduce<ApiWorkspace | null>(
    (best, item) => (!best || spacePrice(item) < spacePrice(best) ? item : best),
    null,
  );
  const seats = pool.map((item) => numberOrUndefined(item.capacity)).filter((n): n is number => !!n && n > 0);
  const minCapacity = seats.length ? Math.min(...seats) : undefined;
  const maxCapacity = seats.length ? Math.max(...seats) : undefined;
  const deposits = pool
    .map((item) => numberOrUndefined(item.securityDeposit))
    .filter((n): n is number => n !== undefined && n > 0);
  const withImage = pool.find((item) => resolveMediaUrl(item.imageUrl ?? undefined));

  return {
    id: Number(first.numericId ?? first.id ?? 0),
    name: type,
    type,
    location: first.locationName ?? "",
    availableCount: available.length,
    totalCount: spaces.length,
    price: cheapest ? spacePrice(cheapest) : 0,
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
    amenities: Array.from(new Set(pool.flatMap(amenitiesOf))),
    // No stock photo when no space has one: the image component shows a neutral placeholder.
    image: withImage ? resolveMediaUrl(withImage.imageUrl ?? undefined) || "" : "",
    available: available.length > 0,
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

function normalizeSpaceType(type?: string): Workspace["type"] {
  const value = (type ?? "").toLowerCase();
  if (value.includes("meeting") || value.includes("conference")) return "Meeting Room";
  if (value.includes("shared") || value.includes("co")) return "Co-Working Space";
  if (value.includes("event")) return "Event Space";
  return "Private Office";
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

/**
 * "From PKR 30,000 / month": the lowest listed price of the category ("From" when it has several spaces, since the
 * space assigned may cost more), or "Price on request" when the API has none. The challan has the exact amount.
 */
export function listedRate(
  workspace: Pick<Workspace, "price" | "priceUnit"> & Partial<Pick<Workspace, "availableCount" | "totalCount">>,
): string {
  if (!(workspace.price > 0)) return "Price on request";
  const unit = priceUnitLabel(workspace);
  const several = (workspace.availableCount ?? 0) > 1 || (workspace.totalCount ?? 0) > 1;
  return `${several ? "From " : ""}${formatMoney(workspace.price)}${unit ? ` / ${unit}` : ""}`;
}

function extractSpaces(payload: unknown): ApiWorkspace[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ApiWorkspace[];
  const p = payload as { data?: ApiWorkspace[]; items?: ApiWorkspace[]; workspaces?: ApiWorkspace[] };
  return p.data ?? p.items ?? p.workspaces ?? [];
}

/** One Workspace card per location + space type, in the API's order, summarising all of its spaces. */
export function buildWorkspaceList(items: ApiWorkspace[]): Workspace[] {
  const groups = new Map<string, ApiWorkspace[]>();
  for (const item of items) {
    const key = `${item.locationName ?? ""}||${normalizeSpaceType(item.spaceTypeName ?? item.categoryLabel ?? item.categoryCode ?? undefined)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.values()).map(mapCategory);
}

/**
 * GET /space/available — spaces open for booking, one card per location + space type.
 * Throws a readable ApiError on failure (callers show an error state, not an empty list).
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.workspaces.list, { requiresAuth: true });
  return buildWorkspaceList(extractSpaces(payload));
}

/** GET /location/all — active locations. Throws a readable ApiError on failure. */
export async function getLocations(): Promise<ApiLocation[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.locations.list, { requiresAuth: true });
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ApiLocation[];
  const p = payload as { data?: ApiLocation[]; items?: ApiLocation[] };
  return p.data ?? p.items ?? [];
}
