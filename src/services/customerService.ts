import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizeNotesInput,
  sanitizePhoneInput,
  sanitizeTextForState,
} from "../utils/inputSanitizer";

export type CustomerPayload = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phoneNumber: string;
  cnicOrPassport: string;
  address: string;
  cityId: number;
  notes: string;
  isActive: boolean;
};

export type CustomerRecord = {
  id?: number | string;
  customerId?: number | string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phoneNumber?: string;
  cnicOrPassport?: string;
  address?: string;
  cityId?: number;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeCustomerPayload(payload: CustomerPayload): CustomerPayload {
  return {
    firstName: sanitizeNameInput(payload.firstName, "First name"),
    lastName: sanitizeNameInput(payload.lastName, "Last name"),
    company: sanitizeTextForState(payload.company ?? "", {
      maxLength: 80,
      collapse: true,
    }).trim(),
    email: sanitizeEmailInput(payload.email),
    phoneNumber: sanitizePhoneInput(payload.phoneNumber, "Phone number"),
    cnicOrPassport: sanitizeTextForState(payload.cnicOrPassport ?? "", {
      maxLength: 40,
      collapse: true,
    }).trim(),
    address: sanitizeTextForState(payload.address ?? "", {
      maxLength: 200,
      multiline: true,
      collapse: true,
    }).trim(),
    cityId: Number.isFinite(Number(payload.cityId)) ? Number(payload.cityId) : 0,
    notes: sanitizeNotesInput(payload.notes ?? ""),
    isActive: payload.isActive !== false,
  };
}

export async function createCustomer(payload: CustomerPayload): Promise<CustomerRecord> {
  const cleaned = normalizeCustomerPayload(payload);

  return apiRequest<CustomerRecord>(API_ENDPOINTS.customer.create, {
    method: "POST",
    requiresAuth: true,
    body: cleaned,
  });
}

/**
 * GET /api/customer?page=&limit=&search= (CustomerController.List). The API reads `search` (it used to be sent
 * as `query`, which the API ignored, so searching returned the unfiltered first page). The API returns a bare
 * array without a total; for paging use listCustomers in services/staff/customers.ts.
 */
export async function getCustomers(searchTerm?: string, page = 1, limit = 20): Promise<CustomerRecord[]> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  const search = searchTerm?.trim();
  if (search) params.set("search", search);

  return apiRequest<CustomerRecord[]>(`${API_ENDPOINTS.customer.list}?${params.toString()}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function searchCustomers(searchTerm: string): Promise<CustomerRecord[]> {
  return getCustomers(searchTerm);
}
