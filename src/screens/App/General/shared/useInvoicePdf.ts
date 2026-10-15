import { useCallback, useRef, useState } from "react";
import { useToast } from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import { openInvoicePdf } from "../../../../services/billService";

/**
 * Opens one of the customer's invoice PDFs (GET /invoice/{id}/pdf with the sign-in token) in the share / viewer
 * sheet. One download at a time (double taps are ignored); `busyId` is the invoice being downloaded.
 */
export function useInvoicePdf() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const busy = useRef(false);

  const open = useCallback(
    async (invoiceId: number | null | undefined, number?: string | null) => {
      if (!invoiceId || busy.current) return;
      busy.current = true;
      setBusyId(invoiceId);
      try {
        await openInvoicePdf(invoiceId, number);
      } catch (err) {
        toast.error(errorMessage(err, "The invoice PDF could not be downloaded. Please try again."));
      } finally {
        busy.current = false;
        setBusyId(null);
      }
    },
    [toast],
  );

  return { open, busyId };
}
