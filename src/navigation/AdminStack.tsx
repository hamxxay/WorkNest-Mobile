import { StaffNavigator } from "./staff/StaffNavigator";
import type { StaffStackParamList } from "./staffTypes";

/** @deprecated Use StaffStackParamList (./staffTypes). Kept so older imports keep compiling. */
export type AdminStackParamList = StaffStackParamList;

/**
 * Admin app: Dashboard, Approvals (capacity requests), Bookings, Customers and More tabs, own locations only
 * (the API scopes admins to their locations). Tabs, screens and menu: ./staff/access.ts.
 */
export default function AdminStack() {
  return <StaffNavigator role="admin" />;
}
