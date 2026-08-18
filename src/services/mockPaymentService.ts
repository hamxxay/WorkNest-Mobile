// Replace with real payment gateway integration when ready.

export type QuotationPaymentResult = {
  success: boolean;
  transactionId: string;
  paidAt: string;
  status: "paid";
};

const delay = (ms = 1200) => new Promise<void>((r) => setTimeout(r, ms));

export async function simulatePayment(
  challanId: string,
  amount: number
): Promise<QuotationPaymentResult> {
  await delay();
  const transactionId = `TXN-${challanId}-${String(Date.now()).slice(-6)}`;
  console.log("[mockPaymentService] Payment simulated", { challanId, amount, transactionId });
  return {
    success: true,
    transactionId,
    paidAt: new Date().toLocaleString("en-PK"),
    status: "paid",
  };
}
