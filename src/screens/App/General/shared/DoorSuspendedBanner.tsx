import type { StyleProp, ViewStyle } from "react-native";
import { Banner } from "../../../../components/ui";
import { DOOR_SUSPENDED_FALLBACK, type DoorAccessNotice } from "../../../../services/bookingService";

/**
 * "Door access suspended" on a booking card / booking details, with the API's reason and a link to the bill to pay:
 * the unpaid invoice (its PDF; double taps are ignored by useInvoicePdf) or, when it is the booking challan, the
 * challan.
 */
export function DoorSuspendedBanner({
  notice,
  onOpenInvoice,
  onOpenChallan,
  style,
}: {
  notice: DoorAccessNotice;
  onOpenInvoice: (invoiceId: number, number: string | null) => void;
  onOpenChallan?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!notice.accessSuspended) return null;
  const invoiceId = notice.accessSuspendedInvoiceId;
  const action = invoiceId
    ? {
        actionLabel: `Open invoice${notice.accessSuspendedInvoiceNumber ? ` ${notice.accessSuspendedInvoiceNumber}` : ""}`,
        onAction: () => onOpenInvoice(invoiceId, notice.accessSuspendedInvoiceNumber),
      }
    : onOpenChallan
      ? { actionLabel: "View challan", onAction: onOpenChallan }
      : {};
  return (
    <Banner
      tone="danger"
      icon="lock-closed"
      title="Door access suspended"
      message={notice.accessSuspendedReason ?? DOOR_SUSPENDED_FALLBACK}
      style={style}
      {...action}
    />
  );
}
