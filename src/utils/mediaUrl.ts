import { API_BASE_URL } from "../config/api";

function getApiBaseParts(): { origin: string; appBasePath: string } {
  try {
    const parsed = new URL(API_BASE_URL);
    const apiPath = parsed.pathname.replace(/\/+$/, "");
    const appBasePath = apiPath.replace(/\/api$/i, "");
    return { origin: parsed.origin, appBasePath };
  } catch {
    return { origin: "", appBasePath: "" };
  }
}

function cleanPath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^wwwroot\/+/i, "")
    .trim();
}

export function resolveMediaUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const input = cleanPath(value);
  if (!input) {
    return null;
  }

  if (input.startsWith("data:")) {
    return input;
  }

  if (input.startsWith("//")) {
    return encodeLoose(`https:${input}`);
  }

  // A full URL from the API is used as it is (already encoded: %2F must stay %2F, and http stays http); only raw
  // spaces are encoded.
  if (/^https?:\/\/[^/\s]/i.test(input)) {
    return input.replace(/ /g, "%20");
  }
  if (/^https?:/i.test(input)) {
    return null; // "http://" without a host
  }

  if (/^www\./i.test(input)) {
    return encodeLoose(`https://${input}`);
  }

  const { origin, appBasePath } = getApiBaseParts();
  if (!origin) {
    return null;
  }

  const normalizedPath = input.startsWith("/") ? input : `/${input}`;
  const lowerPath = normalizedPath.toLowerCase();
  const lowerBase = appBasePath.toLowerCase();
  const shouldPrefixBase =
    appBasePath.length > 0 &&
    lowerPath !== lowerBase &&
    !lowerPath.startsWith(`${lowerBase}/`);
  const finalPath = shouldPrefixBase
    ? `${appBasePath}${normalizedPath}`
    : normalizedPath;

  return encodeLoose(`${origin}${finalPath}`);
}

/**
 * encodeURI for a path the API sent raw (spaces, non-ASCII file names) that keeps escapes already in it: "a%2Fb"
 * stays "a%2Fb" (encodeURI alone would turn it into "a%252Fb").
 */
function encodeLoose(url: string): string {
  try {
    return encodeURI(url).replace(/%25([0-9A-Fa-f]{2})/g, "%$1");
  } catch {
    return url.replace(/ /g, "%20");
  }
}
