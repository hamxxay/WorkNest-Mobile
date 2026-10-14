import type { UserRole } from "../context/roles";

// Which navigator RootNavigator mounts for a role. Pure (no React), unit-tested in roleNavigator.test.ts, so the
// rule "a CEO only ever gets the CEO app" is checked without rendering anything.
//
//   "ceo"              -> CeoNavigator     (CEO dashboard + drill-down + profile; nothing else)
//   "super_admin"      -> SuperAdminStack
//   "admin"            -> AdminStack
//   "sales_executive"  -> SaleStack
//   "general" / signed out / anything else -> AppNavigator (customer app)

export type RoleNavigatorName = "ceo" | "super_admin" | "admin" | "sales_executive" | "customer";

export function navigatorForRole(role: UserRole | null | undefined): RoleNavigatorName {
  switch (role) {
    case "ceo":
      return "ceo";
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
