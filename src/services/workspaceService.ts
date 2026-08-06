import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizeNotesInput,
  sanitizePhoneInput,
} from "../utils/inputSanitizer";
export type Faq = {};

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
  price: number;
  amenities: string[];
  image: string;
  available: boolean;
};

type ApiListResponse<T> =
  | T[]
  | {
      data?: T[];
      items?: T[];
      workspaces?: T[];
      total?: number;
    };

function extractList<T>(payload: ApiListResponse<T> | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.data ?? payload.items ?? payload.workspaces ?? [];
}

type ApiWorkspace = {
  id?: number | string;
  numericId?: number;
  idGuid?: string;
  name?: string;
  locationName?: string;
  spaceTypeName?: string;
  capacity?: number | string | null;
  amenities?: string | null;
  pricePerDay?: number | null;
  status?: string | number | null;
  spaceStatus?: string | null;
  imageUrl?: string | null;
};

type ApiBooking = {
  id?: number | string;
  idGuid?: string;
  spaceName?: string;
  spaceId?: number | string;
  startDateTime?: string;
  endDateTime?: string;
  totalAmount?: number | null;
  paidAmount?: number | null;
  pricePerDay?: number | null;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  notes?: string | null;
  spaceImageUrl?: string | null;
  locationName?: string | null;
};

export type BookingGuestDetails = {
  name: string;
  email: string;
  phone: string;
};

export type BookingPaymentDetails = {
  method: string;
  amount: number;
  voucherCode?: string;
  bankDepositId?: string;
  referenceNumber?: string;
};

export type BookingCreateDetails = {
  notes?: string;
  spaceType?: string;
  guest?: BookingGuestDetails;
  payment?: BookingPaymentDetails;
};

function isAvailable(item: ApiWorkspace): boolean {
  const raw = item.spaceStatus ?? item.status;
  return raw == null ? true : String(raw).toLowerCase() === "available" || raw === 1;
}

function mapWorkspace(item: ApiWorkspace, availableCount: number, totalCount: number): Workspace {
  const resolvedImageUrl = resolveMediaUrl(item.imageUrl ?? undefined);
  return {
    id: Number(item.numericId ?? item.id ?? 0),
    name: item.name ?? "Workspace",
    type: normalizeSpaceType(item.spaceTypeName),
    location: item.locationName ?? "Unknown location",
    availableCount,
    totalCount,
    price: Number(item.pricePerDay ?? 0),
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
  if (value.includes("meeting")) return "Meeting Room";
  if (value.includes("co")) return "Co-Working Space";
  if (value.includes("event")) return "Event Space";
  return "Private Office";
}

export async function getWorkspaces(): Promise<Workspace[]> {
  try {
    const payload = await apiRequest<ApiListResponse<ApiWorkspace>>(
      API_ENDPOINTS.workspaces.list,
      { requiresAuth: true }
    );

    if (!payload) return [];

    const items = extractList(payload);

    // Pre-compute available/total counts per location+type group (same as FE reference)
    const counts = new Map<string, { avail: number; total: number }>();
    for (const item of items) {
      const key = `${item.locationName ?? ""}||${normalizeSpaceType(item.spaceTypeName)}`;
      const entry = counts.get(key) ?? { avail: 0, total: 0 };
      entry.total += 1;
      if (isAvailable(item)) entry.avail += 1;
      counts.set(key, entry);
    }

    // Deduplicate to one representative per group, carrying counts
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
  } catch (err) {
    console.error("Error fetching workspaces:", err);
    return [];
  }
}

export async function createBooking(
  workspaceId: number,
  startDateTime: string,
  endDateTime: string,
  details?: string | BookingCreateDetails
) {
  const payloadDetails: BookingCreateDetails =
    typeof details === "string" ? { notes: details } : details ?? {};
  const notes = payloadDetails.notes ? sanitizeNotesInput(payloadDetails.notes) : null;
  const guest = payloadDetails.guest
    ? {
        name: sanitizeNameInput(payloadDetails.guest.name, "Guest name"),
        email: sanitizeEmailInput(payloadDetails.guest.email),
        phone: sanitizePhoneInput(payloadDetails.guest.phone),
      }
    : null;
  const payment = payloadDetails.payment
    ? {
        method: sanitizeTextForState(payloadDetails.payment.method, {
          maxLength: INPUT_LIMITS.name,
          collapse: true,
        }),
        amount: payloadDetails.payment.amount,
        voucherCode: payloadDetails.payment.voucherCode
          ? sanitizeTextForState(payloadDetails.payment.voucherCode, {
              maxLength: 40,
              collapse: true,
            })
          : undefined,
        bankDepositId: payloadDetails.payment.bankDepositId
          ? sanitizeTextForState(payloadDetails.payment.bankDepositId, {
              maxLength: 40,
              collapse: true,
            })
          : undefined,
        referenceNumber: payloadDetails.payment.referenceNumber
          ? sanitizeTextForState(payloadDetails.payment.referenceNumber, {
              maxLength: 64,
              collapse: true,
            })
          : undefined,
      }
    : null;

  return apiRequest(API_ENDPOINTS.workspaces.book, {
    method: "POST",
    requiresAuth: true,
    body: {
      spaceId: String(workspaceId),
      spaceType: payloadDetails.spaceType ?? undefined,
      startDateTime,
      endDateTime,
      notes,
      guest,
      payment,
    },
  });
}

export async function getMyBookings() {
  try {
    const payload = await apiRequest<ApiListResponse<ApiBooking>>(
      API_ENDPOINTS.workspaces.myBookings,
      { requiresAuth: true }
    );
    return extractList(payload);
  } catch {
    return [];
  }
}

export async function updateBooking(
  bookingId: number | string,
  startDateTime: string,
  endDateTime: string,
  notes?: string
) {
  return apiRequest(API_ENDPOINTS.workspaces.updateBooking(bookingId), {
    method: "PUT",
    requiresAuth: true,
    body: { startDateTime, endDateTime, notes: notes ?? null },
  });
}

export async function cancelBooking(bookingId: number | string) {
  return apiRequest(API_ENDPOINTS.workspaces.cancelBooking(bookingId), {
    method: "PATCH",
    requiresAuth: true,
  });
}

export async function getLocations(): Promise<ApiLocation[]> {
  try {
    const payload = await apiRequest<ApiListResponse<ApiLocation>>(
      API_ENDPOINTS.locations.list,
      { requiresAuth: true }
    );
    if (!payload) return [];
    return extractList(payload);
  } catch (err) {
    console.error("Error fetching locations:", err);
    return [];
  }
}
