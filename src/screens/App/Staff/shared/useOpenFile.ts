import { useCallback, useState } from "react";
import { useToast } from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import { openStaffFile, type DownloadedFile } from "../../../../services/staff";

/**
 * Downloads an authenticated file (PDF, KYC document) and opens the share / viewer sheet. `opening` is the key
 * of the file being fetched (to show a spinner on the right button); failures show a toast.
 */
export function useOpenFile(options: { toast?: boolean } = {}) {
  const toast = useToast();
  const useToastMessages = options.toast !== false;
  const [opening, setOpening] = useState<string | null>(null);
  /** Last failure, for callers inside a sheet / dialog (toasts render under modals): pass { toast: false }. */
  const [error, setError] = useState<string | null>(null);
  const open = useCallback(
    async (key: string, download: () => Promise<DownloadedFile>, title?: string) => {
      if (opening) return;
      setOpening(key);
      setError(null);
      try {
        const file = await download();
        await openStaffFile(file, title);
      } catch (err) {
        const message = errorMessage(err, "Could not open the file. Please try again.");
        if (useToastMessages) toast.error(message);
        else setError(message);
      } finally {
        setOpening(null);
      }
    },
    [opening, toast, useToastMessages],
  );
  return { opening, open, error };
}
