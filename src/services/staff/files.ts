import RNShare from "react-native-share";
import { safeFileBaseName } from "../../utils/fileName";
import type { DownloadedFile } from "./http";

/**
 * Opens a downloaded file (PDF, image) in the system share / viewer sheet: Android offers PDF viewers, Drive,
 * Files ("save"), mail, WhatsApp. Resolves once the sheet was shown (also when the user dismisses it).
 * Android: the file (KYC documents included) is written to the app's private cache (useInternalStorage), not
 * to the shared external cache, under a cleaned name (no folders or odd characters from the server).
 */
export async function openStaffFile(file: DownloadedFile, title?: string): Promise<void> {
  const name = safeFileBaseName(file.fileName, "WorkNest-file");
  await RNShare.open({
    url: file.dataUrl,
    type: file.mimeType,
    filename: name,
    title: title ?? name,
    failOnCancel: false,
    useInternalStorage: true,
  });
}
