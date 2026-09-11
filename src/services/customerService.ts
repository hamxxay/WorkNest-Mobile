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

export async function getCustomers(searchTerm?: string): Promise<CustomerRecord[]> {
  const query = searchTerm?.trim();

  const url = query
    ? `${API_ENDPOINTS.customer.list}?query=${encodeURIComponent(query)}`
    : API_ENDPOINTS.customer.list;

  return apiRequest<CustomerRecord[]>(url, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function searchCustomers(searchTerm: string): Promise<CustomerRecord[]> {
  return getCustomers(searchTerm);
}
