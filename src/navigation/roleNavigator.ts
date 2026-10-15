import type { UserRole } from "../context/roles";

// Which navigator RootNavigator mounts for a role. Pure (no React), unit-tested in roleNavigator.test.ts, so the
// rules "a CEO only ever gets the CEO app", "a Sales Manager only ever gets the Sales Manager app" and "an Access
// Officer only ever gets the Access Officer app" are checked without rendering anything.
//
//   "ceo"              -> CeoNavigator           (CEO dashboard + drill-down + profile; nothing else)
//   "sales_manager"    -> SalesManagerNavigator  (sales dashboard + drill-down + profile; nothing else)
//   "access_officer"   -> AccessOfficerNavigator (Access screen + profile; nothing else)
//   "super_admin"      -> SuperAdminStack
//   "admin"            -> AdminStack
//   "sales_executive"  -> SaleStack
//   "general" / signed out / anything else -> AppNavigator (customer app)

export type RoleNavigatorName =
  | "ceo"
  | "sales_manager"
  | "access_officer"
  | "super_admin"
  | "admin"
  | "sales_executive"
  | "customer";

export function navigatorForRole(role: UserRole | null | undefined): RoleNavigatorName {
  switch (role) {
    case "ceo":
      return "ceo";
    case "sales_manager":
      return "sales_manager";
    case "access_officer":
      return "access_officer";
    case "super_admin":
      return "super_admin";
    case "admin":
      return "admin";
    case "sales_executive":
      return "sales_executive";
    default:
      return "customer";
  }
}

/**
 * Whether the signed-in app loads the announcements (GET mobile/announcements) in the background. Not for the
 * Access Officer: the API answers 403 on everything but the Access page, auth/me and the push device token, and its
 * app has no notifications screen. (The CEO and Sales Manager apps have none either and are left as they are.)
 */
export function loadsAnnouncements(role: UserRole | null | undefined): boolean {
  return role !== "access_officer";
}
