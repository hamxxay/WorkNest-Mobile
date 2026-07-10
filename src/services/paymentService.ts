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
  transactionRef?: string;
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
    const payload = await apiRequest<PaymentItem[]>(API_ENDPOINTS.payments.my, {
      requiresAuth: true,
    });

    remotePayments = Array.isArray(payload) ? payload : [];
  } catch {
    remotePayments = [];
  }

  const localPayments = await getLocalPaymentVouchers();

  // Match local vouchers to remote payments by transactionRef/referenceNumber
  // Remote payments approved by admin will have paymentStatus "Paid"
  const remoteByRef = new Map(
    remotePayments
      .filter((p) => p.transactionRef)
      .map((p) => [p.transactionRef!.toLowerCase(), p])
  );

  let synced = false;
  const updatedLocals = localPayments.map((local) => {
    if (!local.referenceNumber) return local;
    const remote = remoteByRef.get(local.referenceNumber.toLowerCase());
    if (remote && remote.paymentStatus === "Paid" && local.paymentStatus !== "Paid") {
      synced = true;
      return { ...local, paymentStatus: "Paid" };
    }
    return local;
  });

  if (synced) await saveLocalPaymentVouchers(updatedLocals);

  // Deduplicate: hide remote entries that are already represented by a local voucher
  const localRefs = new Set(
    updatedLocals
      .filter((l) => l.referenceNumber)
      .map((l) => l.referenceNumber!.toLowerCase())
  );
  const remoteOnly = remotePayments.filter(
    (r) => !r.transactionRef || !localRefs.has(r.transactionRef.toLowerCase())
  );

  return [...updatedLocals, ...remoteOnly].sort((a, b) => {
    const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function createLocalPaymentVoucher(
  input: Omit<PaymentItem, "id" | "paidAt" | "paymentStatus">
): Promise<PaymentItem> {
  const existing = await getLocalPaymentVouchers();
  const isCashCounter = input.paymentMethod === "Cash on Counter";
  const voucher: PaymentItem = {
    id: Date.now(),
    paidAt: new Date().toISOString(),
    paymentStatus: isCashCounter ? "Pending" : "Paid",
    ...input,
  };

  await saveLocalPaymentVouchers([voucher, ...existing]);
  return voucher;
}
