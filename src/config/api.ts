import { Platform } from "react-native";
import { API_BASE } from "@env";

const ENV_API_BASE_URL = (API_BASE ?? "").trim();

/** The production API. Used when .env sets no API_BASE, and by release builds whose API_BASE is not safe. */
export const PRODUCTION_API_BASE_URL = "https://aeo.eaccounting360.com.pk/WorkNest/api";

export function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return PRODUCTION_API_BASE_URL;
  }

  const hasApiSuffix = /\/api(?:\/)?$/i.test(trimmed);
  const normalized = trimmed.replace(/\/+$/, "");

  return hasApiSuffix ? normalized : `${normalized}/api`;
}

/** Host part of an absolute URL (lower case, no port, IPv6 brackets removed), or null when it isn't one. */
function hostOf(url: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(url.trim());
  if (!match || !match[1]) return null;
  return match[1].replace(/^\[|\]$/g, "").toLowerCase();
}

/** Loopback, private-network and link-local hosts: a development machine, never the real API. */
export function isLocalNetworkHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || /^f[cd][0-9a-f]{2}:/.test(h)) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 127 || // loopback (adb reverse)
    a === 10 || // private, incl. 10.0.2.2 (emulator host)
    a === 0 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254) // link-local
  );
}

/** A base URL a release build may talk to: https, on a public host. */
export function isReleaseSafeApiUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url.trim())) return false;
  const host = hostOf(url);
  return !!host && !isLocalNetworkHost(host);
}

/**
 * The API base URL the app uses (pure, unit-tested).
 * - Development builds use API_BASE from .env as is (http://127.0.0.1:5200 through adb reverse, an ngrok
 *   tunnel...); on Android "localhost" is remapped to 10.0.2.2 so the emulator reaches the Mac.
 * - Release builds never call an http or local API: if API_BASE is not https on a public host (a .env left
 *   pointing at the local API when the release was bundled), the production API is used instead.
 */
export function selectApiBaseUrl(
  configured: string | null | undefined,
  options: { isDev: boolean; platformOS: string },
): string {
  const normalized = normalizeApiBaseUrl(configured ?? "");

  if (!options.isDev) {
    return isReleaseSafeApiUrl(normalized) ? normalized : PRODUCTION_API_BASE_URL;
  }

  // Only remap localhost for local development when the app is truly targeting a local API.
  // 127.0.0.1 is left untouched so a real device can reach the Mac via `adb reverse`.
  if (options.platformOS === "android" && /localhost/.test(normalized)) {
    return normalized.replace("localhost", "10.0.2.2");
  }

  return normalized;
}

