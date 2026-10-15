// Deep links and tapped push notifications for the CEO app. Pure (no React Native imports), unit-tested in
// links.test.ts; CeoNavigator wires it into its linking config.
//
// The CEO app has one destination: whatever the link (a customer path like quotation/QUO-1001, a staff or CMS
// /admin/... path, or a push turned into a link by services/notificationService), it opens the CEO dashboard, with
// nothing pushed on top. A CEO can never be linked into a customer or staff screen: those are not registered in
// its navigator, and this state never names them.

import type { NavigationState, PartialState } from "@react-navigation/native";
import type { CeoStackParamList } from "../ceoTypes";
import { APP_LINK_PREFIXES } from "../appLinks";

/** Link prefixes (the same as the other apps': only one navigator is mounted at a time). */
export const CEO_LINK_PREFIXES = APP_LINK_PREFIXES;

/** Navigation state for any link path: the CEO dashboard alone. */
export function ceoStateFromPath(_path?: string): PartialState<NavigationState<CeoStackParamList>> {
  return { index: 0, routes: [{ name: "CeoDashboard" }] };
}
