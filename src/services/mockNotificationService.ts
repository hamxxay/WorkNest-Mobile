// Replace with real Firebase push notification calls when ready.

export type MockNotification = {
  type: "CHALLAN_READY" | "ORDER_MODIFIED" | "GENERAL";
  quotationId: string;
  challanId?: string;
  amount?: number;
  status?: string;
  title: string;
  body: string;
};

const delay = (ms = 1500) => new Promise<void>((r) => setTimeout(r, ms));

export async function simulateAdminNotification(quotationId: string): Promise<void> {
  await delay(500);
  console.log(`[mockNotificationService] Admin notified for quotation ${quotationId}`);
}

export async function simulateChallanReadyNotification(
  quotationId: string,
  challanId: string,
  amount: number,
  onReceived: (notification: MockNotification) => void
): Promise<void> {
  // Simulate admin processing delay then customer receives notification
  await delay(2000);
  const notification: MockNotification = {
    type: "CHALLAN_READY",
    quotationId,
    challanId,
    amount,
    status: "pending_payment",
    title: "Your challan is ready 🎉",
    body: `Challan ${challanId} for PKR ${amount.toLocaleString()} is ready. Tap to proceed with payment.`,
  };
  console.log("[mockNotificationService] Customer notified:", notification);
  onReceived(notification);
}

export async function simulateOrderModifiedNotification(quotationId: string): Promise<void> {
  await delay(500);
  console.log(`[mockNotificationService] Admin notified of modified order for ${quotationId}`);
}
