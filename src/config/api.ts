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
  },
  workspaces: {
    list: "/space",
    book: "/booking",
    myBookings: "/booking/my",
    cancelBooking: (id: number | string) => `/booking/${id}/cancel`,
    updateBooking: (id: number | string) => `/booking/${id}`,
  },
  pricing: {
    list: "/pricingplan",
  },
  gallery: {
    list: "/gallery",
  },
  contact: {
    create: "/contact",
  },
  payments: {
    my: "/payment/my",
    approve: (id: number | string) => `/payment/${id}/approve`,
  },
  locations: {
    list: "/location",
  },
  spaceConfig: {
    list: "/space-config",
    deposit: (category: string) => `/space-config/deposit/${category}`,
  },
  smartBooking: {
    create: "/booking/smart",
  },
  admin: {
    dashboardSummary: "/dashboard/summary",
    recentBookings: (limit: number) => `/booking/recent?limit=${limit}`,
    recentContacts: (limit: number) => `/contact/recent?limit=${limit}`,
    users: "/user",
  },
} as const;
