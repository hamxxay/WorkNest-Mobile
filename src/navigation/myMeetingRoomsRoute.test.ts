import { linking } from "./linking";
import { customerTransition } from "./transitions";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type Config = { screens?: Record<string, unknown> };

describe("My Meeting Rooms route", () => {
  it("opens from the website's path /my-meeting-rooms", () => {
    const screens = linking.config!.screens as unknown as Record<string, Config>;
    expect(screens.AppStack.screens?.MyMeetingRooms).toBe("my-meeting-rooms");
  });

  it("is pushed like the other customer screens", () => {
    expect(customerTransition("MyMeetingRooms")).toBe("push");
  });
});
