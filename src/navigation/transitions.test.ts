import { customerTransition, stackTransition, staffTransition, tabTransition } from "./transitions";

describe("stack transitions", () => {
  it("push slides from the right, modal from the bottom, swaps fade; gestures on", () => {
    expect(stackTransition("push", false)).toEqual({ animation: "slide_from_right", gestureEnabled: true });
    expect(stackTransition("modal", false)).toEqual({ animation: "slide_from_bottom", gestureEnabled: true });
    expect(stackTransition("fade", false)).toEqual({ animation: "fade", gestureEnabled: true });
  });

  it("reduce motion turns every transition off but keeps gestures", () => {
    for (const kind of ["push", "modal", "fade"] as const) {
      expect(stackTransition(kind, true)).toEqual({ animation: "none", gestureEnabled: true });
    }
  });

  it("root swaps can turn the back gesture off", () => {
    expect(stackTransition("fade", false, { gestureEnabled: false })).toEqual({ animation: "fade", gestureEnabled: false });
  });

  it("tab switches fade, or not at all with reduce motion", () => {
    expect(tabTransition(false)).toEqual({ animation: "fade" });
    expect(tabTransition(true)).toEqual({ animation: "none" });
  });
});

describe("which customer screens use which transition", () => {
  it("forms open as modals", () => {
    expect(customerTransition("BookTour")).toBe("modal");
    expect(customerTransition("AccessRequest")).toBe("modal");
    expect(customerTransition("ESignAgreement")).toBe("modal");
  });

  it("tabs and sign in / sign up fade", () => {
    expect(customerTransition("MainTabs")).toBe("fade");
    expect(customerTransition("Login")).toBe("fade");
    expect(customerTransition("Signup")).toBe("fade");
  });

  it("everything else is a push", () => {
    for (const route of ["SpaceDetail", "BookingInfo", "BookingConfirm", "Challan", "BookingDetail", "Notifications"] as const) {
      expect(customerTransition(route)).toBe("push");
    }
  });
});

describe("which staff screens use which transition", () => {
  it("forms open as modals", () => {
    for (const route of ["QuotationForm", "CustomerForm", "BookingForm", "AgreementSend"] as const) {
      expect(staffTransition(route)).toBe("modal");
    }
  });

  it("the tabs fade and details push", () => {
    expect(staffTransition("StaffTabs")).toBe("fade");
    expect(staffTransition("QuotationDetail")).toBe("push");
    expect(staffTransition("CustomerDetail")).toBe("push");
    expect(staffTransition("StaffNotifications")).toBe("push");
  });
});
