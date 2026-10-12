import RNShare from "react-native-share";
import type { DownloadedFile } from "./http";

/**
 * Opens a downloaded file (PDF, image) in the system share / viewer sheet: Android offers PDF viewers, Drive,
 * Files ("save"), mail, WhatsApp. Resolves once the sheet was shown (also when the user dismisses it).
 */
export async function openStaffFile(file: DownloadedFile, title?: string): Promise<void> {
  await RNShare.open({
    url: file.dataUrl,
    type: file.mimeType,
    filename: file.fileName.replace(/\.[a-z0-9]+$/i, ""),
    title: title ?? file.fileName,
    failOnCancel: false,
  });
}
