import { API_BASE_URL } from "../../config/api";
import { ApiError, apiRequest, friendlyApiMessage, serverMessage } from "../apiClient";
import { getToken, getUser } from "../../utils/authStorage";
import { isEnvelope } from "./normalize";

// Transport for the staff services. Every call is authenticated (Bearer JWT + X-User-Email, via apiClient)
// and keeps the raw payload (unwrapData: false) so paged responses keep their `total`; the services normalise
// with ./normalize. Failures throw ApiError with a message that is safe to show (apiClient.friendlyApiMessage):
// screens show errorMessage(err) and never fall back to an empty list on error.

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function staffRequest<T = unknown>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method, body, requiresAuth: true, unwrapData: false });
}

export const staffGet = <T = unknown>(path: string) => staffRequest<T>(path, "GET");
/** POST; `body` defaults to {} like the CMS (ASP.NET [FromBody] parameters reject an empty body). */
export const staffPost = <T = unknown>(path: string, body: unknown = {}) => staffRequest<T>(path, "POST", body);
export const staffPut = <T = unknown>(path: string, body: unknown = {}) => staffRequest<T>(path, "PUT", body);
export const staffPatch = <T = unknown>(path: string, body: unknown = {}) => staffRequest<T>(path, "PATCH", body);
export const staffDelete = <T = unknown>(path: string) => staffRequest<T>(path, "DELETE");

/** Result of a write: the server's own success message when it sent one (ApiResponse.message). */
export type ActionResult<T = unknown> = { message: string; data: T };

/** Wraps a write response: `data` from the envelope (or the raw payload) plus a readable message. */
export function actionResult<T = unknown>(raw: unknown, fallbackMessage: string): ActionResult<T> {
  const message = serverMessage(raw) ?? fallbackMessage;
  const data = (isEnvelope(raw) ? (raw as any).data ?? null : raw) as T;
  return { message: message === "Success" ? fallbackMessage : message, data };
}

// ─── Multipart uploads ────────────────────────────────────────────────────────────────────────────────────

/** A picked file (react-native-image-picker / document picker result). */
export type UploadFile = { uri: string; name: string; type: string };

/**
 * POST multipart/form-data (e.g. a signed agreement scan). Values that are null / undefined / "" are left out;
 * an UploadFile is appended as a file. Returns the parsed JSON body; throws ApiError with a readable message.
 */
export async function staffUpload<T = unknown>(
  path: string,
  fields: Record<string, string | number | UploadFile | null | undefined>,
  timeoutMs = 120000,
): Promise<T> {
  const token = await getToken();
  const user = await getUser();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (user?.email) headers["X-User-Email"] = user.email;
  // No Content-Type: fetch sets multipart/form-data with the boundary itself.

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === "") continue;
    if (typeof value === "object") form.append(key, { uri: value.uri, name: value.name, type: value.type } as any);
    else form.append(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: form, credentials: "omit", signal: controller.signal });
  } catch (error) {
    throw new ApiError(
      controller.signal.aborted
        ? "The upload took too long. Please try again."
        : "Can't reach the server. Check your internet connection and try again.",
      0,
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  let body: any = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new ApiError(friendlyApiMessage(res.status, body), res.status, body);
  if (body && typeof body === "object" && (body.isSuccessful === false || body.success === false)) {
    throw new ApiError(serverMessage(body) ?? "Something went wrong. Please try again.", res.status, body);
  }
  return body as T;
}

// ─── Authenticated file downloads ────────────────────────────────────────────────────────────────────────
// PDFs and KYC documents need the login token, so they are fetched here (never Linking.openURL on an
// authenticated URL) and handed to the screen as a data URL that react-native-share can open or save
// (see ./files.ts).

export type DownloadedFile = {
  /** "data:<mime>;base64,..." */
  dataUrl: string;
  base64: string;
  mimeType: string;
  fileName: string;
};

const DOWNLOAD_TIMEOUT_MS = 60000;

function extensionFor(mimeType: string): string {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  return "";
}

/**
 * GET an authenticated file. `mimeType` is what the file should be treated as when the server sends a generic
 * type (application/octet-stream); a specific PDF / image type from the server wins.
 */
export async function downloadStaffFile(
  path: string,
  options: { fileName: string; mimeType?: string },
): Promise<DownloadedFile> {
  const token = await getToken();
  const user = await getUser();
  const headers: Record<string, string> = { Accept: "application/pdf, image/*, application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (user?.email) headers["X-User-Email"] = user.email;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: "GET", headers, credentials: "omit", signal: controller.signal });
  } catch (error) {
    throw new ApiError(
      controller.signal.aborted
        ? "The download took too long. Please try again."
        : "Can't reach the server. Check your internet connection and try again.",
      0,
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    throw new ApiError(friendlyApiMessage(res.status, body), res.status, body);
  }

  const serverType = (res.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (serverType === "application/json") {
    // A JSON answer to a file request is an error envelope ({ isSuccessful: false, message }).
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new ApiError(serverMessage(body) ?? "The file isn't available right now. Please try again later.", res.status, body);
  }

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new ApiError("Could not read the downloaded file.", 0));
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!base64) throw new ApiError("The downloaded file is empty.", 0);

  const specific = serverType === "application/pdf" || serverType.startsWith("image/");
  const mimeType = specific ? serverType : options.mimeType ?? "application/pdf";
  const fileName = /\.[a-z0-9]+$/i.test(options.fileName) ? options.fileName : `${options.fileName}${extensionFor(mimeType)}`;
  return { dataUrl: `data:${mimeType};base64,${base64}`, base64, mimeType, fileName };
}
