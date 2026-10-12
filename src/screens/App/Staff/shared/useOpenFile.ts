import { useCallback, useState } from "react";
import { useToast } from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import { openStaffFile, type DownloadedFile } from "../../../../services/staff";

/**
 * Downloads an authenticated file (PDF, KYC document) and opens the share / viewer sheet. `opening` is the key
 * of the file being fetched (to show a spinner on the right button); failures show a toast.
 */
export function useOpenFile() {
  const toast = useToast();
  const [opening, setOpening] = useState<string | null>(null);
  const open = useCallback(
    async (key: string, download: () => Promise<DownloadedFile>, title?: string) => {
      if (opening) return;
      setOpening(key);
      try {
        const file = await download();
        await openStaffFile(file, title);
      } catch (err) {
        toast.error(errorMessage(err, "Could not open the file. Please try again."));
      } finally {
        setOpening(null);
      }
    },
    [opening, toast],
  );
  return { opening, open };
}
