import { removeToken, saveToken } from "../utils/authStorage";
import { apiRequest, ApiError } from "./apiClient";
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from "./api/types";
import type { StoredUser } from "../utils/authStorage";
import { API_ENDPOINTS } from "../config/api";

export async function logoutUser(): Promise<void> {
  await removeToken();
}

export async function hydrateSessionUser(): Promise<StoredUser | null> {
  try {
    const response = await apiRequest<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.profile, {
      method: "GET",
      requiresAuth: true,
    });

    if (!response.isSuccessful || !response.data) {
      return null;
    }

    return {
      id: response.data.userId || undefined,
      email: response.data.email || undefined,
      name: response.data.email || undefined, // assuming name is email or something, adjust as needed
      roles: response.data.roles || undefined,
    };
  } catch {
    return null;
  }
}

export async function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  const response = await apiRequest<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: payload,
  });

  if (!response.isSuccessful || !response.data) {
    throw new ApiError(response.message || "Login failed.", 401);
  }

  if (response.data.token) {
    await saveToken(response.data.token);
  }

  return response.data;
}

export async function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.signup, {
    method: "POST",
    body: payload,
  });

  if (!response.isSuccessful || !response.data) {
    throw new ApiError(response.message || "Registration failed.", 400);
  }

  if (response.data.token) {
    await saveToken(response.data.token);
  }

  return response.data;
}
