import { cnicError } from "../../utils/cnic";
import { phoneError } from "../../utils/phone";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPost, staffPut, type ActionResult } from "./http";
import { bool, num, optNum, optStr, str, toList, toPage, unwrapEnvelope, withQuery, type Page } from "./normalize";

// Customers (CMS admin.service.ts getCustomers / searchCustomers / getCustomerById / createCustomer /
// updateCustomer; API CustomerController). Roles: admin, super admin, sales executive (and receptionist).
//
// API facts the screens rely on:
//   - GET customer returns a bare array (no total), newest first, inactive customers included; the list and
//     search are NOT location-filtered. GET/PUT customer/{id} are: a location-bound admin / sales executive gets
//     404 "Customer not found." for a customer of another location.
//   - POST answers HTTP 201 even when it fails (isSuccessful: false); apiClient turns that into an ApiError.
//   - PUT must send the whole customer: firstName and email are required, and null means "leave unchanged"
//     (a field can't be cleared).
//   - Server rules (validated here too, same messages): CNIC 13 digits when given, phone 11-15 digits when
//     given, Company / AOP need a company name and an 8-digit NTN, email must be unique.

export type CustomerType = "Individual" | "Company" | "AOP";

export type StaffCustomer = {
  id: number;
  idGuid: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string | null;
  /** Derived like the CMS: no company (or "Individual") = Individual, otherwise Company. */
  customerType: CustomerType;
  email: string;
  phoneNumber: string | null;
  cnicOrPassport: string | null;
  address: string | null;
  cityId: number | null;
  /** Always null in the list (filled by GET customer/{id} and search). */
  cityName: string | null;
  notes: string | null;
  ntn: string | null;
  secpRegistrationNo: string | null;
  isActive: boolean;
  createdAt: string | null;
};

export function normalizeCustomer(raw: any): StaffCustomer {
  const firstName = str(raw, "firstName");
  const lastName = str(raw, "lastName");
  const company = optStr(raw, "company");
  const explicitType = optStr(raw, "customerType");
  const customerType: CustomerType =
    explicitType && /^(company|business)$/i.test(explicitType)
      ? "Company"
      : explicitType && /^aop$/i.test(explicitType)
      ? "AOP"
      : company && company.toLowerCase() !== "individual"
      ? "Company"
      : "Individual";
  return {
    id: num(raw, "id", "customerId"),
    idGuid: str(raw, "idGUID", "idGuid", "publicId", "guid"),
    code: str(raw, "code", "customerCode"),
    firstName,
    lastName,
    fullName: str(raw, "fullName") || `${firstName} ${lastName}`.trim(),
    company,
    customerType,
    email: str(raw, "email"),
    phoneNumber: optStr(raw, "phoneNumber", "phone"),
    cnicOrPassport: optStr(raw, "cnicOrPassport", "cnic"),
    address: optStr(raw, "address"),
    cityId: optNum(raw, "cityId"),
    cityName: optStr(raw, "cityName"),
    notes: optStr(raw, "notes"),
    ntn: optStr(raw, "ntn", "NTN"),
    secpRegistrationNo: optStr(raw, "secpRegistrationNo"),
    isActive: raw?.isActive == null && raw?.IsActive == null ? true : bool(raw, "isActive"),
    createdAt: optStr(raw, "createdAt"),
  };
}

/**
 * GET customer?page=&limit=&search= — search matches first / last name, company, email, code, phone.
 * The API sends no total: `hasMore` is true while full pages come back.
 */
export async function listCustomers(
  query: { page?: number; limit?: number; search?: string } = {},
): Promise<Page<StaffCustomer>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.customers.list, { page, limit, search: query.search?.trim() }));
  return toPage(raw, normalizeCustomer, { page, limit });
}

/** GET customer/search?q= — top 20 active customers (for pickers). An empty query returns the first 20. */
export async function searchCustomers(q: string): Promise<StaffCustomer[]> {
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.customers.search, { q: q.trim() || undefined }));
  return toList(raw, normalizeCustomer);
}

