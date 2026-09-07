import { apiRequest } from "./apiClient";
import { API_ENDPOINTS } from "../config/api";

export interface InvoiceItemSummary {
  id: number;
  publicId?: string;
  invoiceNumber: string;
  issuedOn: string;
  dueOn: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  balanceDue: number;
  currencyCode: string;
  statusId: number;
  statusLabel: string;
  notes?: string;
  createdOn?: string;
}

export interface InvoiceLineItem {
  chargeTypeId: number;
  description: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  lineTotal?: number;
  priceExclVat?: number;
  vatAmount?: number;
  totalInclVat?: number;
  categoryName?: string;
}

export interface InvoiceDetail extends InvoiceItemSummary {
  appliedChargePercentage?: number;
  supportChargeAmount?: number;
  appliedTaxPercentage?: number;
  lines: InvoiceLineItem[];
  customerName?: string;
  companyName?: string;
  billingAddress?: string;
  spaceName?: string;
}

export async function getCustomerInvoices(
  page: number = 1,
  limit: number = 10,
  statusId?: number
): Promise<{ items: InvoiceItemSummary[]; total: number; page: number; limit: number }> {
  let query = `?page=${page}&limit=${limit}`;
  if (statusId != null && statusId > 0) {
    query += `&statusId=${statusId}`;
  }

  try {
    const res = await apiRequest<{
      isSuccessful: boolean;
      data: any[];
      total: number;
      page: number;
      limit: number;
    }>(`${API_ENDPOINTS.invoices.list}${query}`, { requiresAuth: true });

    const rawItems = res?.data ?? [];
    const items: InvoiceItemSummary[] = rawItems.map((i: any) => ({
      id: Number(i?.id ?? i?.Id ?? 0),
      publicId: String(i?.publicId ?? i?.PublicId ?? ""),
      invoiceNumber: String(i?.invoiceNumber ?? i?.InvoiceNumber ?? `INV-${i?.id}`),
      issuedOn: String(i?.issuedOn ?? i?.IssuedOn ?? i?.createdOn ?? i?.CreatedOn ?? ""),
      dueOn: String(i?.dueOn ?? i?.DueOn ?? ""),
      billingPeriodStart: i?.billingPeriodStart ?? i?.BillingPeriodStart,
      billingPeriodEnd: i?.billingPeriodEnd ?? i?.BillingPeriodEnd,
      subTotal: Number(i?.subTotal ?? i?.SubTotal ?? 0),
      discountTotal: Number(i?.discountTotal ?? i?.DiscountTotal ?? 0),
      taxTotal: Number(i?.taxTotal ?? i?.TaxTotal ?? 0),
      grandTotal: Number(i?.grandTotal ?? i?.GrandTotal ?? 0),
      paidTotal: Number(i?.paidTotal ?? i?.PaidTotal ?? 0),
      balanceDue: Number(i?.balanceDue ?? i?.BalanceDue ?? 0),
      currencyCode: String(i?.currencyCode ?? i?.CurrencyCode ?? "PKR"),
      statusId: Number(i?.statusId ?? i?.StatusId ?? 1),
      statusLabel: String(i?.statusLabel ?? i?.StatusLabel ?? (i?.statusId === 2 ? "Paid" : "Unpaid")),
      notes: i?.notes ?? i?.Notes,
    }));

    return {
      items,
      total: Number(res?.total ?? items.length),
      page: Number(res?.page ?? page),
      limit: Number(res?.limit ?? limit),
    };
  } catch (error) {
    console.warn("[invoiceService] Error fetching customer invoices", error);
    return { items: [], total: 0, page, limit };
  }
}

export async function getInvoiceById(id: number | string): Promise<InvoiceDetail | null> {
  try {
    const res = await apiRequest<{
      isSuccessful: boolean;
      data: any;
    }>(API_ENDPOINTS.invoices.byId(id), { requiresAuth: true });

    const raw = res?.data ?? res;
    if (!raw) return null;

    const rawLines = Array.isArray(raw?.lines) ? raw.lines : Array.isArray(raw?.lineItems) ? raw.lineItems : [];
    const lines: InvoiceLineItem[] = rawLines.map((l: any) => ({
      chargeTypeId: Number(l?.chargeTypeId ?? l?.ChargeTypeId ?? 1),
      description: String(l?.description ?? l?.Description ?? "Service Charge"),
      quantity: Number(l?.quantity ?? l?.Quantity ?? 1),
      unitPrice: Number(l?.unitPrice ?? l?.UnitPrice ?? 0),
      discountAmount: Number(l?.discountAmount ?? l?.DiscountAmount ?? 0),
      taxRate: Number(l?.taxRate ?? l?.TaxRate ?? 16),
      taxAmount: Number(l?.taxAmount ?? l?.TaxAmount ?? l?.vatAmount ?? l?.VatAmount ?? 0),
      lineTotal: Number(l?.lineTotal ?? l?.LineTotal ?? l?.totalInclVat ?? l?.TotalInclVat ?? 0),
      priceExclVat: Number(l?.priceExclVat ?? l?.PriceExclVat ?? 0),
      categoryName: l?.categoryName ?? l?.CategoryName,
    }));

    return {
      id: Number(raw?.id ?? raw?.Id ?? id),
      invoiceNumber: String(raw?.invoiceNumber ?? raw?.InvoiceNumber ?? `INV-${id}`),
      issuedOn: String(raw?.issuedOn ?? raw?.IssuedOn ?? raw?.createdOn ?? raw?.CreatedOn ?? ""),
      dueOn: String(raw?.dueOn ?? raw?.DueOn ?? ""),
      billingPeriodStart: raw?.billingPeriodStart ?? raw?.BillingPeriodStart,
      billingPeriodEnd: raw?.billingPeriodEnd ?? raw?.BillingPeriodEnd,
      subTotal: Number(raw?.subTotal ?? raw?.SubTotal ?? 0),
      discountTotal: Number(raw?.discountTotal ?? raw?.DiscountTotal ?? 0),
      taxTotal: Number(raw?.taxTotal ?? raw?.TaxTotal ?? 0),
      grandTotal: Number(raw?.grandTotal ?? raw?.GrandTotal ?? 0),
      paidTotal: Number(raw?.paidTotal ?? raw?.PaidTotal ?? 0),
      balanceDue: Number(raw?.balanceDue ?? raw?.BalanceDue ?? 0),
      currencyCode: String(raw?.currencyCode ?? raw?.CurrencyCode ?? "PKR"),
      statusId: Number(raw?.statusId ?? raw?.StatusId ?? 1),
      statusLabel: String(raw?.statusLabel ?? raw?.StatusLabel ?? "Unpaid"),
      appliedChargePercentage: Number(raw?.appliedChargePercentage ?? raw?.AppliedChargePercentage ?? 10),
      supportChargeAmount: Number(raw?.supportChargeAmount ?? raw?.SupportChargeAmount ?? 0),
      appliedTaxPercentage: Number(raw?.appliedTaxPercentage ?? raw?.AppliedTaxPercentage ?? 16),
      lines,
      customerName: raw?.customerName ?? raw?.CustomerName,
      companyName: raw?.companyName ?? raw?.CompanyName,
      billingAddress: raw?.billingAddress ?? raw?.BillingAddress,
      spaceName: raw?.spaceName ?? raw?.SpaceName,
    };
  } catch (error) {
    console.warn(`[invoiceService] Error fetching invoice ${id}`, error);
    return null;
  }
}
