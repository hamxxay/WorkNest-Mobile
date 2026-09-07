import { Platform } from "react-native";
import { API_BASE } from "@env";

const ENV_API_BASE_URL = (API_BASE ?? "").trim();

export function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "https://aeo.eaccounting360.com.pk/WorkNest/api";
  }

  const hasApiSuffix = /\/api(?:\/)?$/i.test(trimmed);
  const normalized = trimmed.replace(/\/+$/, "");

  return hasApiSuffix ? normalized : `${normalized}/api`;
}

function resolveApiBaseUrl(): string {
  const base = ENV_API_BASE_URL || "https://aeo.eaccounting360.com.pk/WorkNest/api";
  const normalized = normalizeApiBaseUrl(base);

  // Only remap localhost/127.0.0.1 for local development when the app is truly targeting a local API.
  if (Platform.OS === "android" && /localhost|127\.0\.0\.1/.test(normalized)) {
    return normalized.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }

  return normalized;
}

export const API_BASE_URL = resolveApiBaseUrl();
console.log("[API CONFIG] Resolved API_BASE_URL:", API_BASE_URL);

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
  quotation: {
    list: "/quotation",
    byCustomer: (customerId: string) => `/quotation/by-customer/${customerId}`,
    byId: (id: string) => `/quotation/${id}`,
    accept: (id: string) => `/quotation/${id}/accept`,
    decline: (id: string) => `/quotation/${id}/decline`,
    createVersion: (id: string) => `/quotation/${id}/create-version`,
    versions: (id: string) => `/quotation/${id}/versions`,
    activities: "/quotation/activities",
    send: (id: string) => `/quotation/${id}/send`,
    versionAccept: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/accept`,
    versionDecline: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/decline`,
    versionCreate: (id: string) => `/quotation/${id}/versions`,
  },
  invoices: {
    list: "/invoices",
    byId: (id: number | string) => `/invoices/${id}`,
  },
  attendants: {
    list: "/attendants",
    byBooking: (bookingId: number | string) => `/bookings/${bookingId}/attendants`,
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
