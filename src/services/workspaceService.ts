import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizeNotesInput,
  sanitizePhoneInput,
  sanitizeTextForState,
  INPUT_LIMITS,
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
  capacity: string;
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
    };

type ApiWorkspace = {
  id: number;
  name?: string;
  locationName?: string;
  spaceTypeName?: string;
  capacity?: number | string;
  amenities?: string;
  pricePerDay?: number;
  status?: string;
  imageUrl?: string;
};

type ApiBooking = {
  id: number;
  spaceName?: string;
  startDateTime?: string;
  endDateTime?: string;
  totalAmount?: number;
  bookingStatus?: string;
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
  guest?: BookingGuestDetails;
  payment?: BookingPaymentDetails;
};

function mapWorkspace(item: ApiWorkspace): Workspace {
  const resolvedImageUrl = resolveMediaUrl(item.imageUrl);
  return {
    id: item.id,
    name: item.name ?? "Workspace",
    type: normalizeSpaceType(item.spaceTypeName),
    location: item.locationName ?? "Unknown location",
    capacity:
      typeof item.capacity === "number"
        ? `${item.capacity} people`
        : item.capacity || "N/A",
    price: Number(item.pricePerDay ?? 0),
    amenities: item.amenities
      ? item.amenities.split(",").map((part) => part.trim()).filter(Boolean)
      : [],
    image:
      resolvedImageUrl ||
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop",
    available: (item.status ?? "available").toLowerCase() !== "inactive",
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
      {
        requiresAuth: true,
      }
    );

    if (!payload) return [];

    const items = Array.isArray(payload)
      ? payload
      : payload.data ?? payload.items ?? payload.workspaces ?? [];

    return items.map(mapWorkspace);
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
      spaceId: workspaceId,
      startDateTime,
      endDateTime,
      notes,
      guest,
      payment,
    },
  });
}

export async function getMyBookings() {
  const payload = await apiRequest<ApiListResponse<ApiBooking>>(
    API_ENDPOINTS.workspaces.myBookings,
    {
      requiresAuth: true,
    }
  );

  return Array.isArray(payload)
    ? payload
    : payload.data ?? payload.items ?? payload.workspaces ?? [];
}

export async function cancelBooking(bookingId: number) {
  return apiRequest(API_ENDPOINTS.workspaces.cancelBooking(bookingId), {
    method: "PATCH",
    requiresAuth: true,
  });
}

export async function getLocations(): Promise<ApiLocation[]> {
  try {
    const payload = await apiRequest<ApiListResponse<ApiLocation>>(
      API_ENDPOINTS.locations.list,
      {
        requiresAuth: true,
      }
    );

    if (!payload) return [];

    return Array.isArray(payload)
      ? payload
      : payload.data ?? payload.items ?? [];
  } catch (err) {
    console.error("Error fetching locations:", err);
    return [];
  }
}
