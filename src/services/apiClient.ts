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
    if (token) headers.Authorization = `Bearer ${token}`;
    const user = await getUser();
    if (user?.email) {
      headers["X-User-Email"] = user.email;
      headers["x-user-email"] = user.email;
    }
  }
  return headers;
}

/** How long a request may take before the app gives up and shows an error. */
const REQUEST_TIMEOUT_MS = 20000;

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const requestUrl = `${API_BASE_URL}${path}`;

  const doFetch = async (headers: Record<string, string>): Promise<Response> => {
    // A request that never answers would leave a spinner forever: give up after REQUEST_TIMEOUT_MS.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(requestUrl, {
        method,
        headers,
        credentials: "omit",
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      if (__DEV__) console.warn(`[API] ${method} ${requestUrl} failed`, error);
      throw new ApiError(
        timedOut
          ? "The server took too long to respond. Please try again."
          : "Can't reach the server. Check your internet connection and try again.",
        0,
        error,
      );
    } finally {
      clearTimeout(timer);
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
    path.includes("auth/me") &&
    !!(await getUser())?.email;

  if (shouldRetryWithoutBearerToken) {
    const retryHeaders = { ...headers };
    delete retryHeaders.Authorization;
    response = await doFetch(retryHeaders);
    headers = retryHeaders;
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    let message = extractMessage(payload);
    if (response.status === 429 && message === "Request failed") {
      const wait = Number(response.headers.get("Retry-After"));
      message = wait > 0
        ? `Too many attempts. Please wait ${wait} seconds and try again.`
        : "Too many attempts. Please wait a minute and try again.";
    }
    if (__DEV__) console.warn(`[API ${response.status}] ${method} ${requestUrl} — ${message}`, payload);
    throw new ApiError(message, response.status, payload);
  }

  // The API refuses with 200 + { isSuccessful: false, data: null, message } (e.g. "Your access is turned off").
  // Treat it as an error carrying that message, so screens never get null data to read from.
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (p["isSuccessful"] === false || p["IsSuccessful"] === false || p["success"] === false) {
      throw new ApiError(extractMessage(payload) === "Request failed" ? "Something went wrong. Please try again." : extractMessage(payload), response.status, payload);
    }
  }

  if (options.unwrapData === false) return payload as T;
  return normalizePayload<T>(payload);
}