/** True when a customer payload carries the tax ids at all (the list does; older GET customer/{id} does not). */
function hasTaxIdFields(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return ["ntn", "NTN", "Ntn", "secpRegistrationNo", "SecpRegistrationNo"].some((key) => key in (raw as object));
}

/** `customer` with NTN / SECP number taken from `row` (a list row of the same customer) where it has none. */
export function withTaxIds(customer: StaffCustomer, row: Pick<StaffCustomer, "id" | "ntn" | "secpRegistrationNo"> | null | undefined): StaffCustomer {
  if (!row || (customer.id > 0 && row.id !== customer.id)) return customer;
  return {
    ...customer,
    ntn: customer.ntn ?? row.ntn,
    secpRegistrationNo: customer.secpRegistrationNo ?? row.secpRegistrationNo,
  };
}

/** The customer's list row (GET customer?search=), which carries the NTN / SECP number; null when not found. */
async function findCustomerRow(customer: StaffCustomer): Promise<StaffCustomer | null> {
  const search = customer.email || customer.code;
  if (!search) return null;
  const page = await listCustomers({ page: 1, limit: 20, search });
  return page.items.find((c) => c.id === customer.id) ?? null;
}

/**
 * GET customer/{id} (int id or GUID). When the detail has no ntn / secpRegistrationNo fields (older API), they
 * come from `listRow` (the row the screen came from) or, with `taxIds` (screens that show or send them) for a
 * company / AOP customer, from its row in the customer list: editing never shows an existing NTN as empty.
 */
export async function getCustomer(
  id: number | string,
  options: { listRow?: StaffCustomer | null; taxIds?: boolean } = {},
): Promise<StaffCustomer> {
  const { listRow, taxIds = false } = options;
  const raw = unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.customers.byId(id)));
  const customer = normalizeCustomer(raw);
  if (hasTaxIdFields(raw)) return customer;
  // The row the screen came from is the list's (or an already completed) view of the customer: enough.
  if (listRow && listRow.id === customer.id) return withTaxIds(customer, listRow);
  if (!taxIds || customer.customerType === "Individual") return customer;
  try {
    return withTaxIds(customer, await findCustomerRow(customer));
  } catch {
    return customer;
  }
}

/**
 * The form values to send when editing: a blank NTN / SECP number keeps the customer's existing one (the API
 * can't clear them, and a blank NTN must never replace a real one).
 */
export function keepExistingTaxIds(input: CustomerInput, existing: Pick<StaffCustomer, "ntn" | "secpRegistrationNo"> | null | undefined): CustomerInput {
  if (!existing) return input;
  return {
    ...input,
    ntn: input.ntn?.trim() ? input.ntn : existing.ntn ?? input.ntn,
    secpRegistrationNo: input.secpRegistrationNo?.trim() ? input.secpRegistrationNo : existing.secpRegistrationNo ?? input.secpRegistrationNo,
  };
}

// ─── Create / update ──────────────────────────────────────────────────────────────────────────────────────

export type CustomerInput = {
  customerType: CustomerType;
  firstName: string;
  lastName?: string;
  /** Required for Company / AOP. */
  company?: string;
  email: string;
  phoneNumber?: string;
  cnicOrPassport?: string;
  address?: string;
  cityId?: number | null;
  notes?: string;
  /** Required for Company / AOP: 8 digits, e.g. 1234567-8. */
  ntn?: string;
  secpRegistrationNo?: string;
  isActive?: boolean;
};

