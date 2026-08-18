// Replace Promise bodies with real apiRequest() calls when backend is ready.
import {
  MOCK_QUOTATIONS,
  MOCK_CHALLANS,
  type Quotation,
  type Challan,
  type ChallanRequest,
  type ModifiedOrder,
  type QuotationItem,
} from "../data/mockQuotationData";

const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms));

export async function getQuotationById(id: string): Promise<Quotation> {
  await delay();
  const q = MOCK_QUOTATIONS[id];
  if (!q) throw new Error(`Quotation "${id}" not found.`);
  return q;
}

export async function submitChallanRequest(
  quotationId: string,
  form: ChallanRequest
): Promise<{ success: boolean; message: string }> {
  await delay(1000);
  console.log("[mockQuotationService] challan request submitted", { quotationId, form });
  return { success: true, message: "Challan request submitted successfully." };
}

export async function submitModifiedOrder(
  quotationId: string,
  items: QuotationItem[]
): Promise<{ success: boolean; modifiedOrder: ModifiedOrder }> {
  await delay(1000);
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const modifiedOrder: ModifiedOrder = { quotationId, items, subtotal, tax: 0, total: subtotal };
  console.log("[mockQuotationService] modified order submitted", modifiedOrder);
  return { success: true, modifiedOrder };
}

export async function getChallan(quotationId: string): Promise<Challan> {
  await delay();
  const c = MOCK_CHALLANS[quotationId];
  if (!c) throw new Error(`Challan for quotation "${quotationId}" not found.`);
  return c;
}
