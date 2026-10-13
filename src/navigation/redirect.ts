import type { AppStackParamList } from "./types";

/** Where to go once the customer has signed in or signed up (e.g. the quotation or space they were opening). */
export type RedirectAfterLogin = { screen: keyof AppStackParamList; params?: any };

/** Screens that make no sense as a destination after signing in. */
const NOT_A_DESTINATION: Array<keyof AppStackParamList> = ["Login", "Signup"];

type AppRoute = { name: keyof AppStackParamList; params?: any };

/**
 * The root navigation state after a successful sign-in / sign-up: the customer app with the tabs at the bottom
 * of the stack and, when the customer was on the way somewhere, that screen on top (so Back returns to the tabs).
 * Pass it to the root navigator's reset(). Pure (no navigation runtime), so it is unit tested.
 */
export function signedInState(redirect?: RedirectAfterLogin | null) {
  const target = redirect && !NOT_A_DESTINATION.includes(redirect.screen) ? redirect : null;
  const routes: AppRoute[] =
    !target || target.screen === "MainTabs"
      ? [{ name: "MainTabs", params: target?.params }]
      : [{ name: "MainTabs" }, { name: target.screen, params: target.params }];
  return {
    index: 0,
    routes: [{ name: "AppStack" as const, state: { index: routes.length - 1, routes } }],
  };
}
