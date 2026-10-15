import { findEarlierBookingScreen, returnToBookingScreen } from "./stackReturn";

const routes = [
  { name: "MainTabs" },
  { name: "BookingDetail", params: { bookingId: 560 } },
  { name: "Challan", params: { bookingId: 560, challanNumber: "WN-1" } },
];

describe("Challan <-> Booking details without duplicate screens", () => {
  it("finds the same booking's screen further down the stack", () => {
    expect(findEarlierBookingScreen(routes, 2, "BookingDetail", [560])).toBe(1);
    expect(findEarlierBookingScreen(routes, 2, "BookingDetail", ["560"])).toBe(1);
  });

  it("ignores another booking and the current screen", () => {
    expect(findEarlierBookingScreen(routes, 2, "BookingDetail", [561])).toBe(-1);
    expect(findEarlierBookingScreen(routes, 2, "Challan", [560])).toBe(-1);
    expect(findEarlierBookingScreen(routes, 2, "BookingDetail", [null, undefined])).toBe(-1);
  });

  it("matches a booking opened by its public id", () => {
    const byGuid = [{ name: "BookingDetail", params: { bookingId: "f309dd42" } }, { name: "Challan", params: { bookingId: 560 } }];
    expect(findEarlierBookingScreen(byGuid, 1, "BookingDetail", [560, "f309dd42"])).toBe(0);
  });

  it("pops back to it, or reports that it has to be opened", () => {
    const pop = jest.fn();
    expect(returnToBookingScreen({ getState: () => ({ index: 2, routes }), pop }, "BookingDetail", [560])).toBe(true);
    expect(pop).toHaveBeenCalledWith(1);
    pop.mockClear();
    expect(returnToBookingScreen({ getState: () => ({ index: 2, routes }), pop }, "BookingDetail", [561])).toBe(false);
    expect(pop).not.toHaveBeenCalled();
  });
});
