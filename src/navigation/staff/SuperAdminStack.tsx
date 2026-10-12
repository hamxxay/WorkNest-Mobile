import { StaffNavigator } from "./StaffNavigator";

/**
 * Super admin app: the admin app plus the super admin dashboard sections (location comparison, staff overview,
 * system health), Challan Validity, and every location. Tabs, screens and menu: ./access.ts.
 */
export default function SuperAdminStack() {
  return <StaffNavigator role="super_admin" />;
}
