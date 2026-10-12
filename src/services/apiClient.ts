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

// ─── Session expiry ──────────────────────────────────────────────────────────
// One shared mechanism for "the API refused our token": apiClient announces it, authService ends the
// session (Firebase sign-out + stored token/user removed) and the navigators send the user to Login.

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();
/** A burst of parallel 401s (a screen loading several lists) must end the session once, not five times. */
const SESSION_EXPIRED_DEBOUNCE_MS = 3000;
let lastSessionExpiredAt = 0;

/** Subscribe to "the signed-in session is no longer accepted by the API". Returns the unsubscribe function. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** Tells every listener that the session ended. Repeated calls within a few seconds are ignored. */
export function notifySessionExpired(): void {
  const now = Date.now();
  if (now - lastSessionExpiredAt < SESSION_EXPIRED_DEBOUNCE_MS) return;
  lastSessionExpiredAt = now;
  for (const listener of Array.from(sessionExpiredListeners)) {
    try {
      listener();
    } catch (error) {
      if (__DEV__) console.warn("[API] session-expired listener failed", error);
    }
  }
}

/** Test helper: forget the debounce so the next 401 is reported again. */
export function resetSessionExpiredState(): void {
  lastSessionExpiredAt = 0;
}

/**
 * Sign-in endpoints (/auth/login, /auth/google-login, /auth/me, ...) answer 401 as part of their own flow
 * (wrong account, not verified yet): the screens show that message, so they never end the session here.
 * Same rule as the website's auth interceptor.
 */
export function isAuthEndpoint(path: string): boolean {
  return /^\/?auth(?:\/|\?|$)/i.test(path.trim());
}

/** A 401 on a request that carried our token, outside the sign-in endpoints, means the session is over. */
function reportIfSessionExpired(status: number, path: string, sentToken: boolean): void {
  if (status === 401 && sentToken && !isAuthEndpoint(path)) notifySessionExpired();
}

// ─── Session refresh ─────────────────────────────────────────────────────────
// The API token (JWT) can expire while Firebase still has the user signed in (e.g. the app was in the
// background for a day). Before ending the session on a 401, authService gets one chance to exchange the
// Firebase sign-in for a new API token; the refused request is then sent once more with it.

/**
 * Returns a new API token, or null when the session can't be renewed (signed out, account turned off).
 * Throws when it could not even try (e.g. no network): the session is then kept and only the request fails.
 */
type SessionRefresher = () => Promise<string | null>;
let sessionRefresher: SessionRefresher | null = null;
let refreshInFlight: Promise<string | null> | null = null;

/** Registered by authService at start-up. */
export function setSessionRefresher(refresher: SessionRefresher | null): void {
  sessionRefresher = refresher;
}

/** One refresh at a time: parallel 401s share it (and its outcome). */
function refreshSessionOnce(): Promise<string | null> {
  if (!sessionRefresher) return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = sessionRefresher().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Sends a request; on a 401 for a token we sent (outside the sign-in endpoints) renews the session once and
 * re-sends with the new token. A 401 that remains ends the session for the whole app.
 * (Re-sending is safe: the API refuses an unauthenticated request before doing any work.)
 */
async function sendWithSessionRefresh(
  path: string,
  headers: Record<string, string>,
  send: (headers: Record<string, string>) => Promise<Response>,
): Promise<Response> {
  let response = await send(headers);
  let sentHeaders = headers;
  if (response.status === 401 && headers.Authorization && !isAuthEndpoint(path)) {
    let fresh: string | null;
    try {
      fresh = await refreshSessionOnce();
    } catch {
      // Could not reach the sign-in service: keep the session, only this request fails.
      return response;
    }
    if (fresh && `Bearer ${fresh}` !== headers.Authorization) {
      sentHeaders = { ...headers, Authorization: `Bearer ${fresh}` };
      response = await send(sentHeaders);
    }
  }
  reportIfSessionExpired(response.status, path, !!sentHeaders.Authorization);
  return response;
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
/** PDFs are generated on the server and can take longer than a JSON call. */
const FILE_TIMEOUT_MS = 60000;

/** fetch with a time limit: a request that never answers would otherwise leave a spinner forever. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, credentials: "omit", signal: controller.signal });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    if (__DEV__) console.warn(`[API] ${init.method ?? "GET"} ${url} failed`, error);
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
}

async function parsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/** Throws a readable ApiError for a failed response (the API's own message when it sent one). */
function throwForStatus(response: Response, payload: unknown, method: string, url: string): never {
  let message = friendlyApiMessage(response.status, payload);
  if (response.status === 429 && !serverMessage(payload)) {
    const wait = Number(response.headers?.get?.("Retry-After"));
    if (wait > 0) message = `Too many attempts. Please wait ${wait} seconds and try again.`;
  }
  if (__DEV__) console.warn(`[API ${response.status}] ${method} ${url} — ${message}`);
  throw new ApiError(message, response.status, payload);
}

/**
 * The API refuses with 200 + { isSuccessful: false, data: null, message } (e.g. "Your access is turned off").
 * Treat it as an error carrying that message, so screens never get null data to read from.
 */
function throwIfRefused(response: Response, payload: unknown): void {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (p["isSuccessful"] === false || p["IsSuccessful"] === false || p["success"] === false) {
      throw new ApiError(serverMessage(payload) ?? FALLBACK_MESSAGE, response.status, payload);
    }
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const requestUrl = `${API_BASE_URL}${path}`;

  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const response = await sendWithSessionRefresh(path, await buildHeaders(options), headers =>
    fetchWithTimeout(requestUrl, { method, headers, body }, REQUEST_TIMEOUT_MS),
  );

  const payload = await parsePayload(response);
  if (!response.ok) throwForStatus(response, payload, method, requestUrl);
  throwIfRefused(response, payload);

  if (options.unwrapData === false) return payload as T;
  return normalizePayload<T>(payload);
}

// ─── Files: authenticated downloads and uploads ───────────────────────────────
// Challan, agreement and invoice PDFs need the sign-in token, so they are always fetched here and handed
// to the share / viewer sheet. Never open an authenticated API URL with Linking.openURL: the browser has no token.

export type DownloadedFile = {
  /** File contents, base64 encoded. */
  base64: string;
  /** MIME type sent by the server (application/octet-stream normalised by callers when they know better). */
  contentType: string;
  /** File name from Content-Disposition, when the server sent one. */
  fileName: string | null;
};

/** File name from a Content-Disposition header (filename*=UTF-8''... or filename="..."). */
export function fileNameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? "");
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new ApiError("The file could not be read. Please try again.", 0));
    reader.readAsDataURL(blob);
  });
}