export const API_BASE_URL = selectApiBaseUrl(ENV_API_BASE_URL, { isDev: __DEV__, platformOS: Platform.OS });
if (__DEV__) console.log("[API CONFIG] Resolved API_BASE_URL:", API_BASE_URL);

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
    /** POST /api/booking — book a specific space (customer). */
    book: "/booking",
    /** GET /api/booking/my — the signed-in customer's bookings. */
    myBookings: "/booking/my",
    /** PATCH /api/booking/{id}/cancel — customer cancels their own booking (app: Pending only, like the website). */
    cancelBooking: (id: number | string) => `/booking/${id}/cancel`,
    /** PUT /api/booking/{id} — staff only. */
    updateBooking: (id: number | string) => `/booking/${id}`,
    availableByType: "/space/available-by-type",
    availabilityCounts: "/space/availability-counts",
    smartAvailable: "/booking/smart/available",
  },
  gallery: {
    list: "/gallery/all",
  },
  contact: {
    create: "/contact",
    bookTour: "/book-tour",
    // Staff (admin / sales executive): tour inquiries with their latest feedback. The API scopes them to the
    // user's locations (plus inquiries with no branch); locationId narrows the list to one of those locations.
    list: (page: number, limit: number, search?: string, locationId?: number) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (locationId != null && Number.isInteger(locationId) && locationId > 0) params.set("locationId", String(locationId));
      return `/contact?${params.toString()}`;
    },
    feedback: (id: number | string) => `/contact/${encodeURIComponent(String(id))}/feedback`,
  },
  // Customers pay by bank challan only (1Bill / HBL), like worknestpk.com: the app never creates or
  // approves payments itself. Payment status always comes from the API.
  payments: {
    /** GET /api/payment/my — the signed-in customer's payments (status set by the API). */
    my: "/payment/my",
    /** Staff only. */
    create: "/payment",
    /** Staff only. */
    approve: (id: number | string) => `/payment/${id}/approve`,
    /** Staff only. */
    updateStatus: (id: number | string) => `/payment/${id}/status`,
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
    /** POST /api/booking/smart — customer books a category; the API picks the space and issues the challan. */
    create: "/booking/smart",
  },
  booking: {
    /** GET /api/booking — staff only (paginated). */
    list: "/booking",
    /** GET /api/booking/{id or publicId} — staff: any booking; customer: their own. */
    byId: (id: number | string) => `/booking/${id}`,
    /** GET /api/booking/{id}/challan — bank challan of a booking (customer: own bookings only). */
    challan: (bookingId: number | string) => `/booking/${bookingId}/challan`,
    /** GET /api/booking/{id}/challan-pdf — challan as PDF (needs the sign-in token). */
    challanPdf: (bookingId: number | string) => `/booking/${bookingId}/challan-pdf`,
    calendar: (spaceId: number, year: number, month: number) =>
      `/booking/calendar?spaceId=${spaceId}&year=${year}&month=${month}`,
    updateStatus: (id: number | string) => `/booking/${id}/status`,
    reassign: (id: number | string) => `/booking/${id}/reassign`,
    adminCreate: "/booking/create-admin",
  },
  quotation: {
    // General user — their own quotations (the API identifies them from the sign-in token)
    my: "/quotation/my",
    // Admin / Sales Executive — paginated, searchable list
    list: "/quotation",
    adminList: (page: number, limit: number, search?: string, locationId?: number) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (locationId != null) params.set("locationId", String(locationId));
      return `/quotation?${params.toString()}`;
    },
    create: "/quotation",
    byCustomer: (customerId: string) => `/quotation/by-customer/${customerId}`,
    byId: (id: string) => `/quotation/${id}`,
    history: (customerId: string | number, spaceId: string | number) =>
      `/quotation/history?customerId=${customerId}&spaceId=${spaceId}`,
    accept: (id: string) => `/quotation/${id}/accept`,
    decline: (id: string) => `/quotation/${id}/decline`,
    createVersion: (id: string) => `/quotation/${id}/create-version`,
    versions: (id: string) => `/quotation/${id}/versions`,
    activities: (quotationId?: string | number) =>
      quotationId != null
        ? `/quotation/activities?quotationId=${quotationId}`
        : "/quotation/activities",
    send: (id: string) => `/quotation/${id}/send`,
    /** GET /api/quotation/{id}/pdf — staff, or the customer the quotation was issued to. */
    pdf: (id: string) => `/quotation/${id}/pdf`,
    sendEmail: (id: string) => `/quotation/${id}/send-email`,
    convertToBooking: (id: string) => `/quotation/${id}/convert`,
    versionAccept: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/accept`,
    versionDecline: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/decline`,
    versionCreate: (id: string) => `/quotation/${id}/versions`,
  },
  invoices: {
    /**
     * GET /api/invoice/my — the signed-in customer's own bills (Payments tab): invoices plus booking challans that
     * have no invoice, with status (paid / unpaid / overdue), balance and totals.
     */
    my: "/invoice/my",
    /** GET /api/invoice — staff only. */
    list: "/invoice",
    /** GET /api/invoice/{id} — staff only. */
    byId: (id: number | string) => `/invoice/${id}`,
    /** GET /api/customers/{customerId}/invoices — staff only. */
    customerInvoices: (customerId: number | string) => `/customers/${customerId}/invoices`,
    /** GET /api/invoice/{id}/pdf — staff, or the customer the invoice belongs to (needs the sign-in token). */
    pdf: (id: number | string) => `/invoice/${id}/pdf`,
    statementPdf: (id: number | string) => `/invoice/${id}/statement-pdf`,
  },
  attendants: {
    list: "/attendants",
    create: "/attendants",
    update: (personId: number | string) => `/attendants/${personId}`,
    byCustomer: (customerId: number | string) => `/customers/${customerId}/attendants`,
    byBooking: (bookingDetailId: number | string) => `/bookings/${bookingDetailId}/attendants`,
    assignToBooking: (bookingDetailId: number | string) => `/bookings/${bookingDetailId}/attendants`,
    removeFromBooking: (bookingDetailId: number | string, personId: number | string) =>
      `/bookings/${bookingDetailId}/attendants/${personId}`,
    capacityCheck: (bookingDetailId: number | string) => `/bookings/${bookingDetailId}/capacity-check`,
    activeSpaces: (customerId: number | string) => `/customers/${customerId}/active-spaces`,
  },
  // Signed-in app users (MobileAnnouncementController).
  mobile: {
    /** POST /api/mobile/device-token { token, platform } — FCM token for push notifications. */
    deviceToken: "/mobile/device-token",
    /** GET /api/mobile/announcements?page=&limit= — the user's announcements (isRead per user). */
    announcements: (page = 1, limit = 20) => `/mobile/announcements?page=${page}&limit=${limit}`,
    /** POST /api/mobile/announcements/{id}/read */
    announcementRead: (id: string) => `/mobile/announcements/${encodeURIComponent(id)}/read`,
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
    memberships: "/membership",
    payments: "/payment",
    contacts: "/contact",
    galleryAll: "/gallery/all",
    locationAll: "/location/all",
  },
  customer: {
    create: "/customer",
    list: "/customer",
    search: "/customer/search",
  },
  kyc: {
    /** GET /api/kyc — staff: customers with KYC counts (admin, super admin, sales executive) */
    list: (page = 1, limit = 20, search?: string) => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(limit));
      if (search) p.set("search", search);
      return `/kyc?${p.toString()}`;
    },
    /** GET /api/kyc/{customerId or guid} — checklist, document types, uploaded documents */
    customer: (customerIdOrGuid: number | string) => `/kyc/${encodeURIComponent(String(customerIdOrGuid))}`,
    /** POST /api/kyc/upload  multipart/form-data: CustomerId, DocumentTypeId, SlotNo, HolderName?, ExpiryDate?, File */
    upload: "/kyc/upload",
  },
  agreement: {
    /** GET /api/Agreement — admin paginated list */
    list: (page = 1, limit = 10, search?: string, status?: string) => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(limit));
      if (search) p.set("search", search);
      if (status) p.set("status", status);
      return `/Agreement?${p.toString()}`;
    },
    /** GET /api/Agreement/my — customer's own agreements */
    my: "/Agreement/my",
    /** GET /api/Agreement/my/{id}/pdf */
    myPdf: (id: number | string) => `/Agreement/my/${id}/pdf`,
    /** GET /api/Agreement/my/{id}/signed-pdf */
    mySignedPdf: (id: number | string) => `/Agreement/my/${id}/signed-pdf`,
    /** POST /api/Agreement/my/{id}/upload-signed  multipart/form-data */
    myUploadSigned: (id: number | string) => `/Agreement/my/${id}/upload-signed`,
    /** POST /api/Agreement/my/{id}/esign — customer signs electronically */
    myESign: (id: number | string) => `/Agreement/my/${id}/esign`,
    /** GET /api/Agreement/{id}/pdf — admin download */
    pdf: (id: number | string) => `/Agreement/${id}/pdf`,
    /** POST /api/Agreement/{id}/mark-signed — admin mark as signed */
    markSigned: (id: number | string) => `/Agreement/${id}/mark-signed`,
    /** POST /api/Agreement/{id}/sign — admin: upload scan + create booking */
    sign: (id: number | string) => `/Agreement/${id}/sign`,
    /** POST /api/Agreement/{id}/upload-signed — admin upload */
    uploadSigned: (id: number | string) => `/Agreement/${id}/upload-signed`,
    /** GET  /api/Agreement/{id}/signed-pdf — admin get signed pdf */
    signedPdf: (id: number | string) => `/Agreement/${id}/signed-pdf`,
    /** DELETE /api/Agreement/{id}/signed-pdf */
    deleteSignedPdf: (id: number | string) => `/Agreement/${id}/signed-pdf`,
    /** DELETE /api/Agreement/{id} */
    delete: (id: number | string) => `/Agreement/${id}`,
    /** POST /api/Agreement/send — generate & send agreement */
    send: "/Agreement/send",
  },
} as const;
