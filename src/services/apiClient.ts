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

/** Plain-language message per HTTP status, used when the API sent no readable message of its own. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Some of the details aren't valid. Please check them and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do this.",
  404: "This isn't available right now. Please try again later.",
  405: "This isn't available right now. Please try again later.",
  408: "The server took too long to respond. Please try again.",
  409: "This was changed by someone else. Refresh and try again.",
  413: "The file is too large. Please choose a smaller file.",
  415: "This file type isn't supported.",
  422: "Some of the details aren't valid. Please check them and try again.",
  429: "Too many attempts. Please wait a minute and try again.",
  500: "Something went wrong on our side. Please try again in a moment.",
  502: "The service is temporarily unavailable. Please try again in a few minutes.",
  503: "The service is temporarily unavailable. Please try again in a few minutes.",
  504: "The server took too long to respond. Please try again.",
};
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Text that must never reach the screen: framework errors, stack traces, SQL, HTML pages, URLs. */
const TECHNICAL_TEXT = /http failure|exception|stack ?trace|\bat [A-Z][\w.]+\(|\bsql\b|object reference|timeout expired|<!doctype|<html|https?:\/\/|\bnull\b|undefined/i;

const isShowable = (text: unknown): text is string =>
  typeof text === "string" && text.trim().length > 0 && text.length <= 300 && !TECHNICAL_TEXT.test(text);

/** The API's own message, if it sent a readable one ({ message }, ProblemDetails, validation errors, plain text). */
export function serverMessage(payload: unknown): string | null {
  if (isShowable(payload)) return payload.trim();
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, any>;
  for (const key of ["message", "Message", "errorMessage", "ErrorMessage", "error", "detail", "title"]) {
    if (isShowable(p[key])) return p[key].trim();
  }
  if (p.errors && typeof p.errors === "object") {
    for (const value of Object.values(p.errors)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (isShowable(first)) return first.trim();
    }
  }
  return null;
}

/** A message that is safe and useful to show the user for a failed request. */
export function friendlyApiMessage(status: number, payload: unknown): string {
  return serverMessage(payload) ?? STATUS_MESSAGES[status] ?? (status >= 500 ? STATUS_MESSAGES[500] : FALLBACK_MESSAGE);
}

/** Readable text for any error a screen catches (API errors are already readable; others get a generic line). */
export function errorMessage(error: unknown, fallback = FALLBACK_MESSAGE): string {
  if (error instanceof ApiError) return error.message;
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return isShowable(text) ? text : fallback;
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
    let message = friendlyApiMessage(response.status, payload);
    if (response.status === 429 && !serverMessage(payload)) {
      const wait = Number(response.headers.get("Retry-After"));
      if (wait > 0) message = `Too many attempts. Please wait ${wait} seconds and try again.`;
    }
    if (__DEV__) console.warn(`[API ${response.status}] ${method} ${requestUrl} — ${message}`, payload);
    throw new ApiError(message, response.status, payload);
  }

  // The API refuses with 200 + { isSuccessful: false, data: null, message } (e.g. "Your access is turned off").
  // Treat it as an error carrying that message, so screens never get null data to read from.
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (p["isSuccessful"] === false || p["IsSuccessful"] === false || p["success"] === false) {
      throw new ApiError(serverMessage(payload) ?? FALLBACK_MESSAGE, response.status, payload);
    }
  }

  if (options.unwrapData === false) return payload as T;
  return normalizePayload<T>(payload);
}
