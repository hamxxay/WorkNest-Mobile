import { linking } from "./linking";
import { customerTransition } from "./transitions";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type Config = { screens?: Record<string, unknown> };

describe("Attendance route", () => {
  it("opens from the website's path /my-attendance", () => {
    const screens = linking.config!.screens as unknown as Record<string, Config>;
    expect(screens.AppStack.screens?.Attendance).toBe("my-attendance");
  });

  it("is pushed like the other customer screens", () => {
    expect(customerTransition("Attendance")).toBe("push");
  });
});
