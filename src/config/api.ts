import { NativeModules, Platform } from "react-native";

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEV_API_OVERRIDE = "https://workspace.somee.com/publish/api";

function parseHost(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const hostname = new URL(value).hostname;
    if (hostname) {
      return hostname;
    }
  } catch {
    // Fall back to manual parsing for non-standard URL strings.
  }

  const match = value.match(/\/\/(\[[^\]]+\]|[^/:]+)(?::\d+)?/);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/^\[|\]$/g, "");
}

function resolveDevApiHost(host: string): string {
  if (Platform.OS === "android" && LOCALHOST_HOSTS.has(host)) {
    return "10.0.2.2";
  }

  return host;
}

function getMetroHostFromScriptUrl(): string | null {
  if (!__DEV__) {
    return null;
  }

  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  const scriptHost = parseHost(scriptURL);
  if (scriptHost) {
    return scriptHost;
  }

  const serverHost = NativeModules?.PlatformConstants?.ServerHost as
    | string
    | undefined;
  return parseHost(serverHost);
}

function getDevApiBaseUrl() {
  if (DEV_API_OVERRIDE.trim().length > 0) {
    return DEV_API_OVERRIDE;
  }

  const metroHost = getMetroHostFromScriptUrl();

  if (metroHost) {
    return `http://${resolveDevApiHost(metroHost)}:3000/api`;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:3000/api"
    : "http://localhost:3000/api";
}

const DEV_API_BASE_URL = getDevApiBaseUrl();

const PROD_API_BASE_URL = "https://workspace.somee.com/publish/api";

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

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
    cancelBooking: (id: number) => `/booking/${id}/cancel`,
  },
  pricing: {
    list: "/pricingplan",
  },
  gallery: {
    list: "/gallery",
  },
  payments: {
    my: "/payment/my",
  },
  admin: {
    dashboardSummary: "/dashboard/summary",
    recentBookings: (limit: number) => `/booking/recent?limit=${limit}`,
    recentContacts: (limit: number) => `/contact/recent?limit=${limit}`,
    users: "/user",
  },
} as const;
