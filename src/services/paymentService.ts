import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

const LOCAL_PAYMENT_VOUCHERS_KEY = "local_payment_vouchers";

export type PaymentItem = {
  id: number;
  amount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  workspaceName?: string;
  voucherCode?: string;
  bookingSummary?: string;
  referenceNumber?: string;
  bankDepositId?: string;
};

type PaymentResponse =
  | PaymentItem[]
  | {
      data?: PaymentItem[];
      items?: PaymentItem[];
    };

async function getLocalPaymentVouchers(): Promise<PaymentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PAYMENT_VOUCHERS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PaymentItem[]) : [];
  } catch {
    return [];
  }
}

async function saveLocalPaymentVouchers(items: PaymentItem[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_PAYMENT_VOUCHERS_KEY, JSON.stringify(items));
}

export async function getMyPayments(): Promise<PaymentItem[]> {
  let remotePayments: PaymentItem[] = [];

  try {
    const payload = await apiRequest<PaymentResponse>(API_ENDPOINTS.payments.my, {
      requiresAuth: true,
    });

    remotePayments = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
  } catch {
    remotePayments = [];
  }

  const localPayments = await getLocalPaymentVouchers();
  return [...localPayments, ...remotePayments].sort((a, b) => {
    const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function createLocalPaymentVoucher(
  input: Omit<PaymentItem, "id" | "paidAt" | "paymentStatus">
): Promise<PaymentItem> {
  const existing = await getLocalPaymentVouchers();
  const voucher: PaymentItem = {
    id: Date.now(),
    paidAt: new Date().toISOString(),
    paymentStatus: "Paid",
    ...input,
  };

  await saveLocalPaymentVouchers([voucher, ...existing]);
  return voucher;
}