export type CustomerField = keyof CustomerInput;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field errors (same rules and messages as the API); empty object when valid. */
export function validateCustomerInput(input: CustomerInput): Partial<Record<CustomerField, string>> {
  const errors: Partial<Record<CustomerField, string>> = {};
  const isCompany = input.customerType === "Company" || input.customerType === "AOP";
  if (!input.firstName?.trim()) errors.firstName = "First name is required.";
  const email = input.email?.trim() ?? "";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  const phone = phoneError(input.phoneNumber ?? "");
  if (phone) errors.phoneNumber = phone;
  const cnic = cnicError(input.cnicOrPassport ?? "");
  if (cnic) errors.cnicOrPassport = cnic;
  if (isCompany) {
    if (!input.company?.trim()) errors.company = "Company / Business Name is required for company customers.";
    const ntn = (input.ntn ?? "").trim();
    if (!ntn) errors.ntn = "NTN (National Tax Number) is required when Entity Type is Company.";
    else if (!/^\d{8}$/.test(ntn.replace(/-/g, ""))) errors.ntn = "Please enter a valid 8-digit NTN (e.g. 1234567-8).";
  }
  return errors;
}

const clean = (value: string | undefined | null): string | null => {
  const t = (value ?? "").trim();
  return t ? t : null;
};

/** CustomerRequest body as the CMS sends it (company null for individuals, cityId null when not picked). */
export function buildCustomerPayload(input: CustomerInput) {
  const isCompany = input.customerType === "Company" || input.customerType === "AOP";
  return {
    customerType: input.customerType,
    firstName: input.firstName.trim(),
    lastName: clean(input.lastName),
    company: isCompany ? clean(input.company) : null,
    email: input.email.trim(),
    phoneNumber: clean(input.phoneNumber),
    cnicOrPassport: clean(input.cnicOrPassport),
    address: clean(input.address),
    cityId: input.cityId != null && input.cityId > 0 ? input.cityId : null,
    notes: clean(input.notes),
    ntn: isCompany ? clean(input.ntn) : null,
    secpRegistrationNo: isCompany ? clean(input.secpRegistrationNo) : null,
    isActive: input.isActive !== false,
  };
}

function firstError(errors: Partial<Record<CustomerField, string>>): string | null {
  const values = Object.values(errors);
  return values.length ? (values[0] as string) : null;
}

/** POST customer. Throws (readable message) on invalid input or when the API refuses (e.g. duplicate email). */
export async function createCustomer(input: CustomerInput): Promise<ActionResult<StaffCustomer>> {
  const invalid = firstError(validateCustomerInput(input));
  if (invalid) throw new Error(invalid);
  const raw = await staffPost(STAFF_ENDPOINTS.customers.create, buildCustomerPayload(input));
  const result = actionResult<any>(raw, "Customer created successfully.");
  return { message: result.message, data: normalizeCustomer(result.data) };
}

/** PUT customer/{id} with the whole customer (int id or GUID). */
export async function updateCustomer(id: number | string, input: CustomerInput): Promise<ActionResult<StaffCustomer>> {
  const invalid = firstError(validateCustomerInput(input));
  if (invalid) throw new Error(invalid);
  const raw = await staffPut(STAFF_ENDPOINTS.customers.update(id), buildCustomerPayload(input));
  const result = actionResult<any>(raw, "Customer updated successfully.");
  return { message: result.message, data: normalizeCustomer(result.data) };
}

/** Form values for editing an existing customer. */
export function customerToInput(c: StaffCustomer): CustomerInput {
  return {
    customerType: c.customerType,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company ?? "",
    email: c.email,
    phoneNumber: c.phoneNumber ?? "",
    cnicOrPassport: c.cnicOrPassport ?? "",
    address: c.address ?? "",
    cityId: c.cityId,
    notes: c.notes ?? "",
    ntn: c.ntn ?? "",
    secpRegistrationNo: c.secpRegistrationNo ?? "",
    isActive: c.isActive,
  };
}

// ─── Cities (customer form) ───────────────────────────────────────────────────────────────────────────────

export type City = { id: number; name: string };

/** GET city — active cities, A-Z (no login needed). */
export async function getCities(): Promise<City[]> {
  const raw = await staffGet(STAFF_ENDPOINTS.cities);
  return toList(raw, (c) => ({ id: num(c, "id"), name: str(c, "name") })).filter((c) => c.id > 0 && c.name);
}
