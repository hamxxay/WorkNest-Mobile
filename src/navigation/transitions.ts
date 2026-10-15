// Screen transitions shared by the customer (AppNavigator), staff (StaffNavigator), CEO (CeoNavigator), Sales
// Manager (SalesManagerNavigator) and Access Officer (AccessOfficerNavigator) navigators.
// Pure data + helpers (no React), unit-tested in transitions.test.ts. Guide: src/components/ui/docs/tab-bar.md
//
//   push   pushed detail / list screens                      slide_from_right, swipe back
//   modal  forms and task flows opened over the current page slide_from_bottom, swipe back
//   fade   swaps that are not "forward": tab roots, splash /  fade
//          onboarding / auth <-> app, sign in <-> sign up
//
// With the system "reduce motion" setting on (useReduceMotion()), every transition is `animation: "none"`.

import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { AccessOfficerRouteName } from "./accessOfficerTypes";
import type { CeoRouteName } from "./ceoTypes";
import type { SalesManagerRouteName } from "./salesManagerTypes";
import type { StaffRouteName } from "./staffTypes";
import type { AppStackParamList } from "./types";

export type StackTransition = "push" | "modal" | "fade";

const ANIMATION: Record<StackTransition, NativeStackNavigationOptions["animation"]> = {
  push: "slide_from_right",
  modal: "slide_from_bottom",
  fade: "fade",
};

/** Native-stack options for one kind of transition. */
export function stackTransition(
  kind: StackTransition,
  reduceMotion: boolean,
  { gestureEnabled = true }: { gestureEnabled?: boolean } = {},
): Pick<NativeStackNavigationOptions, "animation" | "gestureEnabled"> {
  return { animation: reduceMotion ? "none" : ANIMATION[kind], gestureEnabled };
}

/** Bottom-tab options: tab switches cross-fade (none with reduce motion). */
export function tabTransition(reduceMotion: boolean): Pick<BottomTabNavigationOptions, "animation"> {
  return { animation: reduceMotion ? "none" : "fade" };
}

/** Customer AppStack screens that open as a modal form / task over the current page. */
export const CUSTOMER_MODAL_ROUTES: ReadonlySet<keyof AppStackParamList> = new Set<keyof AppStackParamList>([
  "BookTour",
  "AccessRequest",
  "ESignAgreement",
]);

/** Customer AppStack screens that swap in (tab root, signing in from inside the app). */
export const CUSTOMER_FADE_ROUTES: ReadonlySet<keyof AppStackParamList> = new Set<keyof AppStackParamList>([
  "MainTabs",
  "Login",
  "Signup",
  "VerifyEmail",
]);

/** Staff screens that open as a modal form over the current page. */
export const STAFF_MODAL_ROUTES: ReadonlySet<StaffRouteName> = new Set<StaffRouteName>([
  "QuotationForm",
  "CustomerForm",
  "BookingForm",
  "AgreementSend",
]);

export function customerTransition(route: keyof AppStackParamList): StackTransition {
  if (CUSTOMER_MODAL_ROUTES.has(route)) return "modal";
  if (CUSTOMER_FADE_ROUTES.has(route)) return "fade";
  return "push";
}

export function staffTransition(route: StaffRouteName | "StaffTabs"): StackTransition {
  if (route === "StaffTabs") return "fade";
  return STAFF_MODAL_ROUTES.has(route) ? "modal" : "push";
}

/** CEO stack: the dashboard fades in (it replaces whatever was shown before sign-in); drill screens push. */
export function ceoTransition(route: CeoRouteName): StackTransition {
  return route === "CeoDashboard" ? "fade" : "push";
}

/** Sales Manager stack, like the CEO's: the dashboard fades in; drill screens and the profile push. */
export function salesManagerTransition(route: SalesManagerRouteName): StackTransition {
  return route === "SalesManagerDashboard" ? "fade" : "push";
}

/** Access Officer stack: the Access screen fades in (it replaces whatever was shown before sign-in); the profile pushes. */
export function accessOfficerTransition(route: AccessOfficerRouteName): StackTransition {
  return route === "AccessOfficerAccess" ? "fade" : "push";
}