/** Error body of a failed download: JSON when the API sent a message, otherwise nothing worth showing. */
async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    return await parsePayload(response);
  } catch {
    return null;
  }
}

/**
 * GET a file from the API with the sign-in token (Bearer). Throws a readable ApiError on failure,
 * and reports an expired session like any other request.
 */
export async function apiDownload(
  path: string,
  options: { accept?: string } = {},
): Promise<DownloadedFile> {
  const requestUrl = `${API_BASE_URL}${path}`;
  const headers = await buildHeaders({
    requiresAuth: true,
    headers: { Accept: options.accept ?? "application/pdf, application/json" },
  });
  delete headers["Content-Type"];

  const response = await sendWithSessionRefresh(path, headers, sendHeaders =>
    fetchWithTimeout(requestUrl, { method: "GET", headers: sendHeaders }, FILE_TIMEOUT_MS),
  );
  if (!response.ok) {
    const payload = await readErrorPayload(response);
    if (response.status === 429 && !serverMessage(payload)) {
      throw new ApiError("Too many downloads. Please wait a minute and try again.", 429, payload);
    }
    throwForStatus(response, payload, "GET", requestUrl);
  }

  const contentType = response.headers?.get?.("Content-Type") ?? "";
  if (/json/i.test(contentType)) {
    // A JSON body where a file was expected is a refusal ({ isSuccessful: false, message }).
    const payload = await readErrorPayload(response);
    throwIfRefused(response, payload);
    throw new ApiError("The file isn't available right now. Please try again later.", response.status, payload);
  }

  const base64 = await blobToBase64(await response.blob());
  if (!base64) throw new ApiError("The file is empty. Please try again later.", response.status);
  return {
    base64,
    contentType: contentType.split(";")[0].trim() || "application/octet-stream",
    fileName: fileNameFromDisposition(response.headers?.get?.("Content-Disposition")),
  };
}

/**
 * POST multipart/form-data with the sign-in token (e.g. a signed agreement PDF).
 * No Content-Type header: React Native sets multipart/form-data with the boundary itself.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  options: { unwrapData?: boolean } = {},
): Promise<T> {
  const requestUrl = `${API_BASE_URL}${path}`;
  const headers = await buildHeaders({ requiresAuth: true });
  delete headers["Content-Type"];

  const response = await sendWithSessionRefresh(path, headers, sendHeaders =>
    fetchWithTimeout(requestUrl, { method: "POST", headers: sendHeaders, body: form }, FILE_TIMEOUT_MS),
  );

  const payload = await parsePayload(response);
  if (!response.ok) throwForStatus(response, payload, "POST", requestUrl);
  throwIfRefused(response, payload);

  if (options.unwrapData === false) return payload as T;
  return normalizePayload<T>(payload);
}
