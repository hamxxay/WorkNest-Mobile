// Deep links and tapped push notifications for the Access Officer app. Pure (no React Native imports), unit-tested
// in links.test.ts; AccessOfficerNavigator wires it into its linking config.
//
// Like the CEO and Sales Manager apps, the Access Officer app has one destination: whatever the link (a customer
// path such as quotation/QUO-1001, a staff or CMS /admin/... path such as admin/access, or a push turned into a
// link by services/notificationService), it opens the Access screen with nothing pushed on top. An Access Officer
// can never be linked into a customer, staff, CEO or Sales Manager screen: those are not registered in its
// navigator, and this state never names them.

import type { NavigationState, PartialState } from "@react-navigation/native";
import { CEO_LINK_PREFIXES } from "../ceo/links";
import type { AccessOfficerStackParamList } from "../accessOfficerTypes";

/** Link prefixes (the same as the other apps': only one navigator is mounted at a time). */
export const ACCESS_OFFICER_LINK_PREFIXES = CEO_LINK_PREFIXES;

/** Navigation state for any link path: the Access screen alone. */
export function accessOfficerStateFromPath(_path?: string): PartialState<NavigationState<AccessOfficerStackParamList>> {
  return { index: 0, routes: [{ name: "AccessOfficerAccess" }] };
}
