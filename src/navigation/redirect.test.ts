import { signedInState } from "./redirect";

describe("after sign-in / sign-up", () => {
  it("opens the tabs when there is nowhere else to go", () => {
    expect(signedInState()).toEqual({
      index: 0,
      routes: [{ name: "AppStack", state: { index: 0, routes: [{ name: "MainTabs", params: undefined }] } }],
    });
  });

  it("returns to the screen the customer was opening, with the tabs underneath for Back", () => {
    const state = signedInState({ screen: "Quotation", params: { quotationId: "238" } });
    expect(state.routes[0].state).toEqual({
      index: 1,
      routes: [{ name: "MainTabs" }, { name: "Quotation", params: { quotationId: "238" } }],
    });
  });

  it("can open a tab, and never redirects to Login or Signup", () => {
    expect(signedInState({ screen: "MainTabs", params: { screen: "Bookings" } }).routes[0].state.routes).toEqual([
      { name: "MainTabs", params: { screen: "Bookings" } },
    ]);
    expect(signedInState({ screen: "Login" }).routes[0].state.routes).toEqual([{ name: "MainTabs", params: undefined }]);
  });
});
