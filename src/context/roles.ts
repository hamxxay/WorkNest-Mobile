// Role model shared by AuthContext and the staff navigators. Pure (no React / React Native imports) so it can be
// unit-tested on its own.
//
// Where roles come from:
//   - The API only ever issues the canonical names below (WorkNest.Common.Constants.Roles): /auth/login,
//     /auth/google-login and /auth/me all return { role, roles: [role] }, e.g. "super_admin".
//   - [Authorize(Roles=...)] attributes also accept the Pascal-case spellings (SuperAdmin, SalesExecutive), and
//     Roles.ReverseMap accepts "superadmin", "super admin", "administrator", "general_user", and the numeric
//     RoleIds (1 super admin, 2 admin, 14 general, 16 sales executive). We accept all of those here.
//   - The web CMS (AuthService.hasRole) compares roles lower-cased with spaces and underscores removed; the
//     same normalisation is used below, plus dashes.
//
// Receptionist: the API has no receptionist RoleId (Roles.FromRow falls back to "general"), and the CMS admin
// guard sends a receptionist to /unauthorized (it is not a CMS sidebar role). A receptionist therefore gets the
// customer app ("general").

export type UserRole = "general" | "sales_executive" | "admin" | "super_admin";
export type StaffRole = Exclude<UserRole, "general">;

export const STAFF_ROLES: readonly StaffRole[] = ["sales_executive", "admin", "super_admin"];

/** Higher wins when a user carries several roles (CMS: an admin who is also a sales executive is an admin). */
const ROLE_RANK: Record<UserRole, number> = {
  general: 0,
  sales_executive: 1,
  admin: 2,
  super_admin: 3,
};

/** Keys are lower-cased with spaces, underscores and dashes removed. */
const ROLE_ALIASES: Record<string, UserRole> = {
  superadmin: "super_admin",
  "1": "super_admin",
  admin: "admin",
  administrator: "admin",
  "2": "admin",
  salesexecutive: "sales_executive",
  "16": "sales_executive",
  general: "general",
  generaluser: "general",
  customer: "general",
  guest: "general",
  receptionist: "general",
  "14": "general",
};

const roleKey = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/** Maps any role spelling the API / CMS uses to a UserRole; null when the text is not a known role. */
export function normalizeRoleName(value: unknown): UserRole | null {
  if (value == null) return null;
  const key = roleKey(value);
  if (!key) return null;
  return ROLE_ALIASES[key] ?? null;
}

/** The fields of the stored user that can carry a role (StoredUser is a superset of this). */
export type RoleSource = {
  role?: unknown;
  roles?: unknown;
  userType?: unknown;
  userRole?: unknown;
  isAdmin?: unknown;
} | null | undefined;

function roleCandidates(user: NonNullable<RoleSource>): unknown[] {
  const list: unknown[] = [];
  if (Array.isArray(user.roles)) list.push(...user.roles);
  else if (typeof user.roles === "string") list.push(...user.roles.split(","));
  list.push(user.role, user.userType, user.userRole);
  return list;
}

/** Every known role the user carries (deduplicated, in rank order, highest first). */
export function rolesOf(user: RoleSource): UserRole[] {
  if (!user) return [];
  const found = new Set<UserRole>();
  for (const candidate of roleCandidates(user)) {
    const role = normalizeRoleName(candidate);
    if (role) found.add(role);
  }
  // Legacy flag some older payloads carried.
  if (user.isAdmin === true || (typeof user.isAdmin === "string" && user.isAdmin.trim().toLowerCase() === "true")) {
    found.add("admin");
  }
  return [...found].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

/** The experience to show: the highest-ranked role the user carries, "general" when none. */
export function resolveRole(user: RoleSource): UserRole {
  return rolesOf(user)[0] ?? "general";
}

/** True when the user carries `role` (CMS AuthService.hasRole: an exact match, not "at least"). */
export function hasRole(user: RoleSource, role: UserRole): boolean {
  return rolesOf(user).includes(role);
}

export function isStaffRole(role: UserRole | null | undefined): role is StaffRole {
  return role === "sales_executive" || role === "admin" || role === "super_admin";
}

/** Admin or super admin (the API's "admin,Admin,super_admin,SuperAdmin" role list; CMS `adminOnly`). */
export function isAdminOrAbove(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** Super admin only (CMS `superAdminOnly`: Space Config, Challan Validity, machine locations / admins). */
export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin";
}

/** Sales executives and admins only see their own location(s); super admins see every location (CMS isLocationBound). */
export function isLocationBound(role: UserRole | null | undefined): boolean {
  return role === "sales_executive" || role === "admin";
}

/** Label shown in the UI, e.g. "Super Admin". */
export function roleLabel(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "sales_executive":
      return "Sales Executive";
    default:
      return "Customer";
  }
}
