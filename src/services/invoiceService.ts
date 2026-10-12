import { ApiError, apiRequest } from "./apiClient";
import { API_ENDPOINTS } from "../config/api";
import { openApiPdf } from "./pdfService";

// Customers have no "my invoices" list in the API yet: the customer area shows GET /payment/my and the
// booking challans (like worknestpk.com). The invoice list / detail endpoints below are staff only;
// an invoice PDF can be opened by the customer it belongs to.

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

function normalizeInvoiceSummary(i: any): InvoiceItemSummary {
  return {
    id: Number(i?.id ?? i?.Id ?? 0),
    publicId: String(i?.publicId ?? i?.PublicId ?? ""),
    invoiceNumber: String(i?.invoiceNumber ?? i?.InvoiceNumber ?? `INV-${i?.id ?? i?.Id ?? ""}`),
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
    statusId: Number(i?.statusId ?? i?.StatusId ?? 0),
    // The status label is the API's; nothing is inferred locally.
    statusLabel: String(i?.statusLabel ?? i?.StatusLabel ?? ""),
    notes: i?.notes ?? i?.Notes,
    createdOn: i?.createdOn ?? i?.CreatedOn,
  };
}

/**
 * Staff only: GET /customers/{customerId}/invoices (or GET /invoice without a customer).
 * Throws a readable ApiError on failure; callers show an error state.
 */
export async function getCustomerInvoices(
  page: number = 1,
  limit: number = 10,
  statusId?: number,
  customerId?: number | string,
): Promise<{ items: InvoiceItemSummary[]; total: number; page: number; limit: number }> {
  const query = `?page=${page}&limit=${limit}${statusId != null && statusId > 0 ? `&statusId=${statusId}` : ""}`;
  const endpoint =
    customerId != null
      ? `${API_ENDPOINTS.invoices.customerInvoices(customerId)}${query}`
      : `${API_ENDPOINTS.invoices.list}${query}`;

  const res = await apiRequest<any>(endpoint, { requiresAuth: true, unwrapData: false });
  const rawItems: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.items)
          ? res.items
          : [];
  const items = rawItems.map(normalizeInvoiceSummary);
  return {
    items,
    total: Number(res?.total ?? res?.data?.total ?? items.length),
    page: Number(res?.page ?? page),
    limit: Number(res?.limit ?? limit),
  };
}

/** Staff only: GET /invoice/{id}. Resolves null when the invoice doesn't exist; throws on other failures. */
export async function getInvoiceById(id: number | string): Promise<InvoiceDetail | null> {
  let raw: any;
  try {
    raw = await apiRequest<any>(API_ENDPOINTS.invoices.byId(id), { requiresAuth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
  if (!raw) return null;

  const rawLines = Array.isArray(raw?.lines) ? raw.lines : Array.isArray(raw?.lineItems) ? raw.lineItems : [];
  const lines: InvoiceLineItem[] = rawLines.map((l: any) => ({
    chargeTypeId: Number(l?.chargeTypeId ?? l?.ChargeTypeId ?? 0),
    description: String(l?.description ?? l?.Description ?? ""),
    quantity: Number(l?.quantity ?? l?.Quantity ?? 1),
    unitPrice: Number(l?.unitPrice ?? l?.UnitPrice ?? 0),
    discountAmount: Number(l?.discountAmount ?? l?.DiscountAmount ?? 0),
    taxRate: l?.taxRate ?? l?.TaxRate,
    taxAmount: Number(l?.taxAmount ?? l?.TaxAmount ?? l?.vatAmount ?? l?.VatAmount ?? 0),
    lineTotal: Number(l?.lineTotal ?? l?.LineTotal ?? l?.totalInclVat ?? l?.TotalInclVat ?? 0),
    priceExclVat: Number(l?.priceExclVat ?? l?.PriceExclVat ?? 0),
    categoryName: l?.categoryName ?? l?.CategoryName,
  }));

  return {
    ...normalizeInvoiceSummary({ id, ...raw }),
    appliedChargePercentage: raw?.appliedChargePercentage ?? raw?.AppliedChargePercentage,
    supportChargeAmount: raw?.supportChargeAmount ?? raw?.SupportChargeAmount,
    appliedTaxPercentage: raw?.appliedTaxPercentage ?? raw?.AppliedTaxPercentage,
    lines,
    customerName: raw?.customerName ?? raw?.CustomerName,
    companyName: raw?.companyName ?? raw?.CompanyName,
    billingAddress: raw?.billingAddress ?? raw?.BillingAddress,
    spaceName: raw?.spaceName ?? raw?.SpaceName,
  };
}

/**
 * GET /invoice/{id}/pdf with the sign-in token (staff, or the customer the invoice belongs to),
 * opened in the share / viewer sheet.
 */
export async function openInvoicePdf(id: number | string, invoiceNumber?: string | null): Promise<void> {
  await openApiPdf(API_ENDPOINTS.invoices.pdf(id), {
    fileName: `Invoice-${invoiceNumber || id}`,
    title: `WorkNest Invoice ${invoiceNumber || `#${id}`}`,
  });
}
