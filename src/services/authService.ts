import { removeToken, saveToken } from "../utils/authStorage";
import { apiRequest, ApiError } from "./api/client";
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from "./api/types";
import type { StoredUser } from "../utils/authStorage";

export async function logoutUser(): Promise<void> {
  await removeToken();
}

export async function hydrateSessionUser(): Promise<StoredUser | null> {
  try {
    const response = await apiRequest<ApiResponse<AuthResponse>>("/api/Auth/me", {
      method: "GET",
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
  const response = await apiRequest<ApiResponse<AuthResponse>>("/api/Auth/login", {
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
  const response = await apiRequest<ApiResponse<AuthResponse>>("/api/Auth/register", {
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
