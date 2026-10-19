import { isAdminOrAbove, normalizeRoleName, roleLabel, type StaffRole, type UserRole } from "../../context/roles";
import { cnicError } from "../../utils/cnic";
import { phoneError } from "../../utils/phone";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPatch, staffPost, staffPut, type ActionResult } from "./http";
import { bool, idList, num, optNum, optStr, pick, str, toList, toPage, withQuery, type Page } from "./normalize";

// Users (CMS manage.ts "users"; API UserController). Admin / super admin screen in the app. Admins get the users of
// their own locations; super admins every user. Admins and super admins create and edit users (POST user,
// PUT user/{id}, PATCH user/{id}/activate | deactivate) with the CMS's rules:
//   - only a super admin gives, changes or takes away the Super Admin, Admin, CEO, Sales Manager and Access Officer
//     roles, and only a super admin edits those accounts (API GrantsAdminRole / IsProtectedAsync -> 403);
//   - an admin gives only their own locations (API AssignsForeignLocation -> 400);
//   - editing your own account as an admin leaves your role and locations as they are (the API ignores them);
//   - nobody turns their own account off;
//   - creating needs a password; editing takes an optional new one (blank keeps the current one), 6 to 128
//     characters either way (API UserService MinPasswordLength / MaxPasswordLength).
// The API answers with a message for every outcome (e.g. "User updated. Password changed.", the PW_01 database
// update note, "This email had a deleted account. It has been turned back on with these details."): the screens
// show it as it is.

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  /** super_admin | admin | sales_executive | general */
  role: string;
  /** The role's name from the database (WN_Roles.DisplayName, e.g. "General User"); null from an older API. */
  roleDisplayName: string | null;
  locationId: number | null;
  locationIds: number[];
  /** Comma-joined location names. */
  locationName: string | null;
  createdAt: string | null;
};

export function normalizeUser(raw: any): StaffUser {
  const ids = pick(raw, "locationIds");
  return {
    id: str(raw, "publicId", "id"),
    email: str(raw, "email"),
    // WN_Users.Name as stored; empty when the account has none (the screen then shows the email, never a part of it).
    name: str(raw, "name"),
    phone: optStr(raw, "phone"),
    isActive: raw?.isActive == null && raw?.IsActive == null ? true : bool(raw, "isActive"),
    role: str(raw, "role") || "general",
    roleDisplayName: optStr(raw, "roleDisplayName"),
    locationId: optNum(raw, "locationId"),
    locationIds: Array.isArray(ids) ? idList(ids.map(Number)) : [],
    locationName: optStr(raw, "locationName"),
    createdAt: optStr(raw, "createdAt", "createdOn"),
  };
}

/** GET user?page=&limit=&search= */
export async function listUsers(query: { page?: number; limit?: number; search?: string } = {}): Promise<Page<StaffUser>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(withQuery(STAFF_ENDPOINTS.users.list, { page, limit, search: query.search?.trim() }));
  return toPage(raw, normalizeUser, { page, limit });
}

// ─── Roles (picker) ───────────────────────────────────────────────────────────────────────────────────────

/** A role the Users form can give: its name (as the API takes it) and its label from WN_Roles.DisplayName. */
export type RoleOption = { value: UserRole; label: string };

/** Roles the form knows the rules for, in the CMS's order (utils/constants.ts ASSIGNABLE_ROLES). */
const ASSIGNABLE_ROLES: readonly UserRole[] = ["super_admin", "admin", "general", "sales_executive", "ceo", "sales_manager", "access_officer"];

/** Roles tied to location(s) (CMS LOCATION_ROLES). Super admins, CEOs and customers have none. */
export const LOCATION_ROLES: readonly UserRole[] = ["admin", "sales_executive", "sales_manager", "access_officer"];

/** Accounts only a super admin creates, changes or turns off (API IsProtectedRole). */
const PROTECTED_ROLES: readonly UserRole[] = ["super_admin", "admin", "ceo", "sales_manager", "access_officer"];

