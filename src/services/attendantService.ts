import { apiRequest } from "./apiClient";
import { API_ENDPOINTS } from "../config/api";

export interface Attendant {
  customerAttendantId?: number;
  personId: number;
  personGuid?: string;
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  customerId: number;
  isActive: boolean;
  createdAt?: string;
  bookingId?: number;
  spaceName?: string;
}

export interface BookingAttendantDetail {
  id?: number;
  bookingDetailId?: number;
  personId: number;
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  assignedFrom?: string;
  assignedTo?: string;
  isOverCapacity?: boolean;
  excessSeatCount?: number;
  surchargeApplied?: number;
}

export async function getCustomerAttendants(
  page: number = 1,
  limit: number = 10
): Promise<{ items: Attendant[]; total: number; page: number; limit: number }> {
  try {
    const res = await apiRequest<{
      isSuccessful?: boolean;
      data: any[];
      total?: number;
      page?: number;
      limit?: number;
    }>(`${API_ENDPOINTS.attendants.list}?page=${page}&limit=${limit}`, { requiresAuth: true });

    const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    const items: Attendant[] = rawList.map((a: any) => ({
      customerAttendantId: a?.customerAttendantId ?? a?.CustomerAttendantId,
      personId: Number(a?.personId ?? a?.PersonId ?? 0),
      personGuid: a?.personGuid ?? a?.PersonGuid,
      name: String(a?.name ?? a?.Name ?? "Attendant"),
      email: String(a?.email ?? a?.Email ?? ""),
      phone: String(a?.phone ?? a?.Phone ?? ""),
      idType: String(a?.idType ?? a?.IdType ?? "CNIC"),
      idNumber: String(a?.idNumber ?? a?.IdNumber ?? ""),
      customerId: Number(a?.customerId ?? a?.CustomerId ?? 0),
      isActive: Boolean(a?.isActive ?? a?.IsActive ?? true),
      createdAt: a?.createdAt ?? a?.CreatedAt,
      bookingId: a?.bookingId ?? a?.BookingId,
      spaceName: a?.spaceName ?? a?.SpaceName,
    }));

    return {
      items,
      total: Number(res?.total ?? items.length),
      page: Number(res?.page ?? page),
      limit: Number(res?.limit ?? limit),
    };
  } catch (error) {
    console.warn("[attendantService] Error fetching customer attendants", error);
    return { items: [], total: 0, page, limit };
  }
}

export async function getBookingAttendants(bookingId: number | string): Promise<BookingAttendantDetail[]> {
  try {
    const res = await apiRequest<any[]>(API_ENDPOINTS.attendants.byBooking(bookingId), { requiresAuth: true });
    const rawList = Array.isArray(res) ? res : [];
    return rawList.map((a: any) => ({
      id: Number(a?.id ?? a?.Id ?? 0),
      bookingDetailId: Number(a?.bookingDetailId ?? a?.BookingDetailId ?? bookingId),
      personId: Number(a?.personId ?? a?.PersonId ?? 0),
      name: String(a?.name ?? a?.Name ?? "Attendant"),
      email: String(a?.email ?? a?.Email ?? ""),
      phone: String(a?.phone ?? a?.Phone ?? ""),
      idType: String(a?.idType ?? a?.IdType ?? "CNIC"),
      idNumber: String(a?.idNumber ?? a?.IdNumber ?? ""),
      assignedFrom: a?.assignedFrom ?? a?.AssignedFrom,
      assignedTo: a?.assignedTo ?? a?.AssignedTo,
      isOverCapacity: Boolean(a?.isOverCapacity ?? a?.IsOverCapacity ?? false),
      excessSeatCount: Number(a?.excessSeatCount ?? a?.ExcessSeatCount ?? 0),
      surchargeApplied: Number(a?.surchargeApplied ?? a?.SurchargeApplied ?? 0),
    }));
  } catch (error) {
    console.warn(`[attendantService] Error fetching attendants for booking ${bookingId}`, error);
    return [];
  }
}
