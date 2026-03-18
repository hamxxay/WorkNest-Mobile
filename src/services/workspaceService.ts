import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";
export type Faq = {};

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

const DEMO_WORKSPACES: Workspace[] = [
  {
    id: -101,
    name: "Atlas Private Office",
    type: "Private Office",
    location: "Demo Floor, Karachi",
    capacity: "4 people",
    price: 120,
    amenities: ["Dedicated desks", "High-speed Wi-Fi", "Lockable storage"],
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: -102,
    name: "Harbor Co-Working Hub",
    type: "Co-Working Space",
    location: "Demo Wing, Lahore",
    capacity: "12 people",
    price: 35,
    amenities: ["Open seating", "Coffee bar", "Community lounge"],
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: -103,
    name: "Summit Meeting Room",
    type: "Meeting Room",
    location: "Demo Tower, Islamabad",
    capacity: "8 people",
    price: 60,
    amenities: ["Display screen", "Video conferencing", "Whiteboard"],
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: -104,
    name: "Forum Event Studio",
    type: "Event Space",
    location: "Demo Hall, Karachi",
    capacity: "40 people",
    price: 180,
    amenities: ["Stage lighting", "Flexible seating", "PA system"],
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop",
    available: true,
  },
];

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

function ensureWorkspaceTypes(items: Workspace[]): Workspace[] {
  const existingTypes = new Set(items.map((item) => item.type));
  const missingDemos = DEMO_WORKSPACES.filter((item) => !existingTypes.has(item.type));
  return [...items, ...missingDemos];
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const payload = await apiRequest<ApiListResponse<ApiWorkspace>>(
    API_ENDPOINTS.workspaces.list,
    {
      requiresAuth: true,
    }
  );

  const items = Array.isArray(payload)
    ? payload
    : payload.data ?? payload.items ?? payload.workspaces ?? [];

  return ensureWorkspaceTypes(items.map(mapWorkspace));
}

export async function createBooking(
  workspaceId: number,
  startDateTime: string,
  endDateTime: string,
  notes?: string
) {
  return apiRequest(API_ENDPOINTS.workspaces.book, {
    method: "POST",
    requiresAuth: true,
    body: {
      spaceId: workspaceId,
      startDateTime,
      endDateTime,
      notes: notes?.trim() ? notes.trim() : null,
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
