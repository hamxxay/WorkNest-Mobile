import { API_BASE_URL } from "../config/api";
import { getToken, getUser } from "../utils/authStorage";


type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  requiresAuth?: boolean;
  headers?: Record<string, string>;
  unwrapData?: boolean;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function normalizePayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    // .NET MVC envelope: { isSuccessful, data, message }
    if ("isSuccessful" in p && p.data !== undefined) {
      return p.data as T;
    }
    // Generic { data: ... } envelope
    if ("data" in p && p.data !== undefined) {
      return p.data as T;
    }
  }
  return payload as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (options.requiresAuth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const user = await getUser();
    if (user && user.email) {
      headers["X-User-Email"] = user.email;
    }
  }

  const requestUrl = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      credentials: "omit",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(
      `Network error calling ${requestUrl}. ${reason}`,
      0,
      error
    );
  }

  let payload: unknown = null;
  const responseText = await response.text();
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    let message = "Request failed";
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      // .NET MVC / ASP.NET Core error shapes
      const candidate =
        p["message"] ?? p["Message"] ?? p["title"] ?? p["detail"] ?? p["error"];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        message = candidate;
      }
    }
    if (__DEV__) {
      console.warn(`[API ${response.status}] ${message}`, payload);
    }
    throw new ApiError(message, response.status, payload);
  }

  if (options.unwrapData === false) {
    return payload as T;
  }

  return normalizePayload<T>(payload);
}
