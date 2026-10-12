import { StaffNavigator } from "./staff/StaffNavigator";
import type { StaffStackParamList } from "./staffTypes";

/** @deprecated Use StaffStackParamList (./staffTypes). Kept so older imports keep compiling. */
export type SaleStackParamList = StaffStackParamList;

/**
 * Sales executive app: Dashboard, Inquiries, Quotations, Customers and More tabs, own locations only
 * (the API scopes every list to the sales executive's locations). Tabs, screens and menu: ./staff/access.ts.
 */
export default function SaleStack() {
  return <StaffNavigator role="sales_executive" />;
}
