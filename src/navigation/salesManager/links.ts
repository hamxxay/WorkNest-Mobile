// Deep links and tapped push notifications for the Sales Manager app. Pure (no React Native imports), unit-tested
// in links.test.ts; SalesManagerNavigator wires it into its linking config.
//
// Like the CEO app, the Sales Manager app has one destination: whatever the link (a customer path such as
// quotation/QUO-1001, a staff or CMS /admin/... path, or a push turned into a link by services/notificationService),
// it opens the sales dashboard with nothing pushed on top. A Sales Manager can never be linked into a customer,
// staff or CEO screen: those are not registered in its navigator, and this state never names them.

import type { NavigationState, PartialState } from "@react-navigation/native";
import { CEO_LINK_PREFIXES } from "../ceo/links";
import type { SalesManagerStackParamList } from "../salesManagerTypes";

/** Link prefixes (the same as the other apps': only one navigator is mounted at a time). */
export const SALES_MANAGER_LINK_PREFIXES = CEO_LINK_PREFIXES;

/** Navigation state for any link path: the sales dashboard alone. */
export function salesManagerStateFromPath(_path?: string): PartialState<NavigationState<SalesManagerStackParamList>> {
  return { index: 0, routes: [{ name: "SalesManagerDashboard" }] };
}
