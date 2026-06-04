import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import {
  sanitizeEmailInput,
  sanitizeMessageInput,
  sanitizeNameInput,
  sanitizePhoneInput,
} from "../utils/inputSanitizer";

type ApiResponse<T> = {
  isSuccessful?: boolean;
  data?: T;
  message?: string;
};

export type ContactRequest = {
  fullName: string;
  email: string;
  phone: string;
  message: string;
};

export type ContactResponse = {
  id?: number | string;
  fullName?: string;
  email?: string;
  phone?: string;
  message?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

function ensureSuccess<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response?.isSuccessful && response.data !== undefined) {
    return response.data;
  }

  if (response?.isSuccessful) {
    return {} as T;
  }

  throw new Error(response?.message || fallbackMessage);
}

export async function createContact(payload: ContactRequest) {
  const fullName = sanitizeNameInput(payload.fullName, "Full name");
  const email = sanitizeEmailInput(payload.email);
  const phone = sanitizePhoneInput(payload.phone);
  const message = sanitizeMessageInput(payload.message);
  const response = await apiRequest<ApiResponse<ContactResponse>>(API_ENDPOINTS.contact.create, {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      fullName,
      email,
      phone,
      message,
    },
  });

  return ensureSuccess(response, "Unable to send your message right now.");
}
