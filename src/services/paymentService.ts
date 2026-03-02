import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

export type PaymentItem = {
  id: number;
  amount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
};

type PaymentResponse =
  | PaymentItem[]
  | {
      data?: PaymentItem[];
      items?: PaymentItem[];
    };

export async function getMyPayments(): Promise<PaymentItem[]> {
  const payload = await apiRequest<PaymentResponse>(API_ENDPOINTS.payments.my, {
    requiresAuth: true,
  });

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.data ?? payload.items ?? [];
}
