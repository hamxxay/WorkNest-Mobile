import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, idList, optNum, optStr, pick, str, toPage, withQuery, type Page } from "./normalize";

// Users, read-only (CMS manage.ts "users"; API UserController GET api/user). Admin / super admin screen in the
// app. Admins get the users of their own locations; super admins every user. Editing roles / locations stays in
// the CMS (super admin only there).

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
