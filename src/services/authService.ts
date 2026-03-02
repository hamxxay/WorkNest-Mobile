import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import {
  clearAuthStorage,
  saveUser,
  saveRefreshToken,
  saveToken,
  type StoredUser,
} from "../utils/authStorage";

type AuthResponse = {
  token?: string;
  accessToken?: string;
  access_token?: string;
  authToken?: string;
  jwt?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: StoredUser;
  email?: string;
  userId?: string;
  roles?: string[];
  role?: string;
  isAdmin?: boolean;
  data?: {
    token?: string;
    accessToken?: string;
    access_token?: string;
    authToken?: string;
    jwt?: string;
    refreshToken?: string;
    refresh_token?: string;
    user?: StoredUser;
    email?: string;
    userId?: string;
    roles?: string[];
    role?: string;
    isAdmin?: boolean;
  };
  result?: {
    token?: string;
    accessToken?: string;
    access_token?: string;
    authToken?: string;
    jwt?: string;
    refreshToken?: string;
    refresh_token?: string;
    user?: StoredUser;
    email?: string;
    userId?: string;
    roles?: string[];
    role?: string;
    isAdmin?: boolean;
  };
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

function resolveAccessToken(response: AuthResponse): string | null {
  return (
    response.token ??
    response.accessToken ??
    response.access_token ??
    response.authToken ??
    response.jwt ??
    response.data?.token ??
    response.data?.accessToken ??
    response.data?.access_token ??
    response.data?.authToken ??
    response.data?.jwt ??
    response.result?.token ??
    response.result?.accessToken ??
    response.result?.access_token ??
    response.result?.authToken ??
    response.result?.jwt ??
    null
  );
}

function resolveRefreshToken(response: AuthResponse): string | null {
  return (
    response.refreshToken ??
    response.refresh_token ??
    response.data?.refreshToken ??
    response.data?.refresh_token ??
    response.result?.refreshToken ??
    response.result?.refresh_token ??
    null
  );
}

function resolveUser(response: AuthResponse): StoredUser | null {
  const explicit =
    response.user ?? response.data?.user ?? response.result?.user ?? null;
  if (explicit) {
    return explicit;
  }

  const source = response.data ?? response.result ?? response;
  if (!source) {
    return null;
  }

  const derivedUser: StoredUser = {
    id: source.userId,
    email: source.email,
    role: source.role,
    roles: source.roles,
    isAdmin: source.isAdmin,
  };

  const hasAnyField = Boolean(
    derivedUser.id ||
      derivedUser.email ||
      derivedUser.role ||
      (Array.isArray(derivedUser.roles) && derivedUser.roles.length > 0) ||
      derivedUser.isAdmin === true
  );

  return hasAnyField ? derivedUser : null;
}

async function persistAuthSession(response: AuthResponse): Promise<void> {
  const token = resolveAccessToken(response);
  if (token) {
    await saveToken(token);
  }
  const refreshToken = resolveRefreshToken(response);
  if (refreshToken) {
    await saveRefreshToken(refreshToken);
  }
  const user = resolveUser(response);
  if (user) {
    await saveUser(user);
  }

  if (!token && !user) {
    throw new Error("Authentication response did not include session details.");
  }
}

export async function loginUser(payload: LoginPayload): Promise<void> {
  const response = await apiRequest<AuthResponse>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: payload,
    unwrapData: false,
  });

  await persistAuthSession(response);
}

export async function signupUser(payload: SignupPayload): Promise<void> {
  const fullName = payload.name.trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? fullName;
  const lastName = nameParts.slice(1).join(" ") || undefined;

  const response = await apiRequest<AuthResponse>(API_ENDPOINTS.auth.signup, {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
      firstName,
      lastName,
    },
    unwrapData: false,
  });

  await persistAuthSession(response);
}

export async function logoutUser(): Promise<void> {
  try {
    await apiRequest(API_ENDPOINTS.auth.logout, {
      method: "POST",
      requiresAuth: true,
    });
  } catch {
    // Always clear local session even if remote logout fails.
  }

  await clearAuthStorage();
}

export async function hydrateSessionUser(): Promise<StoredUser | null> {
  try {
    const response = await apiRequest<AuthResponse>(API_ENDPOINTS.auth.profile, {
      requiresAuth: true,
      unwrapData: false,
    });
    await persistAuthSession(response);
    const user = resolveUser(response);
    if (user) {
      await saveUser(user);
      return user;
    }
  } catch {
    // Keep local user as-is when session probe fails.
  }

  return null;
}
