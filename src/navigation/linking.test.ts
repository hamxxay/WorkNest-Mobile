import { linking } from "./linking";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type Config = { initialRouteName?: string; screens?: Record<string, unknown> };

describe("deep links", () => {
  const screens = linking.config!.screens as unknown as Record<string, Config>;

  it("keeps the tabs under a linked screen so Back works after a cold start", () => {
    expect(screens.AppStack.initialRouteName).toBe("MainTabs");
    expect(screens.AuthStack.initialRouteName).toBe("Login");
    expect(Object.keys(screens.AppStack.screens ?? {})).toEqual(
      expect.arrayContaining(["MainTabs", "Quotation", "QuotationList", "Notifications"]),
    );
  });

  it("accepts https and the app schemes only", () => {
    expect(linking.prefixes.every((p) => p.startsWith("https://") || p === "worknest://" || p === "myapp://")).toBe(true);
  });

  it("opens worknest:// links and keeps old myapp:// links working", () => {
    expect(linking.prefixes).toEqual(expect.arrayContaining(["worknest://", "myapp://"]));
    expect(linking.prefixes[0]).toBe("worknest://");
  });
});
