// File names that come from the server (KYC originalFileName, Content-Disposition) end up as a file on the
// device: react-native-share writes the shared data URL to <cache>/Download/<name>.<ext>. A name such as
// "../../shared_prefs/x" must never reach that path, so every name is cleaned here first.

/** Longest name kept, without the extension (long names are cut, the extension is kept). */
export const MAX_FILE_NAME_LENGTH = 80;

/** Any trailing extension: ".pdf", ".jpeg", ".png"... */
const ANY_EXTENSION = /\.[a-z0-9]{1,8}$/i;

const trimSeparators = (value: string) => value.replace(/^[-.]+|[-.]+$/g, "");

/** The part after the last "/" or "\\" (folders are never kept). */
const lastSegment = (value: string) => (value.split(/[\\/]/).pop() ?? "").trim();

/**
 * Letters, digits, "_", "-" and "." only (anything else becomes "-"), with no ".." and no leading / trailing
 * dots or dashes (no hidden files).
 */
function cleanSegment(value: string): string {
  return trimSeparators(
    lastSegment(value)
      .replace(/[^\w.-]+/g, "-") // spaces, control characters, ":", "*", "?", quotes, non-ASCII... become "-"
      .replace(/\.{2,}/g, ".")
      .replace(/-{2,}/g, "-"),
  );
}

const cut = (base: string) => trimSeparators(base.slice(0, MAX_FILE_NAME_LENGTH));

/**
 * A safe file name WITH its extension: "../../CNIC front (1).JPG" -> "CNIC-front-1.JPG".
 * `fallback` (cleaned the same way, given the original extension) is used when nothing usable is left.
 */
export function safeFileName(name: string | null | undefined, fallback: string): string {
  const last = lastSegment(name ?? "");
  const ext = ANY_EXTENSION.exec(last)?.[0] ?? "";
  const base = cut(cleanSegment(last.slice(0, last.length - ext.length)));
  if (base) return `${base}${ext}`;
  const fallbackName = fallback ? safeFileName(fallback, "") : "file";
  return ext && !ANY_EXTENSION.test(fallbackName) ? `${fallbackName}${ext}` : fallbackName;
}

/**
 * A safe file name WITHOUT the extension, for the share sheet (it adds the extension from the MIME type).
 * `extension` is what is removed: any extension by default, or e.g. /\.pdf$/i to keep other dots.
 */
export function safeFileBaseName(
  name: string | null | undefined,
  fallback: string,
  extension: RegExp = ANY_EXTENSION,
): string {
  const base = (value: string) => cut(cleanSegment(lastSegment(value).replace(extension, "")));
  return base(name ?? "") || base(fallback) || "file";
}
