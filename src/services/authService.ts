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
      unwrapData: false,
    });

    const payload =
      response && typeof response === "object" && "isSuccessful" in response
        ? (response as ApiResponse<AuthResponse>)
        : { isSuccessful: true, message: null, data: response as AuthResponse };

    if (!payload.isSuccessful || !payload.data) {
      return null;
    }

    return {
      id: payload.data.userId || undefined,
      email: payload.data.email || undefined,
      name: payload.data.email || undefined, // assuming name is email or something, adjust as needed
      roles: payload.data.roles || undefined,
    };
  } catch {
    return null;
  }
}

export async function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  const response = await apiRequest<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: payload,
    unwrapData: false,
  });

  const normalized =
    response && typeof response === "object" && "isSuccessful" in response
      ? (response as ApiResponse<AuthResponse>)
      : { isSuccessful: true, message: null, data: response as AuthResponse };

  if (!normalized.isSuccessful || !normalized.data) {
    throw new ApiError(normalized.message || "Login failed.", 401);
  }

  if (normalized.data.token) {
    await saveToken(normalized.data.token);
  }

  return normalized.data;
}

export async function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.signup, {
    method: "POST",
    body: payload,
    unwrapData: false,
  });

  const normalized =
    response && typeof response === "object" && "isSuccessful" in response
      ? (response as ApiResponse<AuthResponse>)
      : { isSuccessful: true, message: null, data: response as AuthResponse };

  if (!normalized.isSuccessful || !normalized.data) {
    throw new ApiError(normalized.message || "Registration failed.", 400);
  }

  if (normalized.data.token) {
    await saveToken(normalized.data.token);
  }

  return normalized.data;
}
