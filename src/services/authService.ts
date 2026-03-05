import { removeToken, saveToken } from "../utils/authStorage";
import { apiRequest, ApiError } from "./api/client";
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from "./api/types";

export async function logoutUser(): Promise<void> {
  await removeToken();
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
