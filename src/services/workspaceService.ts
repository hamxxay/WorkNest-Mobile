import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { createSpaceBooking, type CreatedBooking } from "./bookingService";

export type ApiLocation = {
  id: number;
  idGuid: string;
  name: string;
  city?: string;
  address?: string;
  status?: number;
};

export type Workspace = {
  id: number;
  name: string;
  type: "Private Office" | "Co-Working Space" | "Meeting Room" | "Event Space";
  location: string;
  availableCount: number;
  totalCount: number;
  /** Listed seat price from the API (per billing period, see priceUnit); 0 when the API has no active price. */
  price: number;
  /** Billing period of `price` from the API (e.g. Monthly, Hourly). */
  priceUnit?: string;
  /** API category code (SharedSpace / PrivateOffice / MeetingRoom ...), used for smart booking. */
  categoryCode?: string;
  /** Seats in the space, as text (the screens display it). */
  capacity?: string;
  securityDeposit?: number;
  amenities: string[];
  image: string;
  available: boolean;
};

type ApiWorkspace = {
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

function mapWorkspace(item: ApiWorkspace, availableCount: number, totalCount: number): Workspace {
  const resolvedImageUrl = resolveMediaUrl(item.imageUrl ?? undefined);
  return {
    id: Number(item.numericId ?? item.id ?? 0),
    name: item.name ?? "Workspace",
    type: normalizeSpaceType(item.spaceTypeName ?? item.categoryLabel ?? item.categoryCode ?? undefined),
    location: item.locationName ?? "",
    availableCount,
    totalCount,
    // GET /space/available sends seatPrice (per billing period); pricePerDay is kept for older servers.
    price: Number(item.seatPrice ?? item.pricePerDay ?? 0) || 0,
    priceUnit: item.billingPeriodCode ?? undefined,
    categoryCode: item.categoryCode ?? undefined,
    capacity: numberOrUndefined(item.capacity)?.toString(),
    securityDeposit: numberOrUndefined(item.securityDeposit),
    amenities: item.amenities
      ? item.amenities.split(",").map((part) => part.trim()).filter(Boolean)
      : [],
    image:
      resolvedImageUrl ||
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop",
    available: isAvailable(item),
  };
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

function extractSpaces(payload: unknown): ApiWorkspace[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ApiWorkspace[];
  const p = payload as { data?: ApiWorkspace[]; items?: ApiWorkspace[]; workspaces?: ApiWorkspace[] };
  return p.data ?? p.items ?? p.workspaces ?? [];
}

/** Build the deduped, counted Workspace[] from a raw list. */
function buildWorkspaceList(items: ApiWorkspace[]): Workspace[] {
  const counts = new Map<string, { avail: number; total: number }>();
  for (const item of items) {
    const key = `${item.locationName ?? ""}||${normalizeSpaceType(item.spaceTypeName)}`;
    const entry = counts.get(key) ?? { avail: 0, total: 0 };
    entry.total += 1;
    if (isAvailable(item)) entry.avail += 1;
    counts.set(key, entry);
  }

  const seen = new Set<string>();
  const result: Workspace[] = [];
  for (const item of items) {
    const key = `${item.locationName ?? ""}||${normalizeSpaceType(item.spaceTypeName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { avail, total } = counts.get(key)!;
    result.push(mapWorkspace(item, avail, total));
  }
  return result;
}

/**
 * GET /space/available — spaces open for booking, one card per location + space type.
 * Throws a readable ApiError on failure (callers show an error state, not an empty list).
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.workspaces.list, { requiresAuth: true });
  return buildWorkspaceList(extractSpaces(payload));
}

/**
 * POST /booking — books one specific space for the signed-in customer. The API prices the booking and issues
 * the bank challan; the result carries the booking id and challan (show the challan next).
 * Kept for the Booking tab's quick-book form; see bookingService.createSpaceBooking.
 */
export async function createBooking(
  workspaceId: number,
  startDateTime: string,
  endDateTime: string,
  details?: string | { notes?: string }
): Promise<CreatedBooking> {
  const notes = typeof details === "string" ? details : details?.notes;
  return createSpaceBooking({ spaceId: workspaceId, startDateTime, endDateTime, notes });
}

/** GET /location/all — active locations. Throws a readable ApiError on failure. */
export async function getLocations(): Promise<ApiLocation[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.locations.list, { requiresAuth: true });
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ApiLocation[];
  const p = payload as { data?: ApiLocation[]; items?: ApiLocation[] };
  return p.data ?? p.items ?? [];
}
