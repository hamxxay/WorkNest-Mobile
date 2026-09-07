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

async function buildHeaders(
  options: RequestOptions
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (options.requiresAuth) {
    const token = await getToken();
    // console.log('0-=-=-=-=-=-=-=--=-=-=',token);
    
    if (token) headers.Authorization = `Bearer ${token}`;
    const user = await getUser();
    if (user?.email) headers["X-User-Email"] = user.email;
  }
  return headers;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const requestUrl = `${API_BASE_URL}${path}`;

  const doFetch = async (headers: Record<string, string>): Promise<Response> => {
    try {
      return await fetch(requestUrl, {
        method,
        headers,
        credentials: "omit",
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Network request failed";
      throw new ApiError(`Network error calling ${requestUrl}. ${reason}`, 0, error);
    }
  };

  const parsePayload = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  };

  const extractMessage = (payload: unknown): string => {
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      const candidate = p["message"] ?? p["Message"] ?? p["title"] ?? p["detail"] ?? p["error"];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return "Request failed";
  };

  let headers = await buildHeaders(options);
  let response = await doFetch(headers);

  const shouldRetryWithoutBearerToken =
    options.requiresAuth &&
    response.status === 401 &&
    !!headers.Authorization &&
    !!(await getUser())?.email;

  if (shouldRetryWithoutBearerToken) {
    const retryHeaders = { ...headers };
    delete retryHeaders.Authorization;
    response = await doFetch(retryHeaders);
    headers = retryHeaders;
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    const message = extractMessage(payload);
    if (__DEV__) console.warn(`[API ${response.status}] ${method} ${requestUrl} — ${message}`, payload);
    throw new ApiError(message, response.status, payload);
  }

  if (options.unwrapData === false) return payload as T;
  return normalizePayload<T>(payload);
}
