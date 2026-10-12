import RNShare from "react-native-share";
import { ApiError, apiDownload, type DownloadedFile } from "./apiClient";

/**
 * Authenticated PDFs (challans, agreements, invoices, quotations): downloaded WITH the sign-in token and
 * handed to the system share / viewer sheet (Android offers PDF viewers, Drive, Files, print...).
 * Authenticated API URLs are never opened with Linking.openURL: the browser would not send the token.
 */

/** File name without folders, unsafe characters or the .pdf extension (the share sheet adds it). */
export function pdfBaseName(name: string | null | undefined, fallback: string): string {
  const raw = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = raw.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

/** Opens an already downloaded PDF in the share / viewer sheet. Resolves when the sheet closes. */
export async function sharePdf(file: DownloadedFile, fallbackName: string, title: string): Promise<void> {
  try {
    await RNShare.open({
      // The type is normalised: some servers send application/octet-stream for PDFs.
      url: `data:application/pdf;base64,${file.base64}`,
      type: "application/pdf",
      filename: pdfBaseName(file.fileName, fallbackName),
      title,
      failOnCancel: false,
    });
  } catch (error) {
    if (__DEV__) console.warn("[pdf] share sheet failed", error);
    throw new ApiError("The PDF could not be opened on this device. Please try again.", 0, error);
  }
}

/**
 * Downloads a PDF from the API (with the sign-in token) and opens it in the share / viewer sheet.
 * Throws a readable ApiError when the download or the sheet fails.
 */
export async function openApiPdf(
  path: string,
  options: { fileName: string; title: string },
): Promise<void> {
  const file = await apiDownload(path, { accept: "application/pdf, application/json" });
  await sharePdf(file, options.fileName, options.title);
}