/** The role of a user row ("general" when the API sent none the app knows). */
export function userRoleOf(value: unknown): UserRole {
  return normalizeRoleName(value) ?? "general";
}

/** Admin, Sales Executive, Sales Manager and Access Officer work at chosen locations. */
export function isLocationRole(role: unknown): boolean {
  return LOCATION_ROLES.includes(userRoleOf(role));
}

/** Super Admin, Admin, CEO, Sales Manager and Access Officer accounts: a super admin's to manage. */
export function isProtectedUserRole(role: unknown): boolean {
  return PROTECTED_ROLES.includes(userRoleOf(role));
}

/** The app's own labels: only used when GET roles fails or leaves a role out. */
export function fallbackRoleOptions(): RoleOption[] {
  return ASSIGNABLE_ROLES.map((value) => ({ value, label: roleLabel(value) }));
}

/**
 * GET roles answer -> picker options: the known roles in the API's order, labelled by WN_Roles.DisplayName (the
 * app's label only when it is blank); a known role the API left out keeps its fallback entry at the end (CMS
 * loadRoles).
 */
export function normalizeRoleOptions(raw: unknown): RoleOption[] {
  const rows = toList(raw, (r) => ({ role: normalizeRoleName(pick(r, "roleName", "name")), label: optStr(r, "displayName") }));
  const seen = new Set<UserRole>();
  const options: RoleOption[] = [];
  for (const row of rows) {
    if (!row.role || !ASSIGNABLE_ROLES.includes(row.role) || seen.has(row.role)) continue;
    seen.add(row.role);
    options.push({ value: row.role, label: row.label ?? roleLabel(row.role) });
  }
  for (const value of ASSIGNABLE_ROLES) if (!seen.has(value)) options.push({ value, label: roleLabel(value) });
  return options;
}

/** GET roles: [{ id, roleName, displayName }] (admin / super admin; 503 before the database update SM_01). */
export async function getRoleOptions(): Promise<RoleOption[]> {
  return normalizeRoleOptions(await staffGet(STAFF_ENDPOINTS.users.roles));
}

/** Label of a role from the picker options (WN_Roles.DisplayName), the app's own label as a fallback. */
export function roleOptionLabel(options: readonly RoleOption[], role: unknown): string {
  const r = userRoleOf(role);
  return options.find((o) => o.value === r)?.label ?? roleLabel(r);
}

