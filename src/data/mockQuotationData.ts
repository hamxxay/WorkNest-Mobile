// Replace with real API responses when backend is ready.

export type QuotationItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
};

export type Quotation = {
  id: string;
  customerName: string;
  quotationDate: string;
  validUntil: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pending" | "approved" | "rejected" | "expired";
  notes?: string;
};

export type Challan = {
  challanId: string;
  quotationId: string;
  customerName: string;
  amount: number;
  status: "pending_payment" | "paid" | "expired";
  issuedAt: string;
  deadline?: string;
  instructions?: string;
};

export type ChallanRequest = {
  fullName: string;
  cnic: string;
  mobile: string;
  whatsapp: string;
  email: string;
};

export type ModifiedOrder = {
  quotationId: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
};

export const MOCK_QUOTATIONS: Record<string, Quotation> = {
  "QUO-1001": {
    id: "QUO-1001",
    customerName: "Ali Khan",
    quotationDate: "15 Aug 2026",
    validUntil: "22 Aug 2026",
    items: [
      { id: 1, name: "Private Office (1 Month)", quantity: 2, price: 25000, total: 50000 },
      { id: 2, name: "Meeting Room (10 hrs)", quantity: 1, price: 15000, total: 15000 },
    ],
    subtotal: 65000,
    tax: 0,
    total: 65000,
    status: "pending",
    notes: "Includes high-speed WiFi, daily cleaning, and locker access.",
  },
  "QUO-1002": {
    id: "QUO-1002",
    customerName: "Sara Ahmed",
    quotationDate: "10 Aug 2026",
    validUntil: "17 Aug 2026",
    items: [
      { id: 1, name: "Hot Desk (Monthly)", quantity: 3, price: 8000, total: 24000 },
    ],
    subtotal: 24000,
    tax: 0,
    total: 24000,
    status: "pending",
  },
  "QUO-1003": {
    id: "QUO-1003",
    customerName: "Usman Tariq",
    quotationDate: "01 Aug 2026",
    validUntil: "08 Aug 2026",
    items: [
      { id: 1, name: "Event Space (Full Day)", quantity: 1, price: 45000, total: 45000 },
      { id: 2, name: "Catering Package", quantity: 1, price: 12000, total: 12000 },
    ],
    subtotal: 57000,
    tax: 0,
    total: 57000,
    status: "expired",
  },
};

export const MOCK_CHALLANS: Record<string, Challan> = {
  "QUO-1001": {
    challanId: "CH-1001",
    quotationId: "QUO-1001",
    customerName: "Ali Khan",
    amount: 65000,
    status: "pending_payment",
    issuedAt: "16 Aug 2026",
    deadline: "20 Aug 2026",
    instructions:
      "Deposit the amount to WorkNest Bank Account: PK00 WORK 0000 1234 5678 (HBL) and share the receipt via WhatsApp at +92 308 0256000.",
  },
  "QUO-1002": {
    challanId: "CH-1002",
    quotationId: "QUO-1002",
    customerName: "Sara Ahmed",
    amount: 24000,
    status: "pending_payment",
    issuedAt: "11 Aug 2026",
    deadline: "15 Aug 2026",
    instructions:
      "Deposit the amount to WorkNest Bank Account: PK00 WORK 0000 1234 5678 (HBL) and share the receipt via WhatsApp at +92 308 0256000.",
  },
};
