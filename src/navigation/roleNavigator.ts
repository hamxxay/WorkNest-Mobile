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

/** Roles whose app may call only its own page(s), auth/me and the push device token (the API answers 403 to the rest). */
const NO_ANNOUNCEMENTS: ReadonlySet<UserRole> = new Set<UserRole>(["ceo", "sales_manager", "access_officer"]);

/**
 * Whether the signed-in app loads the announcements (GET mobile/announcements) in the background (on start, when the
 * app returns to the foreground and on a push). Not for the CEO, the Sales Manager or the Access Officer: the API
 * answers 403 to them on everything but their own dashboard / page, auth/me and the push device token, and their apps
 * have no notifications screen. Their device token is still registered (usePushNotifications).
 */
export function loadsAnnouncements(role: UserRole | null | undefined): boolean {
  return !role || !NO_ANNOUNCEMENTS.has(role);
}
