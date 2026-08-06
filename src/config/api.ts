import { Platform } from "react-native";
import { API_BASE } from "@env";

const ENV_API_BASE_URL = (API_BASE ?? "").trim();

export function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "http://localhost:7200/api";
  }

  const hasApiSuffix = /\/api(?:\/)?$/i.test(trimmed);
  const normalized = trimmed.replace(/\/+$/, "");

  return hasApiSuffix ? normalized : `${normalized}/api`;
}

function resolveApiBaseUrl(): string {
  const base = normalizeApiBaseUrl(ENV_API_BASE_URL.length > 0 ? ENV_API_BASE_URL : "http://localhost:7200");

  // Android emulator cannot reach host machine via localhost — remap to 10.0.2.2
  if (Platform.OS === "android") {
    return base
      .replace("localhost", "10.0.2.2")
      .replace("127.0.0.1", "10.0.2.2");
  }

  return base;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function buildApiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    signup: "/auth/register",
    profile: "/auth/me",
    logout: "/auth/logout",
    sync: "/auth/sync",
    googleLogin: "/auth/google-login",
  },
  workspaces: {
    list: "/space/available",
    book: "/booking",
    myBookings: "/booking/my",
    cancelBooking: (id: number | string) => `/booking/${id}/cancel`,
    updateBooking: (id: number | string) => `/booking/${id}`,
    availableByType: "/space/available-by-type",
    availabilityCounts: "/space/availability-counts",
    smartAvailable: "/booking/smart/available",
  },
  pricing: {
    list: "/pricingplan/all",
  },
  gallery: {
    list: "/gallery/all",
  },
  contact: {
    create: "/contact",
    bookTour: "/book-tour",
  },
  payments: {
    my: "/payment/my",
    create: "/payment",
    approve: (id: number | string) => `/payment/${id}/approve`,
    updateStatus: (id: number | string) => `/payment/${id}/status`,
    card: "/payment/card",
    voucherGenerate: "/payment/voucher/generate",
    payfastInitiate: "/payment/payfast/initiate",
    payfastNotify: "/payment/payfast/notify",
  },
  locations: {
    list: "/location/all",
    paginated: "/location",
  },
  spaceConfig: {
    list: "/space-config",
    deposit: (category: string) => `/space-config/deposit/${category}`,
  },
  smartBooking: {
    create: "/booking/smart",
  },
  booking: {
    details: (id: number | string) => `/booking/${id}/details`,
    challan: (challanNumber: string) => `/booking/challan/${challanNumber}`,
    calendar: (spaceId: number, year: number, month: number) =>
      `/booking/calendar?spaceId=${spaceId}&year=${year}&month=${month}`,
    updateStatus: (id: number | string) => `/booking/${id}/status`,
    reassign: (id: number | string) => `/booking/${id}/reassign`,
    adminCreate: "/booking/create-admin",
  },
  admin: {
    dashboardSummary: "/dashboard/summary",
    recentBookings: (limit: number) => `/booking/recent?limit=${limit}`,
    recentContacts: (limit: number) => `/contact/recent?limit=${limit}`,
    users: "/user",
    spacetypes: "/spacetype",
    spacetypesAll: "/spacetype/all",
    spaces: "/space",
    bookings: "/booking",
    pricingPlans: "/pricingplan",
    pricingPlansAll: "/pricingplan/all",
    memberships: "/membership",
    payments: "/payment",
    contacts: "/contact",
    galleryAll: "/gallery/all",
    locationAll: "/location/all",
  },
} as const;