/** "Admin, Sales Executive, Sales Manager and Access Officer", worded by the database (CMS locationRoleNames). */
export function locationRoleNames(options: readonly RoleOption[]): string {
  const names = LOCATION_ROLES.map((r) => roleOptionLabel(options, r));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

// ─── Who may do what (CMS rolesICanAssign / canEditUser / canLockOrDeleteUser; API UserController) ─────────

/** The signed-in staff member, as the Users rules need them. */
export type UserCaller = { role: StaffRole; email: string | null | undefined };

/** Only admins and super admins create or edit users (API ManageRoles); everyone else gets the read-only list. */
export function canManageUsers(role: StaffRole | null | undefined): boolean {
  return isAdminOrAbove(role ?? null);
}

/** A super admin gives every role; an admin only Sales Executive and customer (General User). */
export function rolesICanAssign(callerRole: StaffRole, options: readonly RoleOption[]): RoleOption[] {
  if (callerRole === "super_admin") return [...options];
  if (!canManageUsers(callerRole)) return [];
  return options.filter((o) => o.value === "sales_executive" || o.value === "general");
}

/** The signed-in user's own row (matched on the email, as the API does). */
export function isOwnAccount(callerEmail: string | null | undefined, user: Pick<StaffUser, "email">): boolean {
  const me = (callerEmail ?? "").trim().toLowerCase();
  return !!me && (user.email ?? "").trim().toLowerCase() === me;
}

/** A super admin edits everyone; an admin edits their own profile and the users below them. */
export function canEditUser(caller: UserCaller, user: Pick<StaffUser, "email" | "role">): boolean {
  if (!canManageUsers(caller.role)) return false;
  return caller.role === "super_admin" || isOwnAccount(caller.email, user) || !isProtectedUserRole(user.role);
}

/** Turn on / off: never your own account; an admin can't turn off a super admin's accounts (above). */
export function canChangeUserStatus(caller: UserCaller, user: Pick<StaffUser, "email" | "role">): boolean {
  if (!canManageUsers(caller.role) || isOwnAccount(caller.email, user)) return false;
  return caller.role === "super_admin" || !isProtectedUserRole(user.role);
}

/** Editing your own account as an admin: name, phone, password etc. only; role and locations stay (API). */
export function editsOwnAccountAsAdmin(caller: UserCaller, user: Pick<StaffUser, "email"> | null | undefined): boolean {
  return !!user && caller.role !== "super_admin" && isOwnAccount(caller.email, user);
}

/**
 * Locations the caller may give: all for a super admin; only their own for an admin. When the admin's own ids are
 * not known (profile not loaded), the API's location list, which already holds only their locations.
 */
export function assignableLocations<T extends { id: number }>(
  callerRole: StaffRole,
  ownLocationIds: readonly number[] | null | undefined,
  locations: readonly T[],
): T[] {
  if (callerRole === "super_admin") return [...locations];
  const own = new Set(idList(ownLocationIds ? [...ownLocationIds] : []));
  if (!own.size) return [...locations];
  return locations.filter((l) => own.has(l.id));
}

/** An admin with a single location: it is fixed for the users they add or edit (CMS userLocationLocked). */
export function userLocationLocked(callerRole: StaffRole, assignableIds: readonly number[]): boolean {
  return callerRole !== "super_admin" && assignableIds.length === 1;
}

// ─── Form ─────────────────────────────────────────────────────────────────────────────────────────────────

export type UserInput = {
  name: string;
  email: string;
  /** Create: required. Edit: a new password, blank keeps the current one. */
  password: string;
  role: UserRole;
  /** Primary location (WN_Users.LocationId): kept when still ticked, otherwise the first ticked one. */
  locationId: number | null;
  locationIds: number[];
  phone: string;
  cnicOrPassport: string;
  cityId: number | null;
  address: string;
  notes: string;
};

export type UserField = keyof UserInput;

export type UserFormContext = {
  callerRole: StaffRole;
  /** Editing an existing user (PUT) rather than creating one (POST). */
  editing: boolean;
  /** Editing your own account as an admin: role and locations are neither checked nor sent. */
  ownAccount: boolean;
  /** Ids of the locations the caller may give (assignableLocations). */
  assignableLocationIds: readonly number[];
  /** Roles the caller may give (rolesICanAssign). */
  assignableRoles: readonly RoleOption[];
  /** Every role option, for the labels in messages (WN_Roles.DisplayName). */
  roleOptions?: readonly RoleOption[];
};

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Blank form for a new user: a customer (General User), the admin's own primary location ready if they pick a role that needs one. */
export function newUserInput(callerRole: StaffRole, assignableIds: readonly number[], primaryLocationId?: number | null): UserInput {
  const bound = callerRole !== "super_admin";
  const locked = userLocationLocked(callerRole, assignableIds);
  const primary = locked
    ? assignableIds[0]
    : bound && primaryLocationId && assignableIds.includes(primaryLocationId)
    ? primaryLocationId
    : null;
  return {
    name: "",
    email: "",
    password: "",
    role: "general",
    locationId: primary,
    locationIds: primary ? [primary] : [],
    phone: "",
    cnicOrPassport: "",
    cityId: null,
    address: "",
    notes: "",
  };
}

/**
 * Form values for editing a user from their list row. The list (and GET user/{id}) carries no CNIC, city, address
 * or notes: they start blank, and a blank one is sent as null, which keeps what is saved (WN_Users_Update).
 */
export function userToInput(user: StaffUser): UserInput {
  const ids = user.locationIds.length ? user.locationIds : user.locationId && user.locationId > 0 ? [user.locationId] : [];
  return {
    name: user.name,
    email: user.email,
    password: "",
    role: userRoleOf(user.role),
    locationId: user.locationId,
    locationIds: [...ids],
    phone: user.phone ?? "",
    cnicOrPassport: "",
    cityId: null,
    address: "",
    notes: "",
  };
}

/** The role picker changed (CMS onFieldChange "role"): no locations for a role without them; the only one when locked. */
export function withRole(input: UserInput, role: UserRole, ctx: Pick<UserFormContext, "callerRole" | "assignableLocationIds">): UserInput {
  if (!isLocationRole(role)) return { ...input, role, locationId: null, locationIds: [] };
  if (userLocationLocked(ctx.callerRole, ctx.assignableLocationIds)) {
    const only = ctx.assignableLocationIds[0];
    return { ...input, role, locationId: only, locationIds: [only] };
  }
  return { ...input, role };
}

/** Ticks / unticks a location (nothing changes while the caller's single location is locked). */
export function toggleUserLocation(
  input: UserInput,
  locationId: number,
  checked: boolean,
  ctx: Pick<UserFormContext, "callerRole" | "assignableLocationIds">,
): UserInput {
  if (userLocationLocked(ctx.callerRole, ctx.assignableLocationIds)) return input;
  const current = input.locationIds.filter((id) => id !== locationId);
  return { ...input, locationIds: checked ? [...current, locationId] : current };
}

/**
 * The locations to send (CMS save): none for a role without locations; for an admin only their own (all of them
 * when locked to one); the primary kept when still ticked, otherwise the first.
 */
export function resolveUserLocations(input: UserInput, ctx: Pick<UserFormContext, "callerRole" | "assignableLocationIds">): {
  locationId: number | null;
  locationIds: number[];
} {
  if (!isLocationRole(input.role)) return { locationId: null, locationIds: [] };
  let ids = [...new Set(idList(input.locationIds))];
  if (ctx.callerRole !== "super_admin") {
    const mine = idList([...ctx.assignableLocationIds]);
    ids = userLocationLocked(ctx.callerRole, mine) ? mine : ids.filter((id) => mine.includes(id));
  }
  const locationId = input.locationId && ids.includes(input.locationId) ? input.locationId : ids[0] ?? null;
  return { locationId, locationIds: ids };
}

/** Field errors, with the CMS's messages; an empty object when the form can be sent. */
export function validateUserInput(input: UserInput, ctx: UserFormContext): Partial<Record<UserField, string>> {
  const errors: Partial<Record<UserField, string>> = {};
  if (!input.name.trim()) errors.name = "Full Name is required.";
  if (!ctx.editing) {
    // The email is the sign-in name: it is set when the user is created and can't be changed (no Email in PUT).
    const email = input.email.trim();
    if (!email) errors.email = "Email address is required.";
    else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address (e.g. user@example.com).";
  }
  const password = input.password.trim();
  if (!ctx.editing && !password) errors.password = "Password is required for new users.";
  else if (password && (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH))
    errors.password = `The password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`;
  const phone = phoneError(input.phone);
  if (phone) errors.phone = phone;
  const cnic = cnicError(input.cnicOrPassport);
  if (cnic) errors.cnicOrPassport = cnic;
  if (!ctx.ownAccount) {
    if (!ctx.assignableRoles.some((r) => r.value === input.role)) errors.role = "Choose a role.";
    else if (isLocationRole(input.role) && !resolveUserLocations(input, ctx).locationId) {
      errors.locationIds =
        ctx.callerRole !== "super_admin"
          ? "Choose at least one of your locations."
          : `Location is required for ${roleOptionLabel(ctx.roleOptions ?? ctx.assignableRoles, input.role)} role.`;
    }
  }
  return errors;
}

const clean = (value: string | null | undefined): string | null => {
  const t = (value ?? "").trim();
  return t ? t : null;
};

/** The fields both POST and PUT take. Blank ones are null: on PUT that keeps what is saved. */
function commonFields(input: UserInput) {
  return {
    name: input.name.trim(),
    cityId: input.cityId != null && input.cityId > 0 ? input.cityId : null,
    phone: clean(input.phone),
    cnicOrPassport: clean(input.cnicOrPassport),
    address: clean(input.address),
    notes: clean(input.notes),
  };
}

/** POST user body (UserCreateRequest), as the CMS sends it. */
export function buildCreateUserPayload(input: UserInput, ctx: UserFormContext) {
  const { locationId, locationIds } = resolveUserLocations(input, ctx);
  return {
    ...commonFields(input),
    email: input.email.trim(),
    password: input.password.trim(),
    role: input.role,
    locationId,
    locationIds,
  };
}

/**
 * PUT user/{id} body (UserUpdateRequest). No email (the API can't change it). The password only when one was typed
 * (blank keeps the current one). Your own account as an admin: no role or locations (the API keeps them anyway).
 */
export function buildUpdateUserPayload(input: UserInput, ctx: UserFormContext) {
  const password = input.password.trim();
  const body: Record<string, unknown> = { ...commonFields(input) };
  if (!ctx.ownAccount) {
    const { locationId, locationIds } = resolveUserLocations(input, ctx);
    body.role = input.role;
    body.locationId = locationId;
    body.locationIds = locationIds;
  }
  if (password) body.password = password;
  return body;
}

function firstError(errors: Partial<Record<UserField, string>>): string | null {
  const values = Object.values(errors);
  return values.length ? (values[0] as string) : null;
}

/** What POST user answers: the new (or turned back on) account. */
export type CreatedUser = { id: number | null; publicId: string | null; restored: boolean };

/**
 * POST user. The message is the API's own: "User created successfully.", a note about what could not be saved, or
 * "This email had a deleted account. It has been turned back on with these details." Throws (readable message) on
 * invalid input or when the API refuses.
 */
export async function createUser(input: UserInput, ctx: UserFormContext): Promise<ActionResult<CreatedUser>> {
  const invalid = firstError(validateUserInput(input, { ...ctx, editing: false, ownAccount: false }));
  if (invalid) throw new Error(invalid);
  const raw = await staffPost(STAFF_ENDPOINTS.users.create, buildCreateUserPayload(input, ctx));
  const result = actionResult<any>(raw, "User created successfully.");
  const id = num(result.data, "id");
  return {
    message: result.message,
    data: { id: id > 0 ? id : null, publicId: optStr(result.data, "publicId"), restored: bool(result.data, "restored") },
  };
}

/**
 * PUT user/{id} (int id or public id). The message is the API's own ("User updated.", "User updated. Password
 * changed.", ...). A refusal throws with the API's message, e.g. the PW_01 database update note (the other changes
 * were saved then; the password was not changed).
 */
export async function updateUser(id: number | string, input: UserInput, ctx: UserFormContext): Promise<ActionResult<null>> {
  const invalid = firstError(validateUserInput(input, { ...ctx, editing: true }));
  if (invalid) throw new Error(invalid);
  const raw = await staffPut(STAFF_ENDPOINTS.users.update(id), buildUpdateUserPayload(input, { ...ctx, editing: true }));
  return { message: actionResult(raw, "User updated.").message, data: null };
}

/** PATCH user/{id}/activate | deactivate (not on your own account; a super admin's accounts need a super admin). */
export async function setUserActive(id: number | string, active: boolean): Promise<ActionResult<null>> {
  const path = active ? STAFF_ENDPOINTS.users.activate(id) : STAFF_ENDPOINTS.users.deactivate(id);
  const raw = await staffPatch(path, {});
  return { message: actionResult(raw, active ? "User activated." : "User deactivated.").message, data: null };
}
