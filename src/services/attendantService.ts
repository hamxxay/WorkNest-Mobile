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
  companyName?: string;
  isActive: boolean;
  createdAt?: string;
  bookingId?: number;
  spaceName?: string;
}

export interface AttendantCreatePayload {
  customerId: number;
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
}

export interface AttendantUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
}

export interface BookingAttendantAssignmentPayload {
  bookingDetailId: number;
  personId: number;
  customerId: number;
  assignedFrom: string;
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

export interface CapacityCheckResult {
  bookingDetailId?: number;
  isOverCapacity?: boolean;
  capacity?: number;
  currentAttendants?: number;
  availableSeats?: number;
  excessSeatCount?: number;
  surchargeApplied?: number;
  message?: string;
}

function normalizeAttendant(raw: any, fallbackCustomerId = 0): Attendant {
  return {
    customerAttendantId: Number(raw?.customerAttendantId ?? raw?.CustomerAttendantId ?? 0) || undefined,
    personId: Number(raw?.personId ?? raw?.PersonId ?? 0),
    personGuid: raw?.personGuid ?? raw?.PersonGuid,
    name: String(raw?.name ?? raw?.Name ?? "Attendant"),
    email: String(raw?.email ?? raw?.Email ?? ""),
    phone: String(raw?.phone ?? raw?.Phone ?? ""),
    idType: String(raw?.idType ?? raw?.IdType ?? "CNIC"),
    idNumber: String(raw?.idNumber ?? raw?.IdNumber ?? ""),
    customerId: Number(raw?.customerId ?? raw?.CustomerId ?? fallbackCustomerId),
    companyName: String(raw?.companyName ?? raw?.CompanyName ?? ""),
    isActive: Boolean(raw?.isActive ?? raw?.IsActive ?? true),
    createdAt: raw?.createdAt ?? raw?.CreatedAt,
    bookingId: raw?.bookingId ?? raw?.BookingId,
    spaceName: raw?.spaceName ?? raw?.SpaceName,
  };
}

export async function createAttendant(
  payload: AttendantCreatePayload,
): Promise<Attendant> {
  return apiRequest<Attendant>(API_ENDPOINTS.attendants.create, {
    method: "POST",
    requiresAuth: true,
    body: payload,
  });
}

export async function updateAttendant(
  personId: number | string,
  payload: AttendantUpdatePayload,
): Promise<Attendant> {
  return apiRequest<Attendant>(API_ENDPOINTS.attendants.update(personId), {
    method: "PUT",
    requiresAuth: true,
    body: payload,
  });
}

export async function getCustomerAttendants(
  customerId?: number | string,
  page: number = 1,
  limit: number = 10,
): Promise<{ items: Attendant[]; total: number; page: number; limit: number }> {
  try {
    const endpoint = customerId != null
      ? API_ENDPOINTS.attendants.byCustomer(customerId)
      : `${API_ENDPOINTS.attendants.list}?page=${page}&limit=${limit}`;

    const res = await apiRequest<any>(endpoint, { requiresAuth: true });
    const payload = res && typeof res === "object" && "data" in res ? res.data : res;
    const rawList = Array.isArray(payload) ? payload : Array.isArray(res) ? res : [];

    const items = rawList.map((item: any) => normalizeAttendant(item, Number(customerId ?? 0)));

    return {
      items,
      total: Number((res && typeof res === "object" ? res.total : undefined) ?? items.length),
      page: Number((res && typeof res === "object" ? res.page : undefined) ?? page),
      limit: Number((res && typeof res === "object" ? res.limit : undefined) ?? limit),
    };
  } catch (error) {
    console.warn("[attendantService] Error fetching customer attendants", error);
    return { items: [], total: 0, page, limit };
  }
}

export async function getActiveSpacesForCustomer(
  customerId: number | string,
): Promise<any[]> {
  try {
    const res = await apiRequest<any[]>(API_ENDPOINTS.attendants.activeSpaces(customerId), {
      requiresAuth: true,
    });
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.warn(`[attendantService] Error fetching active spaces for customer ${customerId}`, error);
    return [];
  }
}

export async function getBookingAttendants(
  bookingId: number | string,
): Promise<BookingAttendantDetail[]> {
  try {
    const res = await apiRequest<any[]>(API_ENDPOINTS.attendants.byBooking(bookingId), {
      requiresAuth: true,
    });
    const rawList = Array.isArray(res) ? res : [];

    return rawList.map((item: any) => ({
      id: Number(item?.id ?? item?.Id ?? 0) || undefined,
      bookingDetailId: Number(item?.bookingDetailId ?? item?.BookingDetailId ?? bookingId),
      personId: Number(item?.personId ?? item?.PersonId ?? 0),
      name: String(item?.name ?? item?.Name ?? "Attendant"),
      email: String(item?.email ?? item?.Email ?? ""),
      phone: String(item?.phone ?? item?.Phone ?? ""),
      idType: String(item?.idType ?? item?.IdType ?? "CNIC"),
      idNumber: String(item?.idNumber ?? item?.IdNumber ?? ""),
      assignedFrom: item?.assignedFrom ?? item?.AssignedFrom,
      assignedTo: item?.assignedTo ?? item?.AssignedTo,
      isOverCapacity: Boolean(item?.isOverCapacity ?? item?.IsOverCapacity ?? false),
      excessSeatCount: Number(item?.excessSeatCount ?? item?.ExcessSeatCount ?? 0),
      surchargeApplied: Number(item?.surchargeApplied ?? item?.SurchargeApplied ?? 0),
    }));
  } catch (error) {
    console.warn(`[attendantService] Error fetching attendants for booking ${bookingId}`, error);
    return [];
  }
}

export async function addAttendantToBooking(
  bookingDetailId: number | string,
  payload: BookingAttendantAssignmentPayload,
): Promise<any> {
  return apiRequest<any>(API_ENDPOINTS.attendants.assignToBooking(bookingDetailId), {
    method: "POST",
    requiresAuth: true,
    body: payload,
  });
}

export async function checkBookingCapacity(
  bookingDetailId: number | string,
): Promise<CapacityCheckResult> {
  try {
    const res = await apiRequest<any>(API_ENDPOINTS.attendants.capacityCheck(bookingDetailId), {
      requiresAuth: true,
    });

    return {
      bookingDetailId: Number(bookingDetailId),
      isOverCapacity: Boolean(res?.isOverCapacity ?? res?.IsOverCapacity ?? false),
      capacity: Number(res?.capacity ?? res?.Capacity ?? 0),
      currentAttendants: Number(res?.currentAttendants ?? res?.CurrentAttendants ?? 0),
      availableSeats: Number(res?.availableSeats ?? res?.AvailableSeats ?? 0),
      excessSeatCount: Number(res?.excessSeatCount ?? res?.ExcessSeatCount ?? 0),
      surchargeApplied: Number(res?.surchargeApplied ?? res?.SurchargeApplied ?? 0),
      message: res?.message ?? res?.Message,
    };
  } catch (error) {
    console.warn(`[attendantService] Error checking booking capacity for ${bookingDetailId}`, error);
    return { bookingDetailId: Number(bookingDetailId), isOverCapacity: false };
  }
}

export async function removeAttendantFromBooking(
  bookingDetailId: number | string,
  personId: number | string,
): Promise<any> {
  return apiRequest<any>(API_ENDPOINTS.attendants.removeFromBooking(bookingDetailId, personId), {
    method: "DELETE",
    requiresAuth: true,
  });
}
