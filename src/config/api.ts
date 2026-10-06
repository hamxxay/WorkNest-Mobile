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
    list: "/booking",
    byId: (id: number | string) => `/booking/${id}`,
    details: (id: number | string) => `/booking/${id}/details`,
    challan: (challanNumber: string) => `/booking/challan/${challanNumber}`,
    calendar: (spaceId: number, year: number, month: number) =>
      `/booking/calendar?spaceId=${spaceId}&year=${year}&month=${month}`,
    updateStatus: (id: number | string) => `/booking/${id}/status`,
    reassign: (id: number | string) => `/booking/${id}/reassign`,
    adminCreate: "/booking/create-admin",
  },
  quotation: {
    // General user — fetches MY quotations using x-user-email header
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
    sendEmail: (id: string) => `/quotation/${id}/send-email`,
    convertToBooking: (id: string) => `/quotation/${id}/convert`,
    versionAccept: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/accept`,
    versionDecline: (id: string, version: number | string) =>
      `/quotation/${id}/versions/${version}/decline`,
    versionCreate: (id: string) => `/quotation/${id}/versions`,
  },
  invoices: {
    list: "/invoices",
    byId: (id: number | string) => `/invoices/${id}`,
    byCustomer: (customerId: number | string) => `/invoice/customer/${customerId}`,
    customerInvoices: (customerId: number | string) => `/customers/${customerId}/invoices`,
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
  customer: {
    create: "/customer",
    list: "/customer",
    search: "/customer/search",
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
