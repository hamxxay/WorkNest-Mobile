import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

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
  const response = await apiRequest<ApiResponse<unknown>>(API_ENDPOINTS.contact.create, {
    method: "POST",
    requiresAuth: true,
    unwrapData: false,
    body: {
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      message: payload.message.trim(),
    },
  });

  return ensureSuccess(response, "Unable to send your message right now.");
}
