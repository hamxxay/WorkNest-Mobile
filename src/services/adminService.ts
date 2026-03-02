import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";

type ApiResponse<T> = {
  isSuccessful?: boolean;
  data?: T;
  message?: string;
  total?: number;
};
type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};
export type PaginatedList<T> = {
  items: T[];
  total: number | null;
};

export type DashboardSummary = {
  users?: number;
  spaces?: number;
  bookings?: number;
  contacts?: number;
  locations?: number;
  plans?: number;
  gallery?: number;
  memberships?: number;
};

export type RecentBooking = {
  id: number;
  userEmail?: string;
  spaceName?: string;
  bookingStatus?: string;
};

export type RecentContact = {
  id: number;
  fullName?: string;
  email?: string;
  status?: string;
};

export type AdminUser = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  isActive?: boolean;
};

export type AdminLocation = {
  id: number;
  name?: string;
  address?: string;
  city?: string;
  openingTime?: string;
  closingTime?: string;
  isActive?: boolean;
};

export type AdminSpaceType = {
  id: number;
  name?: string;
  capacity?: number;
  hourlyAllowed?: boolean;
  isActive?: boolean;
};

export type AdminSpace = {
  id: number;
  name?: string;
  locationName?: string;
  spaceTypeName?: string;
  code?: string;
  floor?: string;
  pricePerHour?: number;
  pricePerDay?: number;
  status?: string;
};

export type AdminBooking = {
  id: number;
  userEmail?: string;
  spaceName?: string;
  startDateTime?: string;
  endDateTime?: string;
  totalAmount?: number;
  bookingStatus?: string;
};

export type AdminPricingPlan = {
  id: number;
  name?: string;
  price?: number;
  billingCycle?: string;
  includesHours?: number;
  isActive?: boolean;
};

export type AdminMembership = {
  id: number;
  userEmail?: string;
  planName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
};

export type AdminPayment = {
  id: number;
  userEmail?: string;
  amount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
};

export type AdminContact = {
  id: number;
  fullName?: string;
  email?: string;
  phone?: string;
  message?: string;
  status?: string;
  createdAt?: string;
};

export type AdminGallery = {
  id: number;
  title?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
};

function buildQuery({ page, limit, search }: ListQuery = {}): string {
  const params = new URLSearchParams();
  if (page != null) {
    params.set("page", String(page));
  }
  if (limit != null) {
    params.set("limit", String(limit));
  }
  if (search && search.trim().length > 0) {
    params.set("search", search.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function ensureSuccess<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response?.isSuccessful && response.data !== undefined) {
    return response.data;
  }
  throw new Error(response?.message || fallbackMessage);
}

type ArrayResponse = ApiResponse<unknown[]>;

async function getCountFrom(path: string): Promise<number> {
  const response = await apiRequest<ArrayResponse>(path, {
    requiresAuth: true,
    unwrapData: false,
  });
  const data = ensureSuccess(response, `Unable to load ${path}.`);
  return Array.isArray(data) ? data.length : 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const response = await apiRequest<ApiResponse<DashboardSummary>>(
      API_ENDPOINTS.admin.dashboardSummary,
      { requiresAuth: true, unwrapData: false }
    );
    return ensureSuccess(response, "Unable to load dashboard summary.");
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  const [
    users,
    spaces,
    bookings,
    contacts,
    locations,
    plans,
    gallery,
    memberships,
  ] = await Promise.all([
    getCountFrom("/user"),
    getCountFrom("/space"),
    getCountFrom("/booking"),
    getCountFrom("/contact"),
    getCountFrom("/location/all"),
    getCountFrom("/pricingplan/all"),
    getCountFrom("/gallery/all"),
    getCountFrom("/membership"),
  ]);

  return { users, spaces, bookings, contacts, locations, plans, gallery, memberships };
}

export async function getRecentBookings(limit = 5): Promise<RecentBooking[]> {
  const response = await apiRequest<ApiResponse<RecentBooking[]>>(
    API_ENDPOINTS.admin.recentBookings(limit),
    { requiresAuth: true, unwrapData: false }
  );
  return ensureSuccess(response, "Unable to load recent bookings.");
}

export async function getRecentContacts(limit = 5): Promise<RecentContact[]> {
  const response = await apiRequest<ApiResponse<RecentContact[]>>(
    API_ENDPOINTS.admin.recentContacts(limit),
    { requiresAuth: true, unwrapData: false }
  );
  return ensureSuccess(response, "Unable to load recent contacts.");
}

export async function getUsersPage(query: ListQuery = {}): Promise<PaginatedList<AdminUser>> {
  const response = await apiRequest<ApiResponse<AdminUser[]>>(
    `${API_ENDPOINTS.admin.users}${buildQuery(query)}`,
    {
      requiresAuth: true,
      unwrapData: false,
    }
  );
  const items = ensureSuccess(response, "Unable to load users.");
  return { items, total: typeof response.total === "number" ? response.total : null };
}

export async function getUsers(query: ListQuery = {}): Promise<AdminUser[]> {
  const result = await getUsersPage(query);
  return result.items;
}

async function getEntityPage<T>(
  path: string,
  query: ListQuery,
  fallbackMessage: string
): Promise<PaginatedList<T>> {
  const response = await apiRequest<ApiResponse<T[]>>(`${path}${buildQuery(query)}`, {
    requiresAuth: true,
    unwrapData: false,
  });
  const items = ensureSuccess(response, fallbackMessage);
  return { items, total: typeof response.total === "number" ? response.total : null };
}

export async function getLocationsPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminLocation>> {
  return getEntityPage<AdminLocation>("/location/all", query, "Unable to load locations.");
}

export async function getSpaceTypesPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminSpaceType>> {
  return getEntityPage<AdminSpaceType>(
    "/spacetype/all",
    query,
    "Unable to load space types."
  );
}

export async function getSpacesPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminSpace>> {
  return getEntityPage<AdminSpace>("/space", query, "Unable to load spaces.");
}

export async function getBookingsPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminBooking>> {
  return getEntityPage<AdminBooking>("/booking", query, "Unable to load bookings.");
}

export async function getPricingPlansPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminPricingPlan>> {
  return getEntityPage<AdminPricingPlan>(
    "/pricingplan/all",
    query,
    "Unable to load pricing plans."
  );
}

export async function getMembershipsPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminMembership>> {
  return getEntityPage<AdminMembership>(
    "/membership",
    query,
    "Unable to load memberships."
  );
}

export async function getPaymentsPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminPayment>> {
  return getEntityPage<AdminPayment>("/payment", query, "Unable to load payments.");
}

export async function getContactsPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminContact>> {
  return getEntityPage<AdminContact>("/contact", query, "Unable to load contacts.");
}

export async function getGalleryPage(
  query: ListQuery = {}
): Promise<PaginatedList<AdminGallery>> {
  return getEntityPage<AdminGallery>("/gallery/all", query, "Unable to load gallery items.");
}
