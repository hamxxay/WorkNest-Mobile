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
    return `https:${input}`;
  }

  if (/^https?:\/\//i.test(input)) {
    try {
      const direct = new URL(input);
      const finalUrl =
        direct.protocol === "http:"
          ? direct.toString().replace(/^http:\/\//i, "https://")
          : direct.toString();
      return encodeURI(finalUrl);
    } catch {
      return null;
    }
  }

  if (/^www\./i.test(input)) {
    return encodeURI(`https://${input}`);
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

  return encodeURI(`${origin}${finalPath}`);
}
